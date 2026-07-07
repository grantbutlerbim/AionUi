import { exportToCsv } from './csv';
import type { PropertyWithScore } from './types';

/** Export for handing leads to a contractor's sales team. */
export function exportContractorSalesCsv(properties: PropertyWithScore[]): void {
  const headers = [
    'Address',
    'City',
    'State',
    'ZIP',
    'Sale Date',
    'Sale Price',
    'Beds',
    'Baths',
    'Sqft',
    'Score',
    'Detected Issue',
    'Recommended Service',
    'Contractor Sales Note',
    'Est Job Value Low',
    'Est Job Value High',
  ];

  const rows = properties.map((p) => [
    p.address,
    p.city,
    p.state,
    p.zip,
    p.sale_date,
    p.sale_price,
    p.beds,
    p.baths,
    p.sqft,
    p.latest_score?.score ?? null,
    p.latest_score?.detected_issue ?? null,
    p.latest_score?.recommended_service ?? null,
    p.latest_score?.contractor_note ?? null,
    p.latest_score?.est_job_value_low ?? null,
    p.latest_score?.est_job_value_high ?? null,
  ]);

  exportToCsv(`contractor-sales-${Date.now()}.csv`, headers, rows);
}

/** Export formatted as a homeowner postcard mail-merge file (for Lob/PostGrid or a print shop). */
export function exportPostcardMailCsv(properties: PropertyWithScore[]): void {
  const headers = ['Address', 'City', 'State', 'ZIP', 'Headline', 'Body'];

  const rows = properties.map((p) => [
    p.address,
    p.city,
    p.state,
    p.zip,
    p.latest_score?.postcard_headline ?? null,
    p.latest_score?.postcard_body ?? null,
  ]);

  exportToCsv(`postcard-mail-merge-${Date.now()}.csv`, headers, rows);
}
