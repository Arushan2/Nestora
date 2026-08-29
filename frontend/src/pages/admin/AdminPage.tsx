import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { requestJson } from '../../lib/api';
import type { AdminUser, PendingApplication, User } from '../../types/session';
import { DashboardLayout, SidebarOption } from '../../components/DashboardLayout';
import { PaymentsPanel } from './PaymentsPanel';

export function AdminPage({
  user,
  onLogout,
  options,
}: {
  user: User;
  onLogout: () => Promise<void>;
  options: SidebarOption[];
}) {
  const [applications, setApplications] = useState<PendingApplication[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<PendingApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('applications');
  const [searchQuery, setSearchQuery] = useState('');
  const [approvingId, setApprovingId] = useState<number | null>(null);

  async function loadApplications() {
    setLoading(true);

    try {
      const response = await requestJson<PendingApplication[]>('/api/admin/pending-applications');
      setApplications((response.applications as PendingApplication[]) ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load pending requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  async function handleApprove(applicationId: number): Promise<boolean> {
    try {
      setApprovingId(applicationId);
      setError('');
      await requestJson(`/api/admin/applications/${applicationId}/approve`, {});
      await loadApplications();
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to approve application.');
      return false;
    } finally {
      setApprovingId(null);
    }
  }

  const filteredApplications = applications.filter((app) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      app.business_name.toLowerCase().includes(query) ||
      app.user_name.toLowerCase().includes(query) ||
      app.user_email.toLowerCase().includes(query) ||
      app.business_city.toLowerCase().includes(query) ||
      app.application_type.toLowerCase().includes(query)
    );
  });

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      options={options}
      activeOptionId={activeTab}
      onOptionSelect={(id) => {
        setActiveTab(id);
        setSearchQuery('');
      }}
      searchPlaceholder={activeTab === 'users' ? 'Search users by name or email...' : 'Search requests...'}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="space-y-6">
        {activeTab === 'applications' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Admin</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">Pending Pro Requests</h1>
              <p className="mt-1 text-sm text-ink-600">Approve service provider and product seller requests from here.</p>
            </div>

            {loading ? <p className="text-sm text-ink-600">Loading requests...</p> : null}
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <div className="space-y-4">
              {filteredApplications.length === 0 && !loading ? (
                <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-sm text-ink-600">
                    {searchQuery ? 'No matching requests found.' : 'No pending requests.'}
                  </p>
                </div>
              ) : null}
              {filteredApplications.map((application) => (
                <article key={application.id} className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-aura-600">
                        {application.application_type.replace('_', ' ')}
                      </p>
                      <h2 className="mt-1 font-display text-xl font-bold text-ink-900">{application.business_name}</h2>
                      <p className="mt-1 text-xs text-ink-600">
                        {application.user_name} - {application.user_email}
                      </p>
                      <p className="mt-1.5 text-xs font-medium text-ink-500">{application.business_city}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedApplication(application)}
                        className="rounded-full text-xs"
                      >
                        View Details
                      </Button>
                      <Button
                        disabled={approvingId !== null}
                        onClick={() => void handleApprove(application.id)}
                        className="rounded-full text-xs bg-ink-900 text-white hover:bg-ink-800 flex items-center gap-1.5 min-w-[90px] justify-center"
                      >
                        {approvingId === application.id ? (
                          <>
                            <Icons.Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Approve
                          </>
                        ) : (
                          'Approve'
                        )}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <UsersPanel searchQuery={searchQuery} />
        )}

        {activeTab === 'payments' && (
          <PaymentsPanel searchQuery={searchQuery} />
        )}
      </div>

      <Dialog isOpen={!!selectedApplication} onClose={() => setSelectedApplication(null)}>
        {selectedApplication ? (
          <>
            <DialogHeader>
              <div className="mb-2">
                <span className="inline-flex items-center rounded-full bg-aura-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink-900">
                  {selectedApplication.application_type.replace('_', ' ')}
                </span>
              </div>
              <DialogTitle>{selectedApplication.business_name}</DialogTitle>
              <DialogDescription>
                Submitted by {selectedApplication.user_name} ({selectedApplication.user_email}) on{' '}
                {new Date(selectedApplication.created_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 max-h-[60vh] overflow-y-auto pr-2 space-y-6">
              {/* Business Info Grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem label="Email" value={selectedApplication.business_email} />
                <DetailItem label="Phone" value={selectedApplication.business_phone} />
                <DetailItem label="Address" value={selectedApplication.business_address} />
                <DetailItem label="City" value={selectedApplication.business_city} />
              </div>

              {selectedApplication.application_type === 'product_seller' && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/10 p-4 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800 block border-b border-emerald-200/55 pb-1">Sri Lankan Bank Account Details</span>
                  <div className="grid gap-3 sm:grid-cols-2 text-sm text-ink-805">
                    <div><span className="font-semibold text-ink-400 text-[10px] block uppercase tracking-wider">Bank</span>{(selectedApplication as any).bank_name || 'N/A'}</div>
                    <div><span className="font-semibold text-ink-400 text-[10px] block uppercase tracking-wider">Account Holder</span>{(selectedApplication as any).account_holder_name || 'N/A'}</div>
                    <div><span className="font-semibold text-ink-400 text-[10px] block uppercase tracking-wider">Account Number</span>{(selectedApplication as any).account_number || 'N/A'}</div>
                    <div><span className="font-semibold text-ink-400 text-[10px] block uppercase tracking-wider">Branch</span>{(selectedApplication as any).branch || 'N/A'}</div>
                  </div>
                </div>
              )}

              {/* Business Description */}
              {selectedApplication.business_description ? (
                <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Business Description</span>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-800">{selectedApplication.business_description}</p>
                </div>
              ) : null}

              {/* Document Section */}
              <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Uploaded Document</span>
                    <p className="mt-0.5 text-sm text-ink-800">
                      {selectedApplication.document_type || 'Registration Document'}{' '}
                      {selectedApplication.document_number ? `(#${selectedApplication.document_number})` : ''}
                    </p>
                  </div>
                  {selectedApplication.document_file ? (
                    <Button
                      variant="outline"
                      onClick={() => window.open(selectedApplication.document_file, '_blank', 'noopener')}
                    >
                      Open Document
                    </Button>
                  ) : null}
                </div>

                {selectedApplication.document_file ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-ink-200 bg-white flex justify-center">
                    <img
                      src={selectedApplication.document_file}
                      alt="Uploaded Document"
                      className="max-h-64 object-contain p-2 hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                      onClick={() => window.open(selectedApplication.document_file, '_blank', 'noopener')}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-sm italic text-ink-500">No document file uploaded.</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedApplication(null)}>
                Close
              </Button>
              <Button
                disabled={approvingId !== null}
                onClick={async () => {
                  const success = await handleApprove(selectedApplication.id);
                  if (success) {
                    setSelectedApplication(null);
                  }
                }}
              >
                {approvingId === selectedApplication.id ? (
                  <span className="flex items-center gap-2">
                    <Icons.Loader2 className="h-4 w-4 animate-spin" />
                    Approving...
                  </span>
                ) : (
                  'Approve Request'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </Dialog>
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────
// USERS PANEL
// ─────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'user', label: 'Regular User' },
  { value: 'service_provider', label: 'Service Pro' },
  { value: 'product_seller', label: 'Product Seller' },
  { value: 'admin', label: 'Admin' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'banned', label: 'Banned' },
];

const PRO_STATUS_OPTIONS = [
  { value: '', label: 'Any Pro Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const JOINED_OPTIONS = [
  { value: '', label: 'Any Time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const BAN_DURATION_OPTIONS = [
  { label: '1 Day', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: '30 Days', days: 30 },
];

function UsersPanel({ searchQuery }: { searchQuery: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [proStatusFilter, setProStatusFilter] = useState('');
  const [joinedFilter, setJoinedFilter] = useState('');

  // Ban modal
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDays, setBanDays] = useState(7);
  const [banActionLoading, setBanActionLoading] = useState(false);
  const [banError, setBanError] = useState('');

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (proStatusFilter) params.set('pro_status', proStatusFilter);
      if (joinedFilter) params.set('joined', joinedFilter);
      if (searchQuery) params.set('search', searchQuery);

      const qs = params.toString();
      const response = await requestJson<AdminUser[]>(`/api/admin/users${qs ? '?' + qs : ''}`);
      setUsers((response.users as AdminUser[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [roleFilter, statusFilter, proStatusFilter, joinedFilter, searchQuery]);

  async function handleBan() {
    if (!banTarget) return;
    setBanError('');
    if (!banReason.trim()) { setBanError('Please enter a reason.'); return; }

    setBanActionLoading(true);
    try {
      const bannedUntil = new Date(Date.now() + banDays * 24 * 60 * 60 * 1000).toISOString();
      await requestJson(`/api/admin/users/${banTarget.id}/ban`, { reason: banReason, banned_until: bannedUntil });
      setBanTarget(null);
      setBanReason('');
      setBanDays(7);
      await loadUsers();
    } catch (e) {
      setBanError(e instanceof Error ? e.message : 'Failed to ban user.');
    } finally {
      setBanActionLoading(false);
    }
  }

  async function handleUnban(userId: number) {
    try {
      await requestJson(`/api/admin/users/${userId}/unban`, {});
      await loadUsers();
    } catch {
      // silently retry or show toast in future
    }
  }

  const isCurrentlyBanned = (u: AdminUser) =>
    !!u.banned_until && new Date(u.banned_until) > new Date();

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return { label: 'Admin', className: 'bg-purple-100 text-purple-800' };
      case 'service_provider':
        return { label: 'Service Pro', className: 'bg-aura-100 text-aura-800' };
      case 'product_seller':
        return { label: 'Product Seller', className: 'bg-emerald-100 text-emerald-800' };
      default:
        return { label: 'User', className: 'bg-ink-100 text-ink-700' };
    }
  };

  const getProStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending':
        return { label: 'Pro: Pending', className: 'bg-amber-100 text-amber-800' };
      case 'approved':
        return { label: 'Pro: Approved', className: 'bg-green-100 text-green-800' };
      case 'rejected':
        return { label: 'Pro: Rejected', className: 'bg-red-100 text-red-800' };
      default:
        return null;
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-aura-500', 'bg-emerald-500', 'bg-amber-500',
      'bg-purple-500', 'bg-rose-500', 'bg-cyan-500',
    ];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Admin</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">Users</h1>
          <p className="mt-1 text-sm text-ink-600">
            View and manage all registered users. Apply filters to narrow results.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {/* Role filter — pill tabs */}
            <div className="flex items-center gap-1 rounded-xl bg-ink-50 p-1">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRoleFilter(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    roleFilter === opt.value
                      ? 'bg-ink-900 text-white shadow-sm'
                      : 'text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Status filter — pill tabs */}
            <div className="flex items-center gap-1 rounded-xl bg-ink-50 p-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    statusFilter === opt.value
                      ? opt.value === 'banned'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-ink-900 text-white shadow-sm'
                      : 'text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Pro Status dropdown */}
            <div className="relative">
              <select
                value={proStatusFilter}
                onChange={(e) => setProStatusFilter(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-ink-200 bg-white pl-3 pr-8 text-xs font-semibold text-ink-700 shadow-sm outline-none focus:border-ink-400 focus:ring-2 focus:ring-ink-900/10"
              >
                {PRO_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <Icons.ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            </div>

            {/* Joined Date dropdown */}
            <div className="relative">
              <select
                value={joinedFilter}
                onChange={(e) => setJoinedFilter(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-ink-200 bg-white pl-3 pr-8 text-xs font-semibold text-ink-700 shadow-sm outline-none focus:border-ink-400 focus:ring-2 focus:ring-ink-900/10"
              >
                {JOINED_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <Icons.ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            </div>

            {/* Clear filters */}
            {(roleFilter || statusFilter || proStatusFilter || joinedFilter) && (
              <button
                onClick={() => { setRoleFilter(''); setStatusFilter(''); setProStatusFilter(''); setJoinedFilter(''); }}
                className="flex items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-500 hover:bg-ink-50 transition-colors"
              >
                <Icons.X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Status messages */}
        {loading && (
          <div className="flex items-center gap-3 text-sm text-ink-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-ink-600" />
            Loading users...
          </div>
        )}
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        {/* User count */}
        {!loading && !error && (
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
            {users.length} {users.length === 1 ? 'user' : 'users'} found
          </p>
        )}

        {/* User Cards */}
        <div className="space-y-3">
          {!loading && users.length === 0 && !error && (
            <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-10 text-center shadow-sm">
              <Icons.Users className="mx-auto mb-3 h-8 w-8 text-ink-300" />
              <p className="text-sm text-ink-500">No users match the current filters.</p>
            </div>
          )}

          {users.map((u) => {
            const banned = isCurrentlyBanned(u);
            const roleBadge = getRoleBadge(u.role);
            const proBadge = getProStatusBadge(u.application_status);
            const avatarColor = getAvatarColor(u.name);

            return (
              <article
                key={u.id}
                className={`rounded-3xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                  banned ? 'border-red-200 bg-red-50/30' : 'border-ink-200'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Avatar + Info */}
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-base font-bold text-white shadow-sm ${avatarColor}`}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-sm font-bold text-ink-900">{u.name}</p>

                        {/* Role badge */}
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleBadge.className}`}>
                          {roleBadge.label}
                        </span>

                        {/* Pro application badge */}
                        {proBadge && (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${proBadge.className}`}>
                            {proBadge.label}
                          </span>
                        )}

                        {/* Banned badge */}
                        {banned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                            <Icons.Ban className="h-3 w-3" />
                            Banned
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 text-xs text-ink-500">{u.email}</p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-400">
                        <span className="flex items-center gap-1">
                          <Icons.CalendarDays className="h-3 w-3" />
                          Joined {new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>

                        {u.business_name && (
                          <span className="flex items-center gap-1">
                            <Icons.Building2 className="h-3 w-3" />
                            {u.business_name}
                          </span>
                        )}

                        {banned && u.banned_until && (
                          <span className="flex items-center gap-1 font-semibold text-red-500">
                            <Icons.Clock className="h-3 w-3" />
                            Until {new Date(u.banned_until).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            {u.ban_reason && ` · "${u.ban_reason}"`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex shrink-0 items-center gap-2 sm:ml-4">
                    {banned ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleUnban(u.id)}
                        className="rounded-full text-xs border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <Icons.ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        Unban
                      </Button>
                    ) : u.role !== 'admin' ? (
                      <Button
                        variant="outline"
                        onClick={() => { setBanTarget(u); setBanReason(''); setBanDays(7); setBanError(''); }}
                        className="rounded-full text-xs border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Icons.Ban className="mr-1.5 h-3.5 w-3.5" />
                        Ban
                      </Button>
                    ) : (
                      <span className="text-[11px] font-semibold text-ink-300 italic">Protected</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Ban Modal */}
      <Dialog isOpen={!!banTarget} onClose={() => { setBanTarget(null); setBanError(''); }}>
        {banTarget ? (
          <>
            <DialogHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
                <Icons.Ban className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle>Temporarily Ban User</DialogTitle>
              <DialogDescription>
                You are banning <strong>{banTarget.name}</strong> ({banTarget.email}). Please provide a duration and reason.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-5">
              {/* Duration selector */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Ban Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {BAN_DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      onClick={() => setBanDays(opt.days)}
                      className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                        banDays === opt.days
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-ink-400">
                  Ban will expire on{' '}
                  <strong className="text-ink-600">
                    {new Date(Date.now() + banDays * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </strong>
                </p>
              </div>

              {/* Reason */}
              <div>
                <label htmlFor="ban-reason" className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="ban-reason"
                  rows={3}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="e.g. Violation of community guidelines, spam activity..."
                  className="w-full resize-none rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-900 placeholder-ink-400 outline-none transition-all focus:border-ink-400 focus:bg-white focus:ring-2 focus:ring-red-500/10"
                />
              </div>

              {banError && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                  <Icons.AlertCircle className="h-3.5 w-3.5" />
                  {banError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setBanTarget(null); setBanError(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleBan()}
                disabled={banActionLoading}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {banActionLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Banning...
                  </span>
                ) : (
                  <>
                    <Icons.Ban className="mr-1.5 h-4 w-4" />
                    Confirm Ban
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">{label}</span>
      <p className="mt-1 text-sm font-medium text-ink-900">{value || '-'}</p>
    </div>
  );
}
