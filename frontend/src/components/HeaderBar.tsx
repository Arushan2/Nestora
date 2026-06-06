import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import type { User, UserRole } from '../types/session';
import { Heart, ShoppingCart, ClipboardList } from 'lucide-react';
import { useCart, useFavourites } from '../lib/cartStore';

interface HeaderBarProps {
  user?: User | null;
  role?: UserRole | null;
  onLogout?: () => Promise<void>;
}

export function HeaderBar({ user, role, onLogout }: HeaderBarProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const cart = useCart();
  const favourites = useFavourites();

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const favCount = favourites.length;

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
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
      <Link to="/" className="font-display text-xl font-semibold text-ink-900">
        Nestora
      </Link>
      
      <div className="flex items-center gap-3">
        {/* Favourites Shortcut Button */}
        <Link
          to="/favourites"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 hover:bg-ink-100 hover:text-ink-900 transition-colors"
          title="Saved Items"
        >
          <Heart className="h-4.5 w-4.5" />
          {favCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 font-display text-[9px] font-bold text-white ring-2 ring-white">
              {favCount}
            </span>
          )}
        </Link>

        {/* Cart Shortcut Button */}
        <Link
          to="/cart"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 hover:bg-ink-100 hover:text-ink-900 transition-colors"
          title="Shopping Cart"
        >
          <ShoppingCart className="h-4.5 w-4.5" />
          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-aura-500 font-display text-[9px] font-bold text-white ring-2 ring-white animate-pulse">
              {cartCount}
            </span>
          )}
        </Link>

        {/* My Orders (Customer Profile) Button */}
        {user && (
          <Link
            to="/orders"
            className="flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-700 hover:bg-ink-100 transition-colors"
            title="Purchase History"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">My Orders</span>
          </Link>
        )}

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
