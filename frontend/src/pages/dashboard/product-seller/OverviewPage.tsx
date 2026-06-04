import { MiniCard } from '../../../components/MiniCard';
import type { User } from '../../../types/session';

interface OverviewPageProps {
  user: User;
}

export function OverviewPage({ user }: OverviewPageProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <MiniCard title="Merchant Name" value={user.application?.business_name ?? 'Individual Seller'} />
        <MiniCard title="Store Location" value={(user.application as any)?.business_city ?? 'Colombo'} />
      </div>
      <div className="rounded-3xl bg-white p-6 border border-ink-200 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-ink-900">Tips for Material Sellers in Sri Lanka</h3>
        <ul className="mt-4 space-y-3 text-sm text-ink-600 list-disc list-inside">
          <li><strong>Logistics and delivery:</strong> Clearly mention if you offer transport/unloading services at site locations.</li>
          <li><strong>Bulk discounts:</strong> Highlight unit-level pricing drops for sand, gravel, cement, or bricks when bought in lorry/truck quantities.</li>
        </ul>
      </div>
    </div>
  );
}
