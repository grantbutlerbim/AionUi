import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Contractor } from '@/lib/types';

const emptyForm = { name: '', contact_name: '', email: '', phone: '', service_type: 'patio_cover', zip_coverage: '' };

export default function Contractors() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('contractors')
      .select('*')
      .order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    setContractors(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const zipCoverage = form.zip_coverage
      .split(',')
      .map((z) => z.trim())
      .filter(Boolean);

    const { error: insertError } = await supabase.from('contractors').insert({
      name: form.name,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      service_type: form.service_type,
      zip_coverage: zipCoverage,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(emptyForm);
    await load();
  }

  async function handleDelete(id: string) {
    await supabase.from('contractors').delete().eq('id', id);
    await load();
  }

  return (
    <div>
      <h1>Contractors</h1>
      <p className="muted">Businesses that opportunities can be sold or routed to.</p>

      <form className="card-form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="form-row">
          <label>
            Business name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Contact name
            <input
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Service type
            <input
              value={form.service_type}
              onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            />
          </label>
          <label>
            ZIP coverage (comma-separated)
            <input
              value={form.zip_coverage}
              placeholder="85234, 85248, 85286"
              onChange={(e) => setForm({ ...form, zip_coverage: e.target.value })}
            />
          </label>
        </div>
        <button type="submit">Add contractor</button>
        {error && <p className="error">{error}</p>}
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="property-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Service</th>
              <th>ZIP coverage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  {c.contact_name ?? '—'}
                  <div className="muted small">
                    {c.email ?? ''} {c.phone ?? ''}
                  </div>
                </td>
                <td>{c.service_type}</td>
                <td>{c.zip_coverage.join(', ') || '—'}</td>
                <td>
                  <button type="button" className="link-button" onClick={() => void handleDelete(c.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {contractors.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No contractors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
