import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { requestJson } from '../../../lib/api';
import type { User } from '../../../types/session';

interface MembershipData {
  membership_status: string;
  subscription_status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  cancel_at_period_end: boolean;
  last_payment_status: string | null;
  has_stripe_customer: boolean;
}

interface BillingPageProps {
  user: User;
}

export function BillingPage({ user }: BillingPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipData | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);

  useEffect(() => {
    async function fetchMembership() {
      try {
        const res = await requestJson<MembershipData>('/api/subscriptions/membership');
        setMembership(res as unknown as MembershipData);
      } catch (e) {
        // ignore — use user object as fallback
      } finally {
        setMembershipLoading(false);
      }
    }
    void fetchMembership();
  }, []);

  const handleManageBilling = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = (await requestJson('/api/subscriptions/portal', {})) as any;
      if (response && response.url) {
        window.location.href = response.url;
      } else {
        throw new Error('Failed to retrieve the billing portal link from the server.');
      }
    } catch (err: any) {
      console.error('Stripe billing portal session error:', err);
      setError(err?.message ?? 'An unexpected error occurred while redirecting to the billing portal.');
    } finally {
      setLoading(false);
    }
  };

  const membershipStatus = membership?.membership_status ?? (user.membership_status || 'not_started');
  const trialDaysRemaining = membership?.trial_days_remaining ?? null;
  const trialEndsAt = membership?.trial_ends_at ?? user.trial_ends_at ?? null;
  const subscriptionEndsAt = membership?.subscription_ends_at ?? user.subscription_ends_at ?? null;
  const cancelAtPeriodEnd = membership?.cancel_at_period_end ?? user.cancel_at_period_end ?? false;

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'trial_active':
        return {
          label: 'Free Trial Active',
          colorClass: 'bg-aura-50 text-aura-700 border-aura-200',
          icon: <Icons.Zap className="h-4 w-4 text-aura-500" />,
        };
      case 'active':
        return {
          label: 'Active',
          colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <Icons.CheckCircle className="h-4 w-4 text-emerald-500" />,
        };
      case 'payment_failed':
        return {
          label: 'Payment Failed',
          colorClass: 'bg-red-50 text-red-700 border-red-200',
          icon: <Icons.AlertTriangle className="h-4 w-4 text-red-500" />,
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          colorClass: 'bg-red-50 text-red-700 border-red-200',
          icon: <Icons.XCircle className="h-4 w-4 text-red-500" />,
        };
      case 'expired':
        return {
          label: 'Expired',
          colorClass: 'bg-ink-100 text-ink-700 border-ink-200',
          icon: <Icons.Clock className="h-4 w-4 text-ink-500" />,
        };
      default:
        return {
          label: 'Not Active',
          colorClass: 'bg-ink-100 text-ink-700 border-ink-200',
          icon: <Icons.HelpCircle className="h-4 w-4 text-ink-500" />,
        };
    }
  };

  const statusConfig = getStatusConfig(membershipStatus);

  return (
    <div className="space-y-6">
      {/* Payment Failed Banner */}
      {membershipStatus === 'payment_failed' && (
        <div className="flex items-start gap-4 rounded-3xl border border-red-200 bg-red-50 p-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-100">
            <Icons.AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-red-900">Payment Failed</h4>
            <p className="mt-1 text-xs leading-relaxed text-red-700">
              We couldn't process your annual membership payment. Please update your payment method to continue
              your Service Provider membership.
            </p>
            <button
              onClick={handleManageBilling}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              <Icons.CreditCard className="h-3.5 w-3.5" />
              Update Payment Method
            </button>
          </div>
        </div>
      )}

      {/* Trial Active Banner */}
      {membershipStatus === 'trial_active' && (
        <div className="flex items-start gap-4 rounded-3xl border border-aura-200 bg-gradient-to-br from-aura-50 to-white p-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-aura-100">
            <Icons.Zap className="h-5 w-5 text-aura-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-ink-900">Free Trial Active</h4>
              {trialDaysRemaining !== null && (
                <span className="rounded-full bg-aura-100 px-2.5 py-1 text-xs font-bold text-aura-700">
                  {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-600">
              Your free trial ends on <strong>{formatDate(trialEndsAt)}</strong>.
              {cancelAtPeriodEnd
                ? ' Your membership is scheduled to end at trial expiry. No annual charge will be made.'
                : ' After your trial, $29.99/year will be charged automatically.'}
            </p>
            {cancelAtPeriodEnd && (
              <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 font-medium">
                <Icons.Info className="inline h-3.5 w-3.5 mr-1" />
                Membership scheduled to end on {formatDate(trialEndsAt)}. No annual charge will be made.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancelled Banner */}
      {(membershipStatus === 'cancelled' || membershipStatus === 'expired') && (
        <div className="flex items-start gap-4 rounded-3xl border border-ink-200 bg-ink-50 p-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ink-100">
            <Icons.XCircle className="h-5 w-5 text-ink-500" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-ink-900">Membership Ended</h4>
            <p className="mt-1 text-xs leading-relaxed text-ink-600">
              Your Service Provider membership has ended. Your business profile data is preserved.
            </p>
          </div>
        </div>
      )}

      {/* Main subscription card */}
      <div className="relative overflow-hidden rounded-3xl border border-ink-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-aura-500/5 blur-[80px]" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-ember-500/5 blur-[80px]" />

        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-1">
            <h3 className="font-display text-xl font-bold text-ink-900 md:text-2xl">Subscription & Plans</h3>
            <p className="text-sm leading-relaxed text-ink-600 max-w-xl">
              Service Provider Annual Membership — $29.99/year after the 30-day free trial.
              Manage billing, update payment methods, and view invoices via the Stripe portal.
            </p>
          </div>

          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-ink-900 px-6 py-4 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-950/20 disabled:pointer-events-none disabled:opacity-60 flex-shrink-0"
          >
            {loading ? (
              <>
                <Icons.Loader2 className="h-4 w-4 animate-spin text-aura-400" />
                <span>Connecting to Stripe...</span>
              </>
            ) : (
              <>
                <Icons.CreditCard className="h-4 w-4 text-aura-400" />
                <span>Manage Billing & Invoices</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <Icons.AlertOctagon className="h-5 w-5 shrink-0 text-red-500" />
            <div className="space-y-1">
              <p className="font-semibold">Unable to open Billing Portal</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Detail cards grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Status */}
        <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">Membership Status</p>
          <div className="mt-4">
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${statusConfig.colorClass}`}>
              {statusConfig.icon}
              {statusConfig.label}
            </div>
          </div>
          {membershipStatus === 'trial_active' && trialDaysRemaining !== null && (
            <p className="mt-3 text-xs text-ink-500">
              {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining in trial
            </p>
          )}
          {membershipStatus === 'active' && subscriptionEndsAt && (
            <p className="mt-3 text-xs text-ink-500">Renews {formatDate(subscriptionEndsAt)}</p>
          )}
        </div>

        {/* Plan details */}
        <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-aura-100 text-aura-700">
            <Icons.Star className="h-4 w-4" />
          </div>
          <p className="mt-4 text-sm font-bold text-ink-900">Annual Membership</p>
          <p className="mt-1 text-xs text-ink-500 leading-relaxed">
            {membershipStatus === 'trial_active'
              ? `Trial ends ${formatDate(trialEndsAt)} · Then $29.99/year`
              : membershipStatus === 'active'
              ? `Active until ${formatDate(subscriptionEndsAt)} · $29.99/year`
              : 'Service Provider Annual Membership — $29.99/year'}
          </p>
        </div>

        {/* Invoices tip */}
        <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember-100 text-ember-700">
            <Icons.Receipt className="h-4 w-4" />
          </div>
          <p className="mt-4 text-sm font-bold text-ink-900">Invoices & Receipts</p>
          <p className="mt-1 text-xs text-ink-500 leading-relaxed">
            Download PDF statements and receipts for tax or business accounting directly inside the Stripe portal.
          </p>
        </div>
      </div>
    </div>
  );
}
