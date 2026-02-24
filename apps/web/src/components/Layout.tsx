import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-surface border-b border-border px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-bold text-lg tracking-widest">SIFT</span>
          <div className="flex gap-1">
            {[
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/transactions', label: 'Transactions' },
              { to: '/review', label: 'Review' },
              { to: '/onboarding', label: 'Import' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${
                    isActive
                      ? 'text-indigo-400 bg-indigo-500/10'
                      : 'text-muted hover:text-gray-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[13px] text-muted">
            {user?.email}
          </span>
          <button
            onClick={logout}
            className="btn btn-secondary px-3 py-1.5 text-[13px]"
          >
            Logout
          </button>
        </div>
      </nav>
      <main className="flex-1 py-8 px-6">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
