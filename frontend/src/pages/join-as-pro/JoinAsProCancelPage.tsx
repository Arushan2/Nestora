import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

export function JoinAsProCancelPage() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <Card className="w-full max-w-md border-0 bg-white/90 shadow-glow text-center p-6 rounded-3xl">
        <CardHeader className="flex flex-col items-center">
          <XCircle className="h-16 w-16 text-red-500" />
          <CardTitle className="mt-4 font-display text-2xl font-bold text-ink-900">Checkout Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-600">
            It looks like you cancelled the checkout process. No charges were made.
          </p>
          <div className="pt-4 flex flex-col gap-2">
            <Button
              onClick={() => navigate('/')}
              className="w-full"
            >
              Return Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
