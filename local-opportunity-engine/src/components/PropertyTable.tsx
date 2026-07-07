import { Link } from 'react-router-dom';
import type { PropertyWithScore } from '@/lib/types';
import ScoreBadge from './ScoreBadge';

interface Props {
  properties: PropertyWithScore[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `$${value.toLocaleString()}`;
}

export default function PropertyTable({ properties, selectedIds, onToggleSelect }: Props) {
  if (properties.length === 0) {
    return <p className="muted">No properties match the current filters.</p>;
  }

  return (
    <table className="property-table">
      <thead>
        <tr>
          <th></th>
          <th>Address</th>
          <th>ZIP</th>
          <th>Sale date</th>
          <th>Sale price</th>
          <th>Beds/Baths</th>
          <th>Sqft</th>
          <th>Score</th>
          <th>Recommended service</th>
          <th>Job value</th>
        </tr>
      </thead>
      <tbody>
        {properties.map((p) => (
          <tr key={p.id}>
            <td>
              <input
                type="checkbox"
                checked={selectedIds.has(p.id)}
                onChange={() => onToggleSelect(p.id)}
              />
            </td>
            <td>
              <Link to={`/properties/${p.id}`}>{p.address}</Link>
              <div className="muted small">
                {p.city}, {p.state}
              </div>
            </td>
            <td>{p.zip}</td>
            <td>{p.sale_date ?? '—'}</td>
            <td>{formatCurrency(p.sale_price)}</td>
            <td>
              {p.beds ?? '—'}bd / {p.baths ?? '—'}ba
            </td>
            <td>{p.sqft ?? '—'}</td>
            <td>
              <ScoreBadge score={p.latest_score?.score} />
            </td>
            <td>{p.latest_score?.recommended_service ?? '—'}</td>
            <td>
              {p.latest_score
                ? `${formatCurrency(p.latest_score.est_job_value_low)} - ${formatCurrency(
                    p.latest_score.est_job_value_high
                  )}`
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
