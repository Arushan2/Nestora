import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { User } from '../../types/session';
import { DashboardLayout, SidebarOption } from '../../components/DashboardLayout';
import { ListingsPage } from './service-provider/ListingsPage';
import { InventoryPage } from './product-seller/InventoryPage';
import { SellerOrdersPage } from './product-seller/OrdersPage';
import { SellerPaymentsPage } from './product-seller/SellerPaymentsPage';
import { EditProfilePage } from './shared/EditProfilePage';


import { InquiryListAndDetail } from '../../components/InquiryListAndDetail';
import { ProviderCalendarView } from './service-provider/ProviderCalendarView';
import { BillingPage } from './service-provider/BillingPage';
import { AnalyticsDashboard } from './AnalyticsDashboard';

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

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const defaultTab = isServiceProvider ? 'listings' : 'inventory';
  const activeTab = tabParam || defaultTab;

  const setActiveTab = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const showSearch = activeTab === 'listings' || activeTab === 'inventory' || activeTab === 'orders';

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      options={options}
      activeOptionId={activeTab}
      onOptionSelect={setActiveTab}
      searchPlaceholder={isServiceProvider ? "Search listings..." : "Search products..."}
      searchQuery={showSearch ? searchQuery : ''}
      onSearchChange={showSearch ? setSearchQuery : undefined}
    >
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Pro Workspace</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">{label}</h1>
          <p className="mt-1 text-sm text-ink-600">
            Welcome back, {user.name}. Manage your business profile, service offerings, and pricing details.
          </p>
        </div>

        {activeTab === 'edit-profile' && (
          <EditProfilePage user={user} />
        )}

        {activeTab === 'calendar' && (
          <ProviderCalendarView user={user} />
        )}

        {activeTab === 'services' && (
          <div className="pt-2">
            <InquiryListAndDetail user={user} />
          </div>
        )}

        {activeTab === 'billing' && (
          <BillingPage user={user} />
        )}
          
        {activeTab === 'analytics' && (
          <AnalyticsDashboard />
        )}

        {isServiceProvider ? (
          <>
            {activeTab === 'listings' && (
              <ListingsPage user={user} searchQuery={searchQuery} />
            )}
          </>
        ) : (
          <>
            {activeTab === 'inventory' && (
              <InventoryPage user={user} searchQuery={searchQuery} />
            )}
            {activeTab === 'orders' && (
              <SellerOrdersPage user={user} searchQuery={searchQuery} />
            )}
            {activeTab === 'payments' && (
              <SellerPaymentsPage user={user} />
            )}
          </>
        )}

      </div>
    </DashboardLayout>
  );
}
