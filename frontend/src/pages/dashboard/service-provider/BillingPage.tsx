import { useState } from 'react';
import * as Icons from 'lucide-react';
import { requestJson } from '../../../lib/api';
import type { User } from '../../../types/session';

interface BillingPageProps {
  user: User;
}

export function BillingPage({ user }: BillingPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleManageBilling = async () => {
    setLoading(true);
    setError(null);
    try {
      // Send an empty object to trigger a POST request
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

  const subscriptionStatus = user.subscription_status || 'inactive';
  
  // Custom styling based on subscription status
  const getStatusDetails = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return {
          label: 'Active',
          colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <Icons.CheckCircle className="h-4 w-4 text-emerald-500" />,
        };
      case 'past_due':
        return {
          label: 'Past Due / Unpaid',
          colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <Icons.AlertTriangle className="h-4 w-4 text-amber-500" />,
        };
      case 'canceled':
      case 'cancelled':
        return {
          label: 'Canceled',
          colorClass: 'bg-red-50 text-red-700 border-red-200',
          icon: <Icons.XCircle className="h-4 w-4 text-red-500" />,
        };
      default:
        return {
          label: 'No Active Subscription',
          colorClass: 'bg-ink-100 text-ink-700 border-ink-200',
          icon: <Icons.HelpCircle className="h-4 w-4 text-ink-500" />,
        };
    }
  };

  const statusInfo = getStatusDetails(subscriptionStatus);

  return (
    <div className="space-y-6">
      {/* Premium Main Card */}
      <div className="relative overflow-hidden rounded-3xl border border-ink-200 bg-white p-6 md:p-8 shadow-sm">
        {/* Decorative subtle background gradient */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-aura-500/5 blur-[80px]" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-ember-500/5 blur-[80px]" />

        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <h3 className="font-display text-xl font-bold text-ink-900 md:text-2xl">Subscription & Plans</h3>
            <p className="max-w-xl text-sm leading-relaxed text-ink-600">
              Manage your subscription payments, change your billing settings, update payment methods, and view your historical invoices securely via Stripe.
            </p>
          </div>
          
          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-ink-900 px-6 py-4 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-950/20 disabled:pointer-events-none disabled:opacity-60"
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
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-in fade-in duration-250">
            <Icons.AlertOctagon className="h-5 w-5 shrink-0 text-red-500" />
            <div className="space-y-1">
              <p className="font-semibold">Unable to open Billing Portal</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Grid containing status and helpful portal details */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Status Card */}
        <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">Subscription Status</p>
          <div className="mt-4 flex items-center gap-3">
            <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${statusInfo.colorClass}`}>
              {statusInfo.icon}
              {statusInfo.label}
            </div>
          </div>
        </div>

        {/* Customer Portal Tip 1 */}
        <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-aura-100 text-aura-700">
            <Icons.Receipt className="h-4.5 w-4.5" />
          </div>
          <p className="mt-4 text-sm font-bold text-ink-900">Invoices & Receipts</p>
          <p className="mt-1 text-xs text-ink-500 leading-relaxed">
            Download pdf statements and receipts for tax or business accounting directly inside the Stripe portal.
          </p>
        </div>

        {/* Customer Portal Tip 2 */}
        <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember-100 text-ember-700">
            <Icons.Wallet2 className="h-4.5 w-4.5" />
          </div>
          <p className="mt-4 text-sm font-bold text-ink-900">Payment Methods</p>
          <p className="mt-1 text-xs text-ink-500 leading-relaxed">
            Add backup cards, change default payment methods, or update your credit card expiration dates.
          </p>
        </div>
      </div>
    </div>
  );
}
