# Local Opportunity Engine

Finds recently-sold residential homes in selected ZIP codes and scores them for
high-ticket home-service opportunities (MVP: patio covers).

## Stack

- React + Vite + TypeScript dashboard (`src/`)
- Supabase (Postgres + Auth + Storage + Edge Functions) (`supabase/`)
- AI scoring via Anthropic Claude (vision), run as a Supabase Edge Function

## Data sources

**Property CSV (step 1 of the workflow):** for a Houston-area pilot, don't pay
for RentCast/ATTOM/First American to start. Harris County Appraisal District
(HCAD) publishes free bulk property/sales data — owner, address, sale date,
sale price, sqft, year built — for every parcel in the county, and Fort Bend /
Montgomery / Brazoria appraisal districts publish the same for the suburbs.
Export/reshape that into the CSV columns this app expects
(`address, city, state, zip, sale_date, sale_price, beds, baths, sqft,
year_built`) and skip the paid API entirely for an MVP.

**Photos (step 2, "attach exterior/backyard/aerial image URLs"):** this app
intentionally does *not* auto-pull Google Street View imagery. Google Maps
Platform's terms restrict redistributing/reselling Street View imagery to
third parties, which is exactly what "hand the contractor a photo" would be.
The safe pattern: score the property from the CSV data (and any photos *you*
have the rights to attach), and let the AI-generated text output — detected
issue, recommended service, postcard copy — be the thing you sell. If a
contractor wants to see the property, they pull up Street View themselves
during their own sales call.

## Setup

1. Create a Supabase project.
2. Apply the schema:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This creates the `properties`, `property_images`, `ai_scores`, `contractors`,
   `campaigns`, and `mail_pieces` tables (see `supabase/migrations/`), a
   `property_latest_scores` view, and a public `property-images` storage bucket.
3. Create at least one user in Supabase Authentication → Users (email + password).
   There's no public self-signup — this is an internal sales-ops tool.
4. Deploy the scoring function and set its secret:
   ```bash
   supabase functions deploy score-property
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
5. Copy `.env.example` to `.env.local` and fill in your Supabase URL/anon key.
   Geocoding defaults to the free Nominatim (OpenStreetMap) API — no key
   required, but rate-limited to ~1 request/second, which the import flow
   respects. Set `VITE_GEOCODE_PROVIDER=google` or `mapbox` with an API key for
   faster/more reliable geocoding at scale.
6. Install and run:
   ```bash
   npm install
   npm run dev
   ```

## Workflow

1. **Import** a CSV of recently sold homes (`/import`). Required columns:
   `address, city, state, zip`. Optional: `sale_date, sale_price, beds, baths,
   sqft, year_built` (common header variants like `zipcode`, `bedrooms`,
   `square_feet` are auto-mapped). Rows are geocoded automatically after
   insert; re-importing the same address updates the existing row instead of
   duplicating it.
2. **Attach photos** on a property's detail page — either paste an image URL
   (exterior/backyard/aerial) or upload a file directly to Supabase Storage.
3. **Run AI scoring** on a property to get a 0-5 "patio cover opportunity"
   score plus: detected issue, recommended service, a contractor sales note, a
   homeowner postcard headline + body, and an estimated job value range.
   Scoring works without photos too (more conservative), but photos improve
   accuracy since the model can see the actual backyard/patio.
4. **Dashboard** (`/`) lists all properties with filters for ZIP, minimum
   score, sale date range, and opportunity type. Select rows (or leave nothing
   selected to use the full filtered set) and export either:
   - **Contractor sales CSV** — full property + score detail for a sales team.
   - **Postcard mail-merge CSV** — address + headline + body, ready for a mail
     vendor or a future Lob/PostGrid integration.
5. **Contractors** (`/contractors`) — simple CRUD for businesses opportunities
   can be routed to, with ZIP coverage.
6. **Campaigns** (`/campaigns`) — group properties above a score threshold
   into a postcard or contractor-lead campaign, then export a CSV. The
   "Send via Lob/PostGrid" button is a placeholder: the `mail_pieces` table
   already has `provider` / `provider_mail_id` / `sent_at` columns so wiring up
   an actual API call later is a matter of implementing that one action — no
   schema changes needed. **SMS is intentionally not implemented anywhere.**

## Schema

See `supabase/migrations/0001_init.sql` for the full schema. Summary:

| Table              | Purpose                                                        |
| ------------------ | --------------------------------------------------------------|
| `properties`        | Imported sold-home records + geocode results                 |
| `property_images`   | Exterior/backyard/aerial photo URLs per property              |
| `ai_scores`          | AI scoring output per property + opportunity type (versioned) |
| `contractors`       | Home-service businesses leads can be sold/routed to           |
| `campaigns`          | A batch of mail or contractor-lead outreach                  |
| `mail_pieces`        | One planned/sent postcard per property within a campaign      |

## Extending

- **More opportunity types**: the scoring edge function currently only
  implements `patio_cover`; add another tool schema + prompt branch in
  `supabase/functions/score-property/index.ts` for e.g. `roof_replacement` or
  `pool_resurfacing`, keyed by the `opportunity_type` column already present on
  `ai_scores` and `campaigns`.
- **Lob / PostGrid**: implement the "Send via Lob/PostGrid" action in
  `src/pages/Campaigns.tsx` by POSTing each `mail_piece`'s property + postcard
  copy to the provider's API, then updating `provider`, `provider_mail_id`, and
  `status` on that row.
