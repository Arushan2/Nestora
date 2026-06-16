import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle2, AlertTriangle, CloudLightning, XCircle } from 'lucide-react';
import { requestJson } from '../lib/api';
import { Button } from './ui/button';

export function GoogleCalendarSyncCard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<{ connected: boolean; configured: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const checkConnectionStatus = async () => {
    try {
      const res = (await requestJson<any>('/api/auth/google/status')) as any;
      setStatus({
        connected: !!res.connected,
        configured: !!res.configured
      });
    } catch {
      setStatus({ connected: false, configured: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void checkConnectionStatus();

    // Handle query params on oauth callback success/error
    const success = searchParams.get('google_success');
    const error = searchParams.get('google_error');

    if (success) {
      setMessage({ text: 'Google Calendar successfully synchronized!', type: 'success' });
      // Remove query parameters from URL clean-up
      searchParams.delete('google_success');
      setSearchParams(searchParams);
    } else if (error) {
      setMessage({ text: `Failed to connect Google Calendar: ${decodeURIComponent(error)}`, type: 'error' });
      searchParams.delete('google_error');
      setSearchParams(searchParams);
    }
  }, []);

  const handleConnect = () => {
    // Redirect browser directly to OAuth redirection endpoint
    window.location.href = '/api/auth/google/redirect';
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setMessage(null);
    try {
      await requestJson('/api/auth/google/disconnect');
      setStatus((prev) => prev ? { ...prev, connected: false } : null);
      setMessage({ text: 'Google Calendar disconnected.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to disconnect.', type: 'error' });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur flex justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
      </div>
    );
  }

  const isConfigured = status?.configured ?? false;
  const isConnected = status?.connected ?? false;

  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-2.5 text-blue-600 shadow-sm shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-ink-900">Google Calendar Synchronization</h3>
            <p className="mt-0.5 text-xs text-ink-500 leading-relaxed max-w-xl">
              Link your account to automatically export Nestora project dates, leaves, and manual schedules directly to your Google Calendar.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center">
          {!isConfigured ? (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-2xl text-[10px] font-bold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Keys Not Configured (.env)</span>
            </div>
          ) : isConnected ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-150 px-3 py-1.5 rounded-2xl text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Sync Active</span>
              </span>
              <Button
                onClick={handleDisconnect}
                disabled={disconnecting}
                variant="outline"
                className="rounded-full text-xs py-1.5 px-4 h-8 bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleConnect}
              className="bg-ink-900 hover:bg-ink-800 text-white rounded-full text-xs py-1.5 px-5 font-bold h-8 flex items-center gap-1.5 shadow-sm"
            >
              <CloudLightning className="h-3.5 w-3.5 text-aura-400" />
              <span>Connect Google Calendar</span>
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div className={`text-xs font-bold p-3 rounded-2xl border flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-emerald-50 border-emerald-150 text-emerald-850'
            : 'bg-red-50 border-red-150 text-red-850'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}
