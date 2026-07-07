export type GeocodeStatus = 'pending' | 'ok' | 'failed';

// NOTE: these are `type` aliases rather than `interface`s on purpose. Supabase's
// generated Database type checks `Row extends Record<string, unknown>` in a
// conditional type, and TypeScript only grants object type literals (not
// interfaces) an implicit index signature for that check — using `interface`
// here makes every table resolve to `never` in supabase-js's query builders.
export type Property = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  sale_date: string | null;
  sale_price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  year_built: number | null;
  lat: number | null;
  lng: number | null;
  geocode_status: GeocodeStatus;
  geocoded_at: string | null;
  import_batch: string | null;
  created_at: string;
  updated_at: string;
};

export type ImageType = 'exterior' | 'backyard' | 'aerial' | 'other';

export type PropertyImage = {
  id: string;
  property_id: string;
  url: string;
  image_type: ImageType;
  created_at: string;
};

export type AiScore = {
  id: string;
  property_id: string;
  opportunity_type: string;
  score: number;
  detected_issue: string | null;
  recommended_service: string | null;
  contractor_note: string | null;
  postcard_headline: string | null;
  postcard_body: string | null;
  est_job_value_low: number | null;
  est_job_value_high: number | null;
  model: string | null;
  raw_response: unknown;
  created_at: string;
};

export type Contractor = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  service_type: string;
  zip_coverage: string[];
  notes: string | null;
  created_at: string;
};

export type CampaignType = 'postcard' | 'contractor_leads';
export type CampaignStatus = 'draft' | 'ready' | 'sent' | 'archived';

export type Campaign = {
  id: string;
  name: string;
  opportunity_type: string;
  campaign_type: CampaignType;
  status: CampaignStatus;
  contractor_id: string | null;
  min_score: number;
  created_at: string;
};

export type MailPieceStatus = 'draft' | 'queued' | 'sent' | 'failed' | 'cancelled';
export type MailProvider = 'lob' | 'postgrid' | null;

export type MailPiece = {
  id: string;
  campaign_id: string;
  property_id: string;
  ai_score_id: string | null;
  status: MailPieceStatus;
  provider: MailProvider;
  provider_mail_id: string | null;
  sent_at: string | null;
  created_at: string;
};

/** A property joined with its latest AI score, used throughout the dashboard. */
export type PropertyWithScore = Property & {
  latest_score: AiScore | null;
  images: PropertyImage[];
};

export type PropertyCsvRow = {
  address: string;
  city: string;
  state: string;
  zip: string;
  sale_date?: string;
  sale_price?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
  year_built?: string;
};
