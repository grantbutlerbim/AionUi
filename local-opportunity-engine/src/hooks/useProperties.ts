import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { PropertyWithScore } from '@/lib/types';

export interface PropertyFilters {
  zip?: string;
  minScore?: number;
  opportunityType?: string;
  saleDateFrom?: string;
  saleDateTo?: string;
}

export function useProperties(filters: PropertyFilters) {
  const [properties, setProperties] = useState<PropertyWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from('properties').select('*').order('sale_date', { ascending: false });

      if (filters.zip) query = query.eq('zip', filters.zip);
      if (filters.saleDateFrom) query = query.gte('sale_date', filters.saleDateFrom);
      if (filters.saleDateTo) query = query.lte('sale_date', filters.saleDateTo);

      const { data: propertyRows, error: propertiesError } = await query;
      if (propertiesError) throw propertiesError;

      const propertyIds = (propertyRows ?? []).map((p) => p.id);

      const [scoresRes, imagesRes] = await Promise.all([
        propertyIds.length
          ? supabase
              .from('property_latest_scores')
              .select('*')
              .in('property_id', propertyIds)
              .eq('opportunity_type', filters.opportunityType ?? 'patio_cover')
          : Promise.resolve({ data: [], error: null }),
        propertyIds.length
          ? supabase.from('property_images').select('*').in('property_id', propertyIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (scoresRes.error) throw scoresRes.error;
      if (imagesRes.error) throw imagesRes.error;

      const scoreByProperty = new Map((scoresRes.data ?? []).map((s) => [s.property_id, s]));
      const imagesByProperty = new Map<string, typeof imagesRes.data>();
      for (const img of imagesRes.data ?? []) {
        const list = imagesByProperty.get(img.property_id) ?? [];
        list.push(img);
        imagesByProperty.set(img.property_id, list);
      }

      let merged: PropertyWithScore[] = (propertyRows ?? []).map((p) => {
        const latest = scoreByProperty.get(p.id);
        return {
          ...p,
          images: imagesByProperty.get(p.id) ?? [],
          latest_score: latest
            ? {
                id: latest.ai_score_id,
                property_id: latest.property_id,
                opportunity_type: latest.opportunity_type,
                score: latest.score,
                detected_issue: latest.detected_issue,
                recommended_service: latest.recommended_service,
                contractor_note: latest.contractor_note,
                postcard_headline: latest.postcard_headline,
                postcard_body: latest.postcard_body,
                est_job_value_low: latest.est_job_value_low,
                est_job_value_high: latest.est_job_value_high,
                model: latest.model,
                raw_response: null,
                created_at: latest.scored_at,
              }
            : null,
        };
      });

      if (filters.minScore !== undefined) {
        merged = merged.filter((p) => (p.latest_score?.score ?? -1) >= filters.minScore!);
      }

      setProperties(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [filters.zip, filters.minScore, filters.opportunityType, filters.saleDateFrom, filters.saleDateTo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { properties, loading, error, refresh };
}
