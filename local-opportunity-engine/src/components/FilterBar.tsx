import type { PropertyFilters } from '@/hooks/useProperties';

interface Props {
  filters: PropertyFilters;
  onChange: (filters: PropertyFilters) => void;
}

export default function FilterBar({ filters, onChange }: Props) {
  return (
    <div className="filter-bar">
      <label>
        ZIP
        <input
          type="text"
          placeholder="e.g. 85234"
          value={filters.zip ?? ''}
          onChange={(e) => onChange({ ...filters, zip: e.target.value || undefined })}
        />
      </label>
      <label>
        Min score
        <select
          value={filters.minScore ?? ''}
          onChange={(e) =>
            onChange({ ...filters, minScore: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}+
            </option>
          ))}
        </select>
      </label>
      <label>
        Opportunity type
        <select
          value={filters.opportunityType ?? 'patio_cover'}
          onChange={(e) => onChange({ ...filters, opportunityType: e.target.value })}
        >
          <option value="patio_cover">Patio cover</option>
        </select>
      </label>
      <label>
        Sale date from
        <input
          type="date"
          value={filters.saleDateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, saleDateFrom: e.target.value || undefined })}
        />
      </label>
      <label>
        Sale date to
        <input
          type="date"
          value={filters.saleDateTo ?? ''}
          onChange={(e) => onChange({ ...filters, saleDateTo: e.target.value || undefined })}
        />
      </label>
      <button type="button" className="link-button" onClick={() => onChange({ opportunityType: 'patio_cover' })}>
        Clear filters
      </button>
    </div>
  );
}
