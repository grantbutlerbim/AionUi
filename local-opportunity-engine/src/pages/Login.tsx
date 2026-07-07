import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signInWithPassword(email, password);
    setSubmitting(false);
    if (signInError) setError(signInError);
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Local Opportunity Engine</h1>
        <p className="muted">Sign in with your Supabase account to continue.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted small">
          Users are created in the Supabase dashboard (Authentication → Users) — there is no
          public self-signup for this internal tool.
        </p>
      </form>
    </div>
  );
}
