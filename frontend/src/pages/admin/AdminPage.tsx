import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { requestJson } from '../../lib/api';
import type { PendingApplication, User } from '../../types/session';

export function AdminPage({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [applications, setApplications] = useState<PendingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadApplications() {
    setLoading(true);

    try {
      const response = await requestJson<PendingApplication[]>('/api/admin/pending-applications');
      setApplications((response.applications as PendingApplication[]) ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load pending requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  async function handleApprove(applicationId: number) {
    await requestJson(`/api/admin/applications/${applicationId}/approve`, {});
    await loadApplications();
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8">
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
        <p className="text-sm uppercase tracking-[0.2em] text-ink-500">Admin</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink-900">Pending pro requests</h1>
        <p className="mt-3 text-base leading-7 text-ink-600">Approve service provider and product seller requests from here.</p>

        {loading ? <p className="mt-6 text-sm text-ink-600">Loading requests...</p> : null}
        {error ? <p className="mt-6 text-sm font-medium text-red-600">{error}</p> : null}

        <div className="mt-6 space-y-4">
          {applications.length === 0 && !loading ? <p className="text-sm text-ink-600">No pending requests.</p> : null}
          {applications.map((application) => (
            <article key={application.id} className="rounded-3xl border border-ink-200 bg-ink-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-ink-500">{application.application_type.replace('_', ' ')}</p>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900">{application.business_name}</h2>
                  <p className="mt-1 text-sm text-ink-600">
                    {application.user_name} - {application.user_email}
                  </p>
                  <p className="mt-2 text-sm text-ink-600">{application.business_city}</p>
                </div>
                <div className="flex items-center gap-3">
                  {application.document_file ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open(application.document_file, '_blank', 'noopener');
                      }}
                    >
                      View document
                    </Button>
                  ) : null}
                  <Button onClick={() => void handleApprove(application.id)}>Approve</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
