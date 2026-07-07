import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function AppShell() {
  const { signOut, session } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>Local Opportunity Engine</h2>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/import">Import CSV</NavLink>
          <NavLink to="/contractors">Contractors</NavLink>
          <NavLink to="/campaigns">Campaigns</NavLink>
        </nav>
        <div className="sidebar-footer">
          <span className="muted small">{session?.user.email}</span>
          <button className="link-button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
