import { useState } from 'react';
import type { User } from '../../types/session';
import { DashboardLayout, SidebarOption } from '../../components/DashboardLayout';
import { ListingsPage } from './service-provider/ListingsPage';
import { OverviewPage as ServiceProviderOverviewPage } from './service-provider/OverviewPage';
import { InventoryPage } from './product-seller/InventoryPage';
import { OverviewPage as ProductSellerOverviewPage } from './product-seller/OverviewPage';
import { OrdersPage } from './product-seller/OrdersPage';

export function DashboardPage({
  user,
  onLogout,
  options,
}: {
  user: User;
  onLogout: () => Promise<void>;
  options: SidebarOption[];
}) {
  const isServiceProvider = user.role === 'service_provider';
  const label = isServiceProvider ? 'Service Provider Workspace' : 'Product Seller Workspace';

  const [activeTab, setActiveTab] = useState(isServiceProvider ? 'listings' : 'inventory');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      options={options}
      activeOptionId={activeTab}
      onOptionSelect={setActiveTab}
      searchPlaceholder={isServiceProvider ? "Search listings..." : "Search products..."}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Pro Workspace</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">{label}</h1>
          <p className="mt-1 text-sm text-ink-600">
            Welcome back, {user.name}. Manage your business profile, service offerings, and pricing details.
          </p>
        </div>

        {isServiceProvider ? (
          <>
            {activeTab === 'listings' && (
              <ListingsPage user={user} searchQuery={searchQuery} />
            )}
            {activeTab === 'overview' && (
              <ServiceProviderOverviewPage user={user} />
            )}
          </>
        ) : (
          <>
            {activeTab === 'inventory' && (
              <InventoryPage user={user} searchQuery={searchQuery} />
            )}
            {activeTab === 'orders' && (
              <OrdersPage user={user} />
            )}
            {activeTab === 'overview' && (
              <ProductSellerOverviewPage user={user} />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
