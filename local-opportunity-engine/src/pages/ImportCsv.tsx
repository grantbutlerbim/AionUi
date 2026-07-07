import { useState, type ChangeEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { csvRowToPropertyInsert, parsePropertyCsv } from '@/lib/csv';
import { geocodeQueue } from '@/lib/geocode';
import type { Property } from '@/lib/types';

type ImportStage = 'idle' | 'parsing' | 'inserting' | 'geocoding' | 'done' | 'error';

export default function ImportCsv() {
  const [stage, setStage] = useState<ImportStage>('idle');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [insertedCount, setInsertedCount] = useState(0);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFatalError(null);
    setParseErrors([]);
    setInsertedCount(0);
    setGeocodedCount(0);
    setStage('parsing');

    try {
      const { rows, errors } = await parsePropertyCsv(file);
      setParseErrors(errors);
      setTotalRows(rows.length);

      if (rows.length === 0) {
        setStage(errors.length ? 'error' : 'done');
        return;
      }

      setStage('inserting');
      const importBatch = `${file.name}-${new Date().toISOString()}`;
      const inserts = rows.map((row) => csvRowToPropertyInsert(row, importBatch));

      const { data: inserted, error } = await supabase
        .from('properties')
        .upsert(inserts, {
          onConflict: 'address,city,state,zip',
          ignoreDuplicates: false,
        })
        .select();

      if (error) throw error;
      setInsertedCount(inserted?.length ?? 0);

      setStage('geocoding');
      const needsGeocode = (inserted ?? []).filter((p) => p.geocode_status !== 'ok') as Property[];
      await geocodeQueue(
        needsGeocode,
        (p) => ({ address: p.address, city: p.city, state: p.state, zip: p.zip }),
        async (property, result) => {
          if (result) {
            await supabase
              .from('properties')
              .update({
                lat: result.lat,
                lng: result.lng,
                geocode_status: 'ok',
                geocoded_at: new Date().toISOString(),
              })
              .eq('id', property.id);
          } else {
            await supabase
              .from('properties')
              .update({ geocode_status: 'failed' })
              .eq('id', property.id);
          }
          setGeocodedCount((c) => c + 1);
        }
      );

      setStage('done');
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : String(err));
      setStage('error');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div>
      <h1>Import property CSV</h1>
      <p className="muted">
        Upload a CSV of recently sold homes. Required columns: address, city, state, zip. Optional:
        sale_date, sale_price, beds, baths, sqft, year_built. Rows are matched on
        address+city+state+zip, so re-importing the same file updates existing rows instead of
        duplicating them.
      </p>

      <input type="file" accept=".csv" onChange={(e) => void handleFile(e)} disabled={stage === 'parsing' || stage === 'inserting' || stage === 'geocoding'} />

      {stage !== 'idle' && (
        <div className="import-status">
          {stage === 'parsing' && <p>Parsing CSV…</p>}
          {stage === 'inserting' && <p>Saving {totalRows} rows to the database…</p>}
          {stage === 'geocoding' && (
            <p>
              Geocoding addresses… {geocodedCount}/{insertedCount} (this respects the free
              geocoder's rate limit, so it can take a while for large files)
            </p>
          )}
          {stage === 'done' && (
            <p className="success">
              Imported {insertedCount} of {totalRows} rows. Geocoded {geocodedCount}.
            </p>
          )}
          {stage === 'error' && fatalError && <p className="error">Import failed: {fatalError}</p>}
          {parseErrors.length > 0 && (
            <details>
              <summary>{parseErrors.length} row(s) skipped</summary>
              <ul>
                {parseErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
