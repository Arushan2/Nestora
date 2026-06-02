import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AdminPage } from './pages/admin/AdminPage';
import { AuthPage } from './pages/auth/AuthPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { HomePage } from './pages/home/HomePage';
import { JoinAsProPage } from './pages/join-as-pro/JoinAsProPage';
import { requestJson, requestForm } from './lib/api';
import type { ProApplicationPayload, SessionResponse, User } from './types/session';

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

  async function handleSignIn(email: string, password: string) {
    const response = await requestJson<User>('/api/auth/login', { email, password });
    const nextUser = response.user ?? null;
    setUser(nextUser);
    setNotice(response.message ?? 'Signed in successfully.');

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

  return (
    <Routes>
      <Route path="/" element={<HomePage user={user} notice={notice} onLogout={handleLogout} />} />
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
            <DashboardPage user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/admin"
        element={user?.role === 'admin' ? <AdminPage user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
