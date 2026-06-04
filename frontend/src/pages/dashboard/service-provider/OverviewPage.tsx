import { useEffect, useState } from 'react';
import { MiniCard } from '../../../components/MiniCard';
import { requestJson } from '../../../lib/api';
import type { User, ServiceListing } from '../../../types/session';

interface OverviewPageProps {
  user: User;
}

export function OverviewPage({ user }: OverviewPageProps) {
  const [listingsCount, setListingsCount] = useState(0);

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

  return (
    <div className="space-y-6">
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
