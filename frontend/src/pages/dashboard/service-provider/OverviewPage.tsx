import { useEffect, useState } from 'react';
import { MiniCard } from '../../../components/MiniCard';
import { requestJson } from '../../../lib/api';
import type { User, ServiceListing } from '../../../types/session';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OverviewPageProps {
  user: User;
}

export function OverviewPage({ user }: OverviewPageProps) {
  const [listingsCount, setListingsCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCount() {
      try {
        const response = await requestJson<{ listings: ServiceListing[] }>('/api/service-listings?my_listings=true');
        setListingsCount(response.listings?.length ?? 0);
      } catch (err) {
        console.error('Failed to load listings for overview', err);
      }
    }
    void fetchCount();
  }, [user]);

  const membershipStatus = user.membership_status;
  const trialEndsAt = user.trial_ends_at;
  const cancelAtPeriodEnd = user.cancel_at_period_end;

  const trialDaysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  const trialEndFormatted = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="space-y-6">
      {/* Trial status notification */}
      {membershipStatus === 'trial_active' && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-aura-200 bg-gradient-to-r from-aura-50 to-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-aura-100">
              <Icons.Zap className="h-4 w-4 text-aura-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink-900">
                Free Trial Active
                {trialDaysRemaining !== null && (
                  <span className="ml-2 rounded-full bg-aura-100 px-2 py-0.5 text-xs font-semibold text-aura-700">
                    {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining
                  </span>
                )}
              </p>
              <p className="text-xs text-ink-500 mt-0.5">
                {cancelAtPeriodEnd
                  ? `Membership ends ${trialEndFormatted} · No annual charge`
                  : `Your free trial ends ${trialEndFormatted} · Then $29.99/year`}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard?tab=billing')}
            className="flex-shrink-0 rounded-xl border border-aura-200 bg-white px-3 py-1.5 text-xs font-semibold text-aura-700 transition hover:bg-aura-50"
          >
            Manage
          </button>
        </div>
      )}

      {/* Payment failed notification */}
      {membershipStatus === 'payment_failed' && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-100">
              <Icons.AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-900">Payment Failed</p>
              <p className="text-xs text-red-700 mt-0.5">Update your payment method to keep your membership active.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard?tab=billing')}
            className="flex-shrink-0 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
          >
            Fix Now
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <MiniCard title="Business Entity" value={user.application?.business_name ?? 'Individual Pro'} />
        <MiniCard title="Total Listed Services" value={listingsCount.toString()} />
        <MiniCard title="Verified Districts" value={(user.application as any)?.business_city ?? 'Colombo'} />
      </div>
      <div className="rounded-3xl bg-white p-6 border border-ink-200 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-ink-900">Tips for Construction Providers in Sri Lanka</h3>
        <ul className="mt-4 space-y-3 text-sm text-ink-600 list-disc list-inside">
          <li><strong>Update prices frequently:</strong> Because materials and wages fluctuate rapidly in Sri Lanka, keep your rates up to date to avoid BOQ discrepancies.</li>
          <li><strong>Detail your rate boundaries:</strong> Specify in the pricing description whether tools, scaffolding, helper costs, or basic materials are included in your Square Foot or Daily wage estimates.</li>
          <li><strong>Cover multiple districts:</strong> Expanding your serving districts to surrounding zones like Gampaha or Kalutara if you are based in Colombo will increase your booking flow.</li>
        </ul>
      </div>
    </div>
  );
}
