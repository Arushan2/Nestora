import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import type { User } from '../../types/session';

export function DashboardPage({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const label = user.role === 'service_provider' ? 'Service Provider Dashboard' : 'Product Seller Dashboard';

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8">
      <header className="flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
        <Link to="/" className="font-display text-xl font-semibold text-ink-900">
          Nestora
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100">
            Home
          </Link>
          <Button variant="outline" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </header>

      <section className="mt-10 rounded-3xl border border-white/70 bg-white/90 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.2em] text-ink-500">Dashboard</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink-900">{label}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-600">
          Your pro application has been approved. This is where the role-specific workspace will live for listings,
          requests, orders, and performance once you expand the product.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <MiniCard title="Account" value={user.email} />
          <MiniCard title="Role" value={user.role} />
          <MiniCard title="Status" value={user.application?.status ?? 'approved'} />
        </div>
      </section>
    </main>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-ink-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">{title}</p>
      <p className="mt-2 text-sm font-medium text-ink-900">{value}</p>
    </div>
  );
}
