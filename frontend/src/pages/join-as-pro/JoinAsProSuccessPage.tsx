import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { requestJson } from '../../lib/api';
import type { User } from '../../types/session';

export function JoinAsProSuccessPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const response = await requestJson<User>('/api/auth/me');
        if (response.user && response.user.role === 'service_provider') {
          clearInterval(interval);
          setLoading(false);
        }
      } catch (e) {
        // ignore
      }
      attempts++;
      if (attempts > 15) {
        clearInterval(interval);
        setLoading(false);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <Card className="w-full max-w-md border-0 bg-white/90 shadow-glow text-center p-6 rounded-3xl">
        <CardHeader className="flex flex-col items-center">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 animate-bounce" />
          <CardTitle className="mt-4 font-display text-2xl font-bold text-ink-900">
            {loading ? 'Activating Pro Status...' : 'Subscription Completed!'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-600">
            {loading 
              ? 'We are waiting for confirmation from Stripe. This will take just a moment...' 
              : 'Thank you for subscribing! Your payment was successful, and your account has been upgraded to a Service Provider.'}
          </p>
          <div className="pt-4">
            <Button
              disabled={loading}
              onClick={() => {
                window.location.href = '/dashboard';
              }}
              className="w-full bg-gradient-to-r from-aura-500 to-aura-600 text-white"
            >
              {loading ? 'Please wait...' : 'Go to Dashboard'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
