import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { requestJson } from '../../lib/api';
import type { User } from '../../types/session';

export function JoinAsProSuccessPage() {
  const [loading, setLoading] = useState(true);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const response = await requestJson<{ user: User }>('/api/auth/me');
        const user = (response as any).user;
        if (user && (user.membership_status === 'trial_active' || user.role === 'service_provider')) {
          clearInterval(interval);
          setTrialEndsAt(user.trial_ends_at ?? null);
          setLoading(false);
        }
      } catch (e) {
        // ignore
      }
      attempts++;
      if (attempts > 20) {
        clearInterval(interval);
        setLoading(false);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const trialEndFormatted = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <Card className="w-full max-w-md border-0 bg-white/90 shadow-glow text-center p-6 rounded-3xl">
        <CardHeader className="flex flex-col items-center">
          {loading ? (
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-aura-200 border-t-aura-500" />
          ) : (
            <div className="relative">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              <Sparkles className="absolute -right-2 -top-2 h-6 w-6 text-aura-500 animate-pulse" />
            </div>
          )}
          <CardTitle className="mt-4 font-display text-2xl font-bold text-ink-900">
            {loading ? 'Activating Your Free Trial...' : 'Free Trial Active!'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-sm text-ink-600">
              We are confirming your subscription with Stripe. This will take just a moment...
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-600 leading-relaxed">
                Your 30-day free trial is now active. You have full Service Provider access on Nestora —
                create listings, receive inquiries, and start building your business profile.
              </p>

              {trialEndFormatted && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-left space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Trial Ends</p>
                  <p className="font-display text-lg font-bold text-ink-900">{trialEndFormatted}</p>
                  <p className="text-xs text-ink-500">After your trial: $29.99/year — cancel any time to avoid charge</p>
                </div>
              )}

              <p className="text-xs text-ink-500 leading-relaxed">
                Your saved payment method will be automatically charged $29.99 USD after your 30-day trial
                unless you cancel in the billing portal.
              </p>
            </>
          )}

          <Button
            disabled={loading}
            onClick={() => {
              window.location.href = '/dashboard';
            }}
            className="w-full bg-gradient-to-r from-aura-500 to-aura-600 text-white"
          >
            {loading ? 'Please wait...' : 'Go to Dashboard'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
