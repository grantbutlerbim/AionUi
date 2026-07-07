-- Local Opportunity Engine: core schema
-- Tables: properties, property_images, ai_scores, contractors, campaigns, mail_pieces

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- properties: one row per recently-sold home imported from CSV
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  sale_date date,
  sale_price numeric,
  beds numeric,
  baths numeric,
  sqft numeric,
  year_built integer,
  lat double precision,
  lng double precision,
  geocode_status text not null default 'pending' check (geocode_status in ('pending', 'ok', 'failed')),
  geocoded_at timestamptz,
  import_batch text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_zip_idx on public.properties (zip);
create index if not exists properties_sale_date_idx on public.properties (sale_date);
-- Plain-column unique constraint (not an expression index) so Supabase's
-- upsert(..., { onConflict: 'address,city,state,zip' }) can target it directly.
-- Insert code trims whitespace and upper-cases `state` before writing, so this
-- catches the common re-import case even though it isn't fully case-insensitive.
alter table public.properties
  add constraint properties_address_unique unique (address, city, state, zip);

-- ---------------------------------------------------------------------------
-- property_images: exterior / backyard / aerial photo URLs for a property
-- ---------------------------------------------------------------------------
create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  url text not null,
  image_type text not null default 'exterior' check (image_type in ('exterior', 'backyard', 'aerial', 'other')),
  created_at timestamptz not null default now()
);

create index if not exists property_images_property_id_idx on public.property_images (property_id);

-- ---------------------------------------------------------------------------
-- ai_scores: output of an AI scoring workflow run for a property + opportunity type
-- ---------------------------------------------------------------------------
create table if not exists public.ai_scores (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  opportunity_type text not null default 'patio_cover',
  score integer not null check (score between 0 and 5),
  detected_issue text,
  recommended_service text,
  contractor_note text,
  postcard_headline text,
  postcard_body text,
  est_job_value_low numeric,
  est_job_value_high numeric,
  model text,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_scores_property_id_idx on public.ai_scores (property_id);
create index if not exists ai_scores_opportunity_type_idx on public.ai_scores (opportunity_type);
create index if not exists ai_scores_score_idx on public.ai_scores (score);

-- ---------------------------------------------------------------------------
-- contractors: home-service businesses that opportunities can be sold to
-- ---------------------------------------------------------------------------
create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  service_type text not null default 'patio_cover',
  zip_coverage text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- campaigns: a batch of opportunities being sold / mailed
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opportunity_type text not null default 'patio_cover',
  campaign_type text not null default 'postcard' check (campaign_type in ('postcard', 'contractor_leads')),
  status text not null default 'draft' check (status in ('draft', 'ready', 'sent', 'archived')),
  contractor_id uuid references public.contractors (id) on delete set null,
  min_score integer not null default 3,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- mail_pieces: one direct-mail postcard per property within a campaign.
-- provider is a placeholder column so Lob or PostGrid can be wired in later.
-- No SMS is ever sent by this system.
-- ---------------------------------------------------------------------------
create table if not exists public.mail_pieces (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  ai_score_id uuid references public.ai_scores (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'queued', 'sent', 'failed', 'cancelled')),
  provider text check (provider in ('lob', 'postgrid', null)),
  provider_mail_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mail_pieces_campaign_id_idx on public.mail_pieces (campaign_id);
create index if not exists mail_pieces_property_id_idx on public.mail_pieces (property_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger for properties
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: this is an internal tool, so any authenticated user
-- (staff) can read/write everything. Anonymous access is blocked.
-- ---------------------------------------------------------------------------
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.ai_scores enable row level security;
alter table public.contractors enable row level security;
alter table public.campaigns enable row level security;
alter table public.mail_pieces enable row level security;

create policy "authenticated read/write properties" on public.properties
  for all to authenticated using (true) with check (true);

create policy "authenticated read/write property_images" on public.property_images
  for all to authenticated using (true) with check (true);

create policy "authenticated read/write ai_scores" on public.ai_scores
  for all to authenticated using (true) with check (true);

create policy "authenticated read/write contractors" on public.contractors
  for all to authenticated using (true) with check (true);

create policy "authenticated read/write campaigns" on public.campaigns
  for all to authenticated using (true) with check (true);

create policy "authenticated read/write mail_pieces" on public.mail_pieces
  for all to authenticated using (true) with check (true);
