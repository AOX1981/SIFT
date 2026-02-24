import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '0.05em' }}>SIFT</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/transactions', label: 'Transactions' },
              { to: '/review', label: 'Review' },
              { to: '/onboarding', label: 'Import' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  padding: '8px 14px',
                  borderRadius: 'var(--radius)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  textDecoration: 'none',
                })}
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {user?.email}
          </span>
          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            Logout
          </button>
        </div>
      </nav>
      <main style={{ flex: 1, padding: '32px 24px' }}>
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
