import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, ShoppingCart, Package, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { requestJson } from '../lib/api';
import type { User, UserRole } from '../types/session';

interface HeaderBarProps {
  user?: User | null;
  role?: UserRole | null;
  onLogout?: () => Promise<void>;
}

export function HeaderBar({ user, role, onLogout }: HeaderBarProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const [cartCount, setCartCount] = useState(0);
  const [favCount, setFavCount] = useState(0);

  // Fetch counts dynamically if user is signed in
  useEffect(() => {
    if (!user) return;

    async function fetchCounts() {
      try {
        const cartRes = (await requestJson('/api/cart')) as any;
        if (cartRes.items) {
          const count = cartRes.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
          setCartCount(count);
        }
      } catch (err) {
        console.error('Error fetching cart count:', err);
      }

      try {
        const favRes = (await requestJson('/api/favorites')) as any;
        if (favRes.favorites) {
          setFavCount(favRes.favorites.length);
        }
      } catch (err) {
        console.error('Error fetching favorites count:', err);
      }
    }

    void fetchCounts();

    const handleUpdate = () => {
      void fetchCounts();
    };

    window.addEventListener('cart-updated', handleUpdate);
    window.addEventListener('favorites-updated', handleUpdate);

    return () => {
      window.removeEventListener('cart-updated', handleUpdate);
      window.removeEventListener('favorites-updated', handleUpdate);
    };
  }, [user]);

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
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-white/70 bg-white/85 px-6 py-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <Link to="/" className="font-display text-2xl font-bold tracking-tight text-ink-900 transition-colors hover:text-aura-600">
          Nestora
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Nav Links */}
        <div className="flex items-center gap-2">
          {isAtHome ? (
            <Link
              to={actionTo}
              className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition-all hover:bg-ink-50 hover:text-ink-950 shadow-sm"
            >
              {actionLabel}
            </Link>
          ) : (
            <Link
              to="/"
              className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition-all hover:bg-ink-50 hover:text-ink-950 shadow-sm"
            >
              Home
            </Link>
          )}

          {user && (
            <Link
              to="/my-orders"
              className={`flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition-all hover:bg-ink-50 hover:text-ink-950 shadow-sm ${
                currentPath === '/my-orders' ? 'bg-ink-100 text-ink-950 border-ink-400' : ''
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Orders</span>
            </Link>
          )}
        </div>

        {/* Favorites and Cart Icons */}
        {user && (
          <div className="flex items-center gap-3 border-l border-ink-200 pl-4">
            {/* Favorites Icon */}
            <Link
              to="/favorites"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 hover:text-red-500 transition-all shadow-sm"
              title="My Favorites"
            >
              <Heart className={`h-5 w-5 ${favCount > 0 ? 'fill-red-500 text-red-500' : ''}`} />
              {favCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                  {favCount}
                </span>
              )}
            </Link>

            {/* Cart Icon */}
            <Link
              to="/cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 hover:text-aura-600 transition-all shadow-sm"
              title="Shopping Cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ember-500 text-[9px] font-bold text-white ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        )}

        {/* User Auth Buttons */}
        <div className="flex items-center gap-2">
          {user || role ? (
            onLogout ? (
              <Button
                variant="outline"
                onClick={onLogout}
                className="flex items-center gap-1.5 rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            ) : null
          ) : (
            <Link to="/auth" className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 transition-colors shadow-md">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

