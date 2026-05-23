import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import type { User } from '../../types/session';

export function HomePage({
  user,
  notice,
  onLogout,
}: {
  user: User | null;
  notice: string;
  onLogout: () => Promise<void>;
}) {
  const isPro = user?.role === 'service_provider' || user?.role === 'product_seller';
  const isAdmin = user?.role === 'admin';
  const isPending = user?.application?.status === 'pending' && user?.role === 'user';
  const actionLabel = isAdmin ? 'Admin' : isPro ? 'Dashboard' : isPending ? 'Pending review' : 'Join as Pro';
  const actionTo = isAdmin ? '/admin' : isPro ? '/dashboard' : isPending ? '/' : '/join-as-pro';

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
      <header className="flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
        <Link to="/" className="font-display text-xl font-semibold text-ink-900">
          Nestora
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to={actionTo}
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
          >
            {actionLabel}
          </Link>
          {user ? (
            <Button variant="outline" onClick={onLogout}>
              Logout
            </Button>
          ) : (
            <Link to="/auth" className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="grid gap-10 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-aura-100 bg-white/80 px-4 py-2 text-sm font-medium text-ink-700 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-aura-500" />
            Home for services, products, and booking
          </div>
          <h1 className="max-w-3xl font-display text-5xl font-bold tracking-tight text-ink-900 md:text-6xl">
            Build, book, and grow your service business with Nestora.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-ink-600">
            Nestora brings together customer booking, pro onboarding, product sales, and admin workflows in one platform.
          </p>
          <div className="flex flex-wrap gap-3">
            {isPending ? (
              <span className="rounded-full bg-amber-100 px-5 py-3 text-sm font-medium text-amber-800">Pending review</span>
            ) : (
              <Link to={actionTo} className="rounded-full bg-ink-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800">
                {actionLabel}
              </Link>
            )}
            {!user ? (
              <Link to="/auth" className="rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-100">
                Sign in
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4">
          <InfoCard title="Customer flow" text="Browse, book, and buy with a clean account-based experience." />
          <InfoCard title="Pro workflow" text="Register as a service provider or product seller, submit details, and wait for approval." />
          <InfoCard title="Platform core" text="Built with PHP backend, MySQL database, and React + Vite frontend." />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard title="Backend" value="PHP + PDO" subtitle="Session auth and MySQL connection via env config." />
        <StatusCard title="Database" value="MySQL" subtitle="Users and pro application tables with approval flow." />
        <StatusCard title="Frontend" value="React + Vite" subtitle="Route-based pages in a structured folder layout." />
      </section>

      {user ? (
        <section className="mt-6 rounded-3xl border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur">
          <p className="text-sm uppercase tracking-[0.2em] text-ink-500">Signed in</p>
          <p className="mt-2 text-2xl font-display font-semibold text-ink-900">{user.name}</p>
          <p className="mt-1 text-sm text-ink-600">{user.email}</p>
          <p className="mt-4 text-sm text-ink-700">Role: {user.role}</p>
          {user.application?.status === 'pending' ? <p className="mt-2 text-sm text-amber-700">Your pro application is pending review.</p> : null}
        </section>
      ) : null}

      {notice ? (
        <div className="fixed bottom-6 left-1/2 z-10 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-ink-200 bg-white px-5 py-4 shadow-glow">
          <p className="text-sm font-medium text-ink-900">{notice}</p>
        </div>
      ) : null}
    </main>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
      <h3 className="font-display text-xl font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-600">{text}</p>
    </div>
  );
}

function StatusCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-ink-500">{title}</p>
      <p className="mt-3 font-display text-2xl font-semibold text-ink-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-ink-600">{subtitle}</p>
    </div>
  );
}
