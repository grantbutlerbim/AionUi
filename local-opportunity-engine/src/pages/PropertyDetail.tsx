import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { runPatioCoverScoring } from '@/lib/scoring';
import ImageUploader from '@/components/ImageUploader';
import ScoreBadge from '@/components/ScoreBadge';
import type { AiScore, Property, PropertyImage } from '@/lib/types';

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [scores, setScores] = useState<AiScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [propertyRes, imagesRes, scoresRes] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id).single(),
      supabase.from('property_images').select('*').eq('property_id', id),
      supabase
        .from('ai_scores')
        .select('*')
        .eq('property_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (propertyRes.error) setError(propertyRes.error.message);
    else setProperty(propertyRes.data);
    setImages(imagesRes.data ?? []);
    setScores(scoresRes.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleScore() {
    if (!id) return;
    setScoring(true);
    setError(null);
    try {
      await runPatioCoverScoring(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScoring(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (!property) return <p className="error">{error ?? 'Property not found'}</p>;

  const latestScore = scores[0] ?? null;

  return (
    <div>
      <Link to="/" className="link-button">
        ← Back to dashboard
      </Link>
      <div className="page-header">
        <h1>{property.address}</h1>
        <ScoreBadge score={latestScore?.score} />
      </div>
      <p className="muted">
        {property.city}, {property.state} {property.zip}
      </p>

      <section className="detail-grid">
        <div>
          <strong>Sale date</strong>
          <div>{property.sale_date ?? '—'}</div>
        </div>
        <div>
          <strong>Sale price</strong>
          <div>{property.sale_price ? `$${property.sale_price.toLocaleString()}` : '—'}</div>
        </div>
        <div>
          <strong>Beds / Baths</strong>
          <div>
            {property.beds ?? '—'} / {property.baths ?? '—'}
          </div>
        </div>
        <div>
          <strong>Sqft</strong>
          <div>{property.sqft ?? '—'}</div>
        </div>
        <div>
          <strong>Year built</strong>
          <div>{property.year_built ?? '—'}</div>
        </div>
        <div>
          <strong>Geocode</strong>
          <div>
            {property.geocode_status === 'ok' && property.lat && property.lng
              ? `${property.lat.toFixed(5)}, ${property.lng.toFixed(5)}`
              : property.geocode_status}
          </div>
        </div>
      </section>

      <h2>Photos</h2>
      <ImageUploader propertyId={property.id} images={images} onChange={() => void load()} />

      <h2>Patio cover opportunity score</h2>
      <button type="button" onClick={() => void handleScore()} disabled={scoring}>
        {scoring ? 'Scoring…' : latestScore ? 'Re-run AI scoring' : 'Run AI scoring'}
      </button>
      {error && <p className="error">{error}</p>}

      {latestScore ? (
        <div className="score-detail">
          <div>
            <strong>Detected issue</strong>
            <p>{latestScore.detected_issue}</p>
          </div>
          <div>
            <strong>Recommended service</strong>
            <p>{latestScore.recommended_service}</p>
          </div>
          <div>
            <strong>Contractor sales note</strong>
            <p>{latestScore.contractor_note}</p>
          </div>
          <div>
            <strong>Homeowner postcard headline</strong>
            <p>{latestScore.postcard_headline}</p>
          </div>
          <div>
            <strong>Homeowner postcard body</strong>
            <p>{latestScore.postcard_body}</p>
          </div>
          <div>
            <strong>Estimated job value</strong>
            <p>
              {latestScore.est_job_value_low && latestScore.est_job_value_high
                ? `$${latestScore.est_job_value_low.toLocaleString()} - $${latestScore.est_job_value_high.toLocaleString()}`
                : '—'}
            </p>
          </div>
        </div>
      ) : (
        <p className="muted">No score yet. Attach photos above (optional but recommended), then run scoring.</p>
      )}

      {scores.length > 1 && (
        <details>
          <summary>Score history ({scores.length})</summary>
          <ul>
            {scores.map((s) => (
              <li key={s.id}>
                {new Date(s.created_at).toLocaleString()} — score {s.score}/5
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
