import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { HeaderBar } from '../../components/HeaderBar';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { requestJson } from '../../lib/api';
import type { PendingApplication, User } from '../../types/session';

export function AdminPage({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [applications, setApplications] = useState<PendingApplication[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<PendingApplication | null>(null);
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
      <HeaderBar user={user} onLogout={onLogout} />

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
                  <Button
                    variant="outline"
                    onClick={() => setSelectedApplication(application)}
                  >
                    View Details
                  </Button>
                  <Button onClick={() => void handleApprove(application.id)}>Approve</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Dialog isOpen={!!selectedApplication} onClose={() => setSelectedApplication(null)}>
        {selectedApplication ? (
          <>
            <DialogHeader>
              <div className="mb-2">
                <span className="inline-flex items-center rounded-full bg-aura-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink-900">
                  {selectedApplication.application_type.replace('_', ' ')}
                </span>
              </div>
              <DialogTitle>{selectedApplication.business_name}</DialogTitle>
              <DialogDescription>
                Submitted by {selectedApplication.user_name} ({selectedApplication.user_email}) on{' '}
                {new Date(selectedApplication.created_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 max-h-[60vh] overflow-y-auto pr-2 space-y-6">
              {/* Business Info Grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem label="Email" value={selectedApplication.business_email} />
                <DetailItem label="Phone" value={selectedApplication.business_phone} />
                <DetailItem label="Address" value={selectedApplication.business_address} />
                <DetailItem label="City" value={selectedApplication.business_city} />
              </div>

              {/* Business Description */}
              {selectedApplication.business_description ? (
                <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Business Description</span>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-800">{selectedApplication.business_description}</p>
                </div>
              ) : null}

              {/* Document Section */}
              <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Uploaded Document</span>
                    <p className="mt-0.5 text-sm text-ink-800">
                      {selectedApplication.document_type || 'Registration Document'}{' '}
                      {selectedApplication.document_number ? `(#${selectedApplication.document_number})` : ''}
                    </p>
                  </div>
                  {selectedApplication.document_file ? (
                    <Button
                      variant="outline"
                      onClick={() => window.open(selectedApplication.document_file, '_blank', 'noopener')}
                    >
                      Open Document
                    </Button>
                  ) : null}
                </div>

                {selectedApplication.document_file ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-ink-200 bg-white flex justify-center">
                    <img
                      src={selectedApplication.document_file}
                      alt="Uploaded Document"
                      className="max-h-64 object-contain p-2 hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                      onClick={() => window.open(selectedApplication.document_file, '_blank', 'noopener')}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-sm italic text-ink-500">No document file uploaded.</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedApplication(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  void handleApprove(selectedApplication.id);
                  setSelectedApplication(null);
                }}
              >
                Approve Request
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </Dialog>
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">{label}</span>
      <p className="mt-1 text-sm font-medium text-ink-900">{value || '-'}</p>
    </div>
  );
}

