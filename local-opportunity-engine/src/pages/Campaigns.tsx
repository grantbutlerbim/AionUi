import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { exportPostcardMailCsv } from '@/lib/exportPresets';
import type { Campaign, CampaignType, Contractor, MailPiece } from '@/lib/types';

const emptyForm = {
  name: '',
  opportunity_type: 'patio_cover',
  campaign_type: 'postcard' as CampaignType,
  min_score: 3,
  contractor_id: '',
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [mailPieceCounts, setMailPieceCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busyCampaignId, setBusyCampaignId] = useState<string | null>(null);

  async function load() {
    const [campaignsRes, contractorsRes, mailPiecesRes] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('contractors').select('*'),
      supabase.from('mail_pieces').select('campaign_id'),
    ]);
    setCampaigns(campaignsRes.data ?? []);
    setContractors(contractorsRes.data ?? []);
    const counts: Record<string, number> = {};
    for (const row of (mailPiecesRes.data ?? []) as Pick<MailPiece, 'campaign_id'>[]) {
      counts[row.campaign_id] = (counts[row.campaign_id] ?? 0) + 1;
    }
    setMailPieceCounts(counts);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: insertError } = await supabase.from('campaigns').insert({
      name: form.name,
      opportunity_type: form.opportunity_type,
      campaign_type: form.campaign_type,
      min_score: form.min_score,
      contractor_id: form.contractor_id || null,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(emptyForm);
    await load();
  }

  async function populateCampaign(campaign: Campaign) {
    setBusyCampaignId(campaign.id);
    setError(null);
    try {
      const { data: existing } = await supabase
        .from('mail_pieces')
        .select('property_id')
        .eq('campaign_id', campaign.id);
      const existingIds = new Set((existing ?? []).map((r) => r.property_id));

      const { data: eligibleProperties, error: propsError } = await supabase
        .from('property_latest_scores')
        .select('property_id, score')
        .eq('opportunity_type', campaign.opportunity_type)
        .gte('score', campaign.min_score);
      if (propsError) throw propsError;

      const toInsert = (eligibleProperties ?? [])
        .filter((p) => !existingIds.has(p.property_id))
        .map((p) => ({ campaign_id: campaign.id, property_id: p.property_id, status: 'draft' as const }));

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('mail_pieces').insert(toInsert);
        if (insertError) throw insertError;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyCampaignId(null);
    }
  }

  async function exportCampaign(campaign: Campaign) {
    setError(null);
    const { data: mailProperties } = await supabase
      .from('mail_pieces')
      .select('property_id')
      .eq('campaign_id', campaign.id);
    const propertyIds = (mailProperties ?? []).map((r) => r.property_id);
    if (propertyIds.length === 0) {
      setError('This campaign has no properties yet — click "Add eligible properties" first.');
      return;
    }

    const [propertiesRes, scoresRes] = await Promise.all([
      supabase.from('properties').select('*').in('id', propertyIds),
      supabase
        .from('property_latest_scores')
        .select('*')
        .in('property_id', propertyIds)
        .eq('opportunity_type', campaign.opportunity_type),
    ]);

    const scoreByProperty = new Map((scoresRes.data ?? []).map((s) => [s.property_id, s]));
    const merged = (propertiesRes.data ?? []).map((p) => {
      const latest = scoreByProperty.get(p.id);
      return {
        ...p,
        images: [],
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

    exportPostcardMailCsv(merged);
  }

  return (
    <div>
      <h1>Campaigns</h1>
      <p className="muted">
        Group scored properties into a mail or contractor-lead campaign. Sending via Lob or
        PostGrid isn&apos;t wired up yet — export the CSV below and hand it to your mail vendor, or
        add an API integration later. No SMS is ever sent from this system.
      </p>

      <form className="card-form" onSubmit={(e) => void handleCreate(e)}>
        <div className="form-row">
          <label>
            Campaign name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Type
            <select
              value={form.campaign_type}
              onChange={(e) => setForm({ ...form, campaign_type: e.target.value as CampaignType })}
            >
              <option value="postcard">Homeowner postcard</option>
              <option value="contractor_leads">Contractor leads</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Minimum score
            <select
              value={form.min_score}
              onChange={(e) => setForm({ ...form, min_score: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </label>
          <label>
            Contractor (optional)
            <select value={form.contractor_id} onChange={(e) => setForm({ ...form, contractor_id: e.target.value })}>
              <option value="">None</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit">Create campaign</button>
        {error && <p className="error">{error}</p>}
      </form>

      <table className="property-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Min score</th>
            <th>Contractor</th>
            <th>Mail pieces</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.campaign_type}</td>
              <td>{c.min_score}+</td>
              <td>{contractors.find((con) => con.id === c.contractor_id)?.name ?? '—'}</td>
              <td>{mailPieceCounts[c.id] ?? 0}</td>
              <td className="table-actions">
                <button type="button" disabled={busyCampaignId === c.id} onClick={() => void populateCampaign(c)}>
                  {busyCampaignId === c.id ? 'Adding…' : 'Add eligible properties'}
                </button>
                <button type="button" onClick={() => void exportCampaign(c)}>
                  Export mail CSV
                </button>
                <button type="button" disabled title="Add a Lob or PostGrid API key to enable direct sending">
                  Send via Lob/PostGrid
                </button>
              </td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                No campaigns yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
