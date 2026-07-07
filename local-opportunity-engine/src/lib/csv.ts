import Papa from 'papaparse';
import type { Property, PropertyCsvRow } from './types';

/** Maps loosely-named CSV headers to our canonical field names. */
const HEADER_ALIASES: Record<string, keyof PropertyCsvRow> = {
  address: 'address',
  street: 'address',
  street_address: 'address',
  city: 'city',
  state: 'state',
  zip: 'zip',
  zipcode: 'zip',
  zip_code: 'zip',
  postal_code: 'zip',
  sale_date: 'sale_date',
  saledate: 'sale_date',
  date_sold: 'sale_date',
  sale_price: 'sale_price',
  saleprice: 'sale_price',
  price: 'sale_price',
  beds: 'beds',
  bedrooms: 'beds',
  baths: 'baths',
  bathrooms: 'baths',
  sqft: 'sqft',
  square_feet: 'sqft',
  square_footage: 'sqft',
  year_built: 'year_built',
  yearbuilt: 'year_built',
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

export interface ParsedCsvResult {
  rows: PropertyCsvRow[];
  errors: string[];
}

export function parsePropertyCsv(file: File): Promise<ParsedCsvResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => HEADER_ALIASES[normalizeHeader(header)] ?? normalizeHeader(header),
      complete: (results) => {
        const errors: string[] = [];
        const rows: PropertyCsvRow[] = [];

        results.data.forEach((raw, index) => {
          const row = raw as unknown as PropertyCsvRow;
          if (!row.address || !row.city || !row.state || !row.zip) {
            errors.push(`Row ${index + 2}: missing required address/city/state/zip`);
            return;
          }
          rows.push(row);
        });

        results.errors.forEach((e) => errors.push(`Row ${e.row ?? '?'}: ${e.message}`));
        resolve({ rows, errors });
      },
      error: (err) => reject(err),
    });
  });
}

function toNumberOrNull(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const n = Number(value.replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toDateOrNull(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function csvRowToPropertyInsert(
  row: PropertyCsvRow,
  importBatch: string
): Database_PropertyInsert {
  return {
    address: row.address.trim(),
    city: row.city.trim(),
    state: row.state.trim().toUpperCase(),
    zip: row.zip.trim(),
    sale_date: toDateOrNull(row.sale_date),
    sale_price: toNumberOrNull(row.sale_price),
    beds: toNumberOrNull(row.beds),
    baths: toNumberOrNull(row.baths),
    sqft: toNumberOrNull(row.sqft),
    year_built: row.year_built ? Math.trunc(toNumberOrNull(row.year_built) ?? 0) || null : null,
    import_batch: importBatch,
  };
}

/** Shape accepted by supabase `properties` insert (subset of Property, no id/timestamps). */
export type Database_PropertyInsert = Pick<
  Property,
  'address' | 'city' | 'state' | 'zip' | 'sale_date' | 'sale_price' | 'beds' | 'baths' | 'sqft' | 'year_built'
> & { import_batch: string };

export function exportToCsv(filename: string, headers: string[], rows: (string | number | null)[][]): void {
  const escapeCell = (cell: string | number | null): string => {
    const value = cell === null || cell === undefined ? '' : String(cell);
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
