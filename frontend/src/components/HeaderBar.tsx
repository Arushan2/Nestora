import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import type { User, UserRole } from '../types/session';
import { Heart, ShoppingCart, ClipboardList, MessageSquare, LayoutDashboard, LogOut, User as UserIcon } from 'lucide-react';
import { useCart } from '../lib/cartStore';

interface HeaderBarProps {
  user?: User | null;
  role?: UserRole | null;
  onLogout?: () => Promise<void>;
}

export function HeaderBar({ user, role, onLogout }: HeaderBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const cart = useCart();
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside dropdown handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine the effective role
  const effectiveRole = role ?? user?.role;
  const isPending = user?.application?.status === 'pending' && effectiveRole === 'user';
  const isPro = effectiveRole === 'service_provider' || effectiveRole === 'product_seller';
  const isAdmin = effectiveRole === 'admin';

  // Avatar Initials
  const nameToUse = user?.name || 'User';
  const initials = nameToUse
    .split(' ')
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Avatar Image URL (from Pro Application if approved/present)
  const avatarUrl = user?.application?.logo_url;

  const handleDropdownItemClick = (to: string) => {
    setDropdownOpen(false);
    navigate(to);
  };

  return (
    <header className="relative flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/85 px-4 py-2.5 shadow-sm backdrop-blur z-50">
      <Link to="/" className="font-display text-xl font-bold text-ink-900 tracking-tight hover:opacity-90 transition-opacity">
        Nestora
      </Link>

      <div className="flex items-center gap-2.5">
        {/* Cart Shortcut Icon always visible */}
        {user && (
          <Link
            to="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-ink-100 bg-white/50 text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition-all shadow-sm"
            title="Shopping Cart"
          >
            <ShoppingCart className="h-4.5 w-4.5" />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-aura-600 font-display text-[10px] font-bold text-white ring-2 ring-white">
                {cartCount}
              </span>
            )}
          </Link>
        )}

        {user && (isPro || isAdmin) && (
          <Link
            to={isAdmin ? '/admin' : '/dashboard'}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink-100 bg-white/50 px-3.5 py-2 text-xs font-bold text-ink-700 shadow-sm transition-all hover:bg-ink-50 hover:text-ink-900"
            title="Dashboard Workspace"
          >
            <LayoutDashboard className="h-4 w-4 text-ink-600" />
            <span className="hidden xs:inline">Dashboard</span>
          </Link>
        )}

        {user ? (
          /* Logged In Premium Dropdown */
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-aura-500 to-purple-600 text-white shadow-md hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-aura-500/50"
              title="User menu"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-sm font-semibold tracking-wider">
                  {initials}
                </div>
              )}
            </button>

            {/* Premium Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-64 origin-top-right rounded-3xl border border-white bg-white/95 p-2.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200 z-50">
                <div className="px-3 py-2.5">
                  <p className="font-display text-sm font-bold text-ink-900 truncate">{user.name}</p>
                  <p className="text-[11px] font-medium text-ink-400 truncate">{user.email}</p>
                  <span className="mt-1.5 inline-flex rounded-full bg-ink-50 px-2 py-0.5 text-[9px] font-bold text-ink-600 uppercase tracking-wider">
                    {effectiveRole === 'service_provider'
                      ? 'Service Provider'
                      : effectiveRole === 'product_seller'
                        ? 'Material Seller'
                        : effectiveRole === 'admin'
                          ? 'Administrator'
                          : 'Member'}
                  </span>
                </div>

                <div className="my-1.5 border-t border-ink-50" />

                <div className="space-y-0.5">
                  <button
                    onClick={() => handleDropdownItemClick('/favourites')}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition-colors"
                  >
                    <Heart className="h-4 w-4 text-ink-400" />
                    Favourites
                  </button>

                  <button
                    onClick={() => handleDropdownItemClick('/orders')}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition-colors"
                  >
                    <ClipboardList className="h-4 w-4 text-ink-400" />
                    Orders
                  </button>

                  {/* Services Link - goes to /inquiries for regular users, or /dashboard?tab=services for pros */}
                  <button
                    onClick={() => handleDropdownItemClick(isPro ? '/dashboard?tab=services' : '/inquiries')}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition-colors"
                  >
                    <MessageSquare className="h-4 w-4 text-ink-400" />
                    Services
                  </button>

                   {(isPro || isAdmin) && (
                    <button
                      onClick={() => handleDropdownItemClick(isAdmin ? '/admin' : '/dashboard')}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-aura-600 hover:bg-aura-50 hover:text-aura-800 transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard Workspace
                    </button>
                  )}

                  {!isPro && !isAdmin && (
                    <button
                      onClick={() => handleDropdownItemClick(isPending ? '/' : '/join-as-pro')}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-aura-600 hover:bg-aura-50 hover:text-aura-800 transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      {isPending ? 'Pending review' : 'Join as Pro'}
                    </button>
                  )}

                  {isPro && (
                    <button
                      onClick={() => handleDropdownItemClick('/dashboard?tab=edit-profile')}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition-colors"
                    >
                      <UserIcon className="h-4 w-4 text-ink-400" />
                      Edit Profile
                    </button>
                  )}
                </div>

                <div className="my-1.5 border-t border-ink-50" />

                <button
                  onClick={async () => {
                    setDropdownOpen(false);
                    if (onLogout) await onLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Guest Join/Login Buttons */
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-ink-800 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
