import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProperties, type PropertyFilters } from '@/hooks/useProperties';
import FilterBar from '@/components/FilterBar';
import PropertyTable from '@/components/PropertyTable';
import { exportContractorSalesCsv, exportPostcardMailCsv } from '@/lib/exportPresets';

export default function Dashboard() {
  const [filters, setFilters] = useState<PropertyFilters>({ opportunityType: 'patio_cover' });
  const { properties, loading, error } = useProperties(filters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedProperties = useMemo(
    () => properties.filter((p) => selectedIds.has(p.id)),
    [properties, selectedIds]
  );
  const exportSet = selectedProperties.length > 0 ? selectedProperties : properties;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="page-header">
        <h1>Opportunities</h1>
        <div className="page-actions">
          <button type="button" onClick={() => exportContractorSalesCsv(exportSet)} disabled={exportSet.length === 0}>
            Export contractor CSV
          </button>
          <button type="button" onClick={() => exportPostcardMailCsv(exportSet)} disabled={exportSet.length === 0}>
            Export postcard CSV
          </button>
          <Link className="button-link" to="/import">
            Import CSV
          </Link>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      <p className="muted small">
        {selectedProperties.length > 0
          ? `${selectedProperties.length} selected — exports will use only the selected rows.`
          : `Showing ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} — exports use all filtered rows unless you select some.`}
      </p>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <PropertyTable properties={properties} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
      )}
    </div>
  );
}
