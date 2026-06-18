import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import type { User } from '../types/session';
import { requestJson } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export interface SidebarOption {
  id: string;
  label: string;
  iconName: string;
}

interface DashboardLayoutProps {
  user: User;
  onLogout: () => Promise<void>;
  options: SidebarOption[];
  activeOptionId: string;
  onOptionSelect: (id: string) => void;
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  children: React.ReactNode;
}

const DynamicIcon = ({ name, className }: { name: string; className?: string }) => {
  const IconComponent = (Icons as any)[name];
  if (!IconComponent) return <Icons.HelpCircle className={className} />;
  return <IconComponent className={className} />;
};

export function DashboardLayout({
  user,
  onLogout,
  options,
  activeOptionId,
  onOptionSelect,
  searchPlaceholder = 'Search...',
  searchQuery = '',
  onSearchChange,
  children,
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  interface Notification {
    id: number;
    title: string;
    desc: string;
    read: boolean;
    created_at: string;
    link?: string;
  }

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = async () => {
    try {
      const res = await requestJson<any>('/api/notifications') as any;
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const markAllAsRead = async () => {
    try {
      await requestJson('/api/notifications/mark-read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };

  const markAsRead = async (id: number, link?: string) => {
    try {
      await requestJson('/api/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ id })
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      if (link) {
        navigate(link);
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    try {
      const date = new Date(dateString.replace(' ', 'T') + 'Z');
      const now = new Date();
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch (e) {
      return dateString;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'service_provider':
        return 'Service Pro';
      case 'product_seller':
        return 'Product Merchant';
      default:
        return 'User';
    }
  };

  const getAvatarFallback = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-50 font-sans">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-aura-500/10 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-ember-500/800 bg-opacity-[0.08] blur-[120px]" />
      </div>

      {/* MOBILE SIDEBAR OVERLAY */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* LEFT SIDEBAR - DESKTOP & MOBILE OVERLAY */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-ink-200/60 bg-white/90 shadow-xl backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* LOGO SECTION */}
        <div className="flex h-20 items-center justify-between border-b border-ink-100 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-white shadow-md">
              <Icons.Home className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight text-ink-900">Nestora</h1>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-aura-600">Workspace</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-100 lg:hidden"
          >
            <Icons.X className="h-4 w-4" />
          </button>
        </div>

        {/* SIDEBAR NAVIGATION OPTIONS */}
        <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-ink-400">
            Navigation Menu
          </div>
          {options.map((option) => {
            const isActive = option.id === activeOptionId;
            return (
              <button
                key={option.id}
                onClick={() => {
                  onOptionSelect(option.id);
                  setIsMobileSidebarOpen(false);
                }}
                className={`group flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-ink-900 text-white shadow-md'
                    : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900'
                }`}
              >
                <DynamicIcon
                  name={option.iconName}
                  className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-aura-400' : 'text-ink-400 group-hover:text-ink-700'
                  }`}
                />
                {option.label}
                {isActive && (
                  <Icons.ChevronRight className="ml-auto h-4 w-4 text-white/60" />
                )}
              </button>
            );
          })}
        </nav>

        {/* USER PROFILE SECTION AT BOTTOM */}
        <div className="border-t border-ink-100 p-4 bg-ink-50/50">
          <div className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3 shadow-sm">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aura-500 font-display text-sm font-bold text-white shadow-inner">
              {getAvatarFallback(user.name)}
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink-900">{user.name}</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                {getRoleLabel(user.role)}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          >
            <Icons.LogOut className="h-4 w-4" />
            Logout Account
          </button>
        </div>
      </aside>

      {/* RIGHT SIDE MAIN VIEW WRAPPER */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TOP HEADER */}
        <header className="relative z-30 flex h-20 items-center justify-between border-b border-ink-200/60 bg-white/70 px-6 backdrop-blur-md">
          {/* LEFT: Search / Burger Menu */}
          <div className="flex flex-1 items-center gap-4">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 lg:hidden shadow-sm"
            >
              <Icons.Menu className="h-5 w-5" />
            </button>

            {onSearchChange ? (
              <div className="relative w-full max-w-md">
                <Icons.Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-ink-200 bg-white/50 pl-11 pr-4 text-sm text-ink-900 placeholder-ink-400 shadow-inner outline-none transition-all focus:border-ink-400 focus:bg-white focus:ring-2 focus:ring-ink-900/10"
                />
              </div>
            ) : (
              <div className="font-display text-sm font-semibold text-ink-500 hidden sm:block">
                Welcome to Nestora Business Hub
              </div>
            )}
          </div>

          {/* RIGHT: Notifications & External Site Link */}
          <div className="flex items-center gap-4">
            {/* View Site */}
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-semibold text-ink-700 shadow-sm transition-colors hover:bg-ink-50 sm:flex"
            >
              <Icons.ExternalLink className="h-3.5 w-3.5" />
              Visit Homepage
            </a>

            {/* Notifications Menu */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 shadow-sm transition-all focus:outline-none"
              >
                <Icons.Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-ember-500 font-display text-[9px] font-bold text-white ring-2 ring-white animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* DROPDOWN NOTIFICATIONS BOX */}
              {isNotificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[90]"
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 z-[100] w-80 rounded-2xl border border-ink-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-3 duration-200">
                    <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                      <span className="font-display text-xs font-bold text-ink-900">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[10px] font-bold text-aura-600 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="mt-2 max-h-64 overflow-y-auto space-y-2.5 py-1">
                      {notifications.length === 0 ? (
                        <p className="py-6 text-center text-xs text-ink-500">No notifications.</p>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => markAsRead(notif.id, notif.link)}
                            className={`rounded-xl p-2.5 transition-colors cursor-pointer hover:bg-ink-50/80 ${
                              notif.read ? 'bg-white' : 'bg-aura-50/40 border-l-2 border-aura-500'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <span className="font-sans text-xs font-bold text-ink-900">
                                {notif.title}
                              </span>
                              <span className="text-[9px] font-medium text-ink-400">
                                {formatTimeAgo(notif.created_at)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-ink-600 leading-relaxed">
                              {notif.desc}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* MAIN SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
