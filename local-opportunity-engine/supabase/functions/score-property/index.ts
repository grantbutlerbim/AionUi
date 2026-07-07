// Supabase Edge Function: score-property
//
// Runs the AI scoring workflow for a single property + opportunity type (currently
// only "patio_cover" is implemented). Fetches the property's details and attached
// images, asks Claude to evaluate the "patio cover opportunity", and writes the
// structured result to `ai_scores`.
//
// Deploy with: supabase functions deploy score-property
// Requires secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by
// Supabase), and ANTHROPIC_API_KEY (set with `supabase secrets set`).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
const MAX_IMAGES = 6;

interface ScoreRequestBody {
  property_id: string;
  opportunity_type?: string;
}

interface PatioCoverScoreInput {
  score: number;
  detected_issue: string;
  recommended_service: string;
  contractor_note: string;
  postcard_headline: string;
  postcard_body: string;
  est_job_value_low: number;
  est_job_value_high: number;
}

const SCORING_TOOL = {
  name: 'record_patio_cover_score',
  description:
    'Records the patio-cover home-service opportunity assessment for a single property.',
  input_schema: {
    type: 'object',
    properties: {
      score: {
        type: 'integer',
        minimum: 0,
        maximum: 5,
        description:
          '0-5 opportunity score for selling a patio cover install. 0 = no opportunity/already has one, 5 = ideal candidate (large uncovered backyard/patio, no existing cover, home value supports a big-ticket purchase).',
      },
      detected_issue: {
        type: 'string',
        description: 'One sentence describing what was observed (e.g. "large uncovered concrete patio, no shade structure").',
      },
      recommended_service: {
        type: 'string',
        description: 'The specific service to pitch, e.g. "Aluminum patio cover installation".',
      },
      contractor_note: {
        type: 'string',
        description: 'A short internal note for the contractor sales team explaining why this lead is worth calling.',
      },
      postcard_headline: {
        type: 'string',
        description: 'A short, compelling headline for a direct-mail postcard to the homeowner.',
      },
      postcard_body: {
        type: 'string',
        description: '2-4 sentence postcard body copy addressed to the homeowner, no more than 400 characters.',
      },
      est_job_value_low: {
        type: 'number',
        description: 'Low end of the estimated job value range in USD.',
      },
      est_job_value_high: {
        type: 'number',
        description: 'High end of the estimated job value range in USD.',
      },
    },
    required: [
      'score',
      'detected_issue',
      'recommended_service',
      'contractor_note',
      'postcard_headline',
      'postcard_body',
      'est_job_value_low',
      'est_job_value_high',
    ],
  },
};

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

async function fetchImageAsBase64(url: string): Promise<{ mediaType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const mediaType = contentType.split(';')[0].trim();
    if (!mediaType.startsWith('image/')) return null;

    const buffer = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      binary += String.fromCharCode(...buffer.subarray(i, i + chunkSize));
    }
    return { mediaType, data: btoa(binary) };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY is not configured' }, 500);

  let body: ScoreRequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.property_id) return jsonResponse({ error: 'property_id is required' }, 400);

  const opportunityType = body.opportunity_type ?? 'patio_cover';
  if (opportunityType !== 'patio_cover') {
    return jsonResponse({ error: `Unsupported opportunity_type: ${opportunityType}` }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('*')
    .eq('id', body.property_id)
    .single();
  if (propertyError || !property) {
    return jsonResponse({ error: propertyError?.message ?? 'Property not found' }, 404);
  }

  const { data: images } = await supabase
    .from('property_images')
    .select('*')
    .eq('property_id', body.property_id)
    .limit(MAX_IMAGES);

  const imageBlocks = [];
  for (const img of images ?? []) {
    const encoded = await fetchImageAsBase64(img.url);
    if (encoded) {
      imageBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: encoded.mediaType, data: encoded.data },
      });
      imageBlocks.push({ type: 'text', text: `^ ${img.image_type} photo` });
    }
  }

  const propertySummary = [
    `Address: ${property.address}, ${property.city}, ${property.state} ${property.zip}`,
    `Sale date: ${property.sale_date ?? 'unknown'}`,
    `Sale price: ${property.sale_price ?? 'unknown'}`,
    `Beds/Baths: ${property.beds ?? '?'} / ${property.baths ?? '?'}`,
    `Sqft: ${property.sqft ?? 'unknown'}`,
    `Year built: ${property.year_built ?? 'unknown'}`,
  ].join('\n');

  const promptText = `You are evaluating a recently-sold home for a "patio cover" high-ticket home-service sales opportunity (aluminum/wood patio cover, pergola, or covered outdoor living structure installation).

Property details:
${propertySummary}

${
  imageBlocks.length
    ? 'Exterior/backyard/aerial photos are attached below. Use them to judge whether there is an uncovered patio or backyard area suitable for a patio cover, and the overall home quality/condition.'
    : 'No photos are available for this property — base your assessment on the property details alone (recent sale, price point, and size are still useful signals of likely renovation spend), and be more conservative with the score and job value range in the absence of visual confirmation.'
}

Call the record_patio_cover_score tool with your assessment. Be realistic: only score 4-5 when there's a clear, large, uncovered outdoor space and a home value that supports a high-ticket purchase.`;

  const anthropicRes = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      tools: [SCORING_TOOL],
      tool_choice: { type: 'tool', name: SCORING_TOOL.name },
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: promptText }, ...imageBlocks],
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return jsonResponse({ error: `Anthropic API error: ${errText}` }, 502);
  }

  const anthropicJson = await anthropicRes.json();
  const toolUse = (anthropicJson.content ?? []).find(
    (block: { type: string }) => block.type === 'tool_use'
  );
  if (!toolUse) {
    return jsonResponse({ error: 'Model did not return a structured score', raw: anthropicJson }, 502);
  }

  const scoreInput = toolUse.input as PatioCoverScoreInput;

  const { data: inserted, error: insertError } = await supabase
    .from('ai_scores')
    .insert({
      property_id: body.property_id,
      opportunity_type: opportunityType,
      score: scoreInput.score,
      detected_issue: scoreInput.detected_issue,
      recommended_service: scoreInput.recommended_service,
      contractor_note: scoreInput.contractor_note,
      postcard_headline: scoreInput.postcard_headline,
      postcard_body: scoreInput.postcard_body,
      est_job_value_low: scoreInput.est_job_value_low,
      est_job_value_high: scoreInput.est_job_value_high,
      model: ANTHROPIC_MODEL,
      raw_response: anthropicJson,
    })
    .select()
    .single();

  if (insertError) return jsonResponse({ error: insertError.message }, 500);

  return jsonResponse({ score: inserted });
});
