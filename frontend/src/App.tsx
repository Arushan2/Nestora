import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AdminPage } from './pages/admin/AdminPage';
import { AuthPage } from './pages/auth/AuthPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { HomePage } from './pages/home/HomePage';
import { ServiceDetailPage } from './pages/home/ServiceDetailPage';
import { ProductDetailPage } from './pages/home/ProductDetailPage';
import { ProfilePage } from './pages/home/ProfilePage';
import { JoinAsProPage } from './pages/join-as-pro/JoinAsProPage';
import { requestJson, requestForm } from './lib/api';
import { FavouritesPage } from './pages/home/FavouritesPage';
import { CartPage } from './pages/home/CartPage';
import { CheckoutPage } from './pages/home/CheckoutPage';
import { OrdersPage } from './pages/home/OrdersPage';
import { UserInquiriesPage } from './pages/home/UserInquiriesPage';
import type { ProApplicationPayload, SessionResponse, User } from './types/session';
import type { SidebarOption } from './components/DashboardLayout';

function redirectForUser(user: User): string {
  if (user.role === 'admin') {
    return '/admin';
  }

  if (user.role === 'service_provider' || user.role === 'product_seller') {
    return '/dashboard';
  }

  return '/';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function refreshSession() {
    setLoading(true);

    try {
      const response = await requestJson<unknown>('/api/auth/me');
      const session = response as SessionResponse;
      setUser(session.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  async function handleSignIn(email: string, password: string, preAuthUser?: User) {
    let nextUser: User | null = preAuthUser ?? null;

    if (!nextUser) {
      const response = await requestJson<User>('/api/auth/login', { email, password });
      nextUser = response.user ?? null;
      setNotice(response.message ?? 'Signed in successfully.');
    } else {
      setNotice('Signed in successfully.');
    }

    setUser(nextUser);

    if (nextUser) {
      navigate(redirectForUser(nextUser), { replace: true });
    }
  }

  async function handleSignUp(_name: string, _email: string, _password: string) {
    // After OTP verification, the user is already created and the session is set
    // by the backend. We just need to refresh the session state.
    const response = await requestJson<unknown>('/api/auth/me');
    const session = response as SessionResponse;
    const nextUser = session.user ?? null;
    setUser(nextUser);
    setNotice('Account created successfully.');

    if (nextUser) {
      navigate(redirectForUser(nextUser), { replace: true });
    }
  }

  async function handleLogout() {
    const response = await requestJson('/api/auth/logout', {});
    setUser(null);
    setNotice(response.message ?? 'Signed out successfully.');
    navigate('/', { replace: true });
  }

  async function handleProApplicationSubmit(payloadOrForm: ProApplicationPayload | FormData) {
    let response;

    if (payloadOrForm instanceof FormData) {
      response = await requestForm('/api/pro-applications', payloadOrForm);
    } else {
      response = await requestJson('/api/pro-applications', payloadOrForm);
    }

    setNotice(response.message ?? 'Application submitted successfully.');
    await refreshSession();
    navigate('/', { replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
          <p className="font-display text-sm font-medium text-ink-600">Loading Nestora...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage user={user} notice={notice} onLogout={handleLogout} />} />
      <Route path="/services/:id" element={<ServiceDetailPage user={user} onLogout={handleLogout} />} />
      <Route path="/products/:id" element={<ProductDetailPage user={user} onLogout={handleLogout} />} />
      <Route path="/profile/:id" element={<ProfilePage user={user} onLogout={handleLogout} />} />
      <Route path="/favourites" element={<FavouritesPage user={user} onLogout={handleLogout} />} />
      <Route path="/cart" element={<CartPage user={user} onLogout={handleLogout} />} />
      <Route path="/checkout" element={<CheckoutPage user={user} onLogout={handleLogout} />} />
      <Route path="/orders" element={<OrdersPage user={user} onLogout={handleLogout} />} />
      <Route
        path="/inquiries"
        element={
          user ? (
            <UserInquiriesPage user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
      <Route
        path="/auth"
        element={
          user ? (
            <Navigate to={redirectForUser(user)} replace />
          ) : (
            <AuthPage onSignIn={handleSignIn} onSignUp={handleSignUp} loading={loading} notice={notice} />
          )
        }
      />
      <Route
        path="/join-as-pro"
        element={
          user ? (
            <JoinAsProPage user={user} onSubmit={handleProApplicationSubmit} onLogout={handleLogout} />
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          user && (user.role === 'service_provider' || user.role === 'product_seller') ? (
            <DashboardPage
              user={user}
              onLogout={handleLogout}
              options={
                user.role === 'service_provider'
                  ? [
                      { id: 'listings', label: 'My Listings', iconName: 'Briefcase' },
                      { id: 'services', label: 'Services', iconName: 'MessageSquare' },
                      { id: 'overview', label: 'Overview & Stats', iconName: 'BarChart3' },
                      { id: 'edit-profile', label: 'Edit Profile', iconName: 'User' },
                    ]
                  : [
                      { id: 'inventory', label: 'Inventory', iconName: 'Package' },
                      { id: 'orders', label: 'Customer Orders', iconName: 'ShoppingBag' },
                      { id: 'services', label: 'Services', iconName: 'MessageSquare' },
                      { id: 'overview', label: 'Overview & Stats', iconName: 'BarChart3' },
                      { id: 'edit-profile', label: 'Edit Profile', iconName: 'User' },
                    ]
              }
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/admin"
        element={
          user?.role === 'admin' ? (
            <AdminPage
              user={user}
              onLogout={handleLogout}
              options={[
                { id: 'applications', label: 'Pending Requests', iconName: 'FileCheck' },
                { id: 'users', label: 'Users', iconName: 'Users' },
                { id: 'settings', label: 'Settings', iconName: 'Settings' },
              ]}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
