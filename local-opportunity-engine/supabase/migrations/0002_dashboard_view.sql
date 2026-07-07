-- View exposing each property alongside its most recent AI score (per opportunity_type),
-- so the dashboard can filter/sort by score without an N+1 query per property.
create or replace view public.property_latest_scores as
select distinct on (ai_scores.property_id, ai_scores.opportunity_type)
  ai_scores.property_id,
  ai_scores.opportunity_type,
  ai_scores.id as ai_score_id,
  ai_scores.score,
  ai_scores.detected_issue,
  ai_scores.recommended_service,
  ai_scores.contractor_note,
  ai_scores.postcard_headline,
  ai_scores.postcard_body,
  ai_scores.est_job_value_low,
  ai_scores.est_job_value_high,
  ai_scores.model,
  ai_scores.created_at as scored_at
from public.ai_scores
order by ai_scores.property_id, ai_scores.opportunity_type, ai_scores.created_at desc;

grant select on public.property_latest_scores to authenticated;
