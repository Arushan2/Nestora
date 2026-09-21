import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { requestJson } from '../../lib/api';
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
  onUnauthorized,
}: {
  user: User;
  onLogout: () => Promise<void>;
  options: SidebarOption[];
  onUnauthorized?: (message: string) => void;
}) {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    async function verifyAccess() {
      setIsVerifying(true);
      setAuthError('');
      try {
        const response = await requestJson<{ authorized: boolean; role: string }>('/api/dashboard/verify');
        if (isMounted) {
          if (response.authorized && (response.role === 'service_provider' || response.role === 'product_seller' || response.role === 'admin')) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
            const msg = 'Access denied. You do not have permission to view the Pro Workspace.';
            setAuthError(msg);
            onUnauthorized?.(msg);
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthorized(false);
          const msg = err instanceof Error ? err.message : 'Access denied. Pro workspace verification failed.';
          setAuthError(msg);
          onUnauthorized?.(msg);
        }
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    }

    void verifyAccess();
    return () => {
      isMounted = false;
    };
  }, [user.id, onUnauthorized]);

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

  if (isVerifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-aura-200 border-t-aura-600" />
          <p className="font-display text-sm font-medium text-ink-600">Verifying workspace authorization...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-glow text-center space-y-5 border border-ink-100">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold text-ink-900">Access Denied</h2>
            <p className="text-sm text-ink-600 leading-relaxed">
              {authError || 'You do not have permission to view this workspace.'}
            </p>
          </div>
          <Button
            onClick={() => navigate('/', { replace: true })}
            className="w-full bg-ink-900 hover:bg-ink-800 text-white"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

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
