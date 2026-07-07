import { supabase } from './supabaseClient';
import type { AiScore } from './types';

export async function runPatioCoverScoring(propertyId: string): Promise<AiScore> {
  const { data, error } = await supabase.functions.invoke<{ score: AiScore }>('score-property', {
    body: { property_id: propertyId, opportunity_type: 'patio_cover' },
  });
  if (error) throw new Error(error.message);
  if (!data?.score) throw new Error('Scoring function returned no result');
  return data.score;
}
