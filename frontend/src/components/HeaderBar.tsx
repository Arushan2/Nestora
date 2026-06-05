import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import type { User, UserRole } from '../types/session';

interface HeaderBarProps {
  user?: User | null;
  role?: UserRole | null;
  onLogout?: () => Promise<void>;
}

export function HeaderBar({ user, role, onLogout }: HeaderBarProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  // Determine the effective role
  const effectiveRole = role ?? user?.role;
  const isPending = user?.application?.status === 'pending' && effectiveRole === 'user';
  const isPro = effectiveRole === 'service_provider' || effectiveRole === 'product_seller';
  const isAdmin = effectiveRole === 'admin';

  // Navigation action for the Home Page
  const actionLabel = isAdmin ? 'Admin' : isPro ? 'Dashboard' : isPending ? 'Pending review' : 'Join as Pro';
  const actionTo = isAdmin ? '/admin' : isPro ? '/dashboard' : isPending ? '/' : '/join-as-pro';

  const isAtHome = currentPath === '/';

  return (
    <header className="flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
      <Link to="/" className="font-display text-xl font-semibold text-ink-900">
        Nestora
      </Link>
      <div className="flex items-center gap-3">
        {isAtHome ? (
          <Link
            to={actionTo}
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
          >
            {actionLabel}
          </Link>
        ) : (
          <Link
            to="/"
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100"
          >
            Home
          </Link>
        )}
        
        {user || role ? (
          onLogout ? (
            <Button variant="outline" onClick={onLogout}>
              Logout
            </Button>
          ) : null
        ) : (
          <Link to="/auth" className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
