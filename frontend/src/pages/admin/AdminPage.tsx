import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { requestJson } from '../../lib/api';
import type { PendingApplication, User } from '../../types/session';
import { DashboardLayout, SidebarOption } from '../../components/DashboardLayout';

export function AdminPage({
  user,
  onLogout,
  options,
}: {
  user: User;
  onLogout: () => Promise<void>;
  options: SidebarOption[];
}) {
  const [applications, setApplications] = useState<PendingApplication[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<PendingApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('applications');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredApplications = applications.filter((app) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      app.business_name.toLowerCase().includes(query) ||
      app.user_name.toLowerCase().includes(query) ||
      app.user_email.toLowerCase().includes(query) ||
      app.business_city.toLowerCase().includes(query) ||
      app.application_type.toLowerCase().includes(query)
    );
  });

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      options={options}
      activeOptionId={activeTab}
      onOptionSelect={setActiveTab}
      searchPlaceholder="Search requests..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="space-y-6">
        {activeTab === 'applications' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Admin</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">Pending Pro Requests</h1>
              <p className="mt-1 text-sm text-ink-600">Approve service provider and product seller requests from here.</p>
            </div>

            {loading ? <p className="text-sm text-ink-600">Loading requests...</p> : null}
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <div className="space-y-4">
              {filteredApplications.length === 0 && !loading ? (
                <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-sm text-ink-600">
                    {searchQuery ? 'No matching requests found.' : 'No pending requests.'}
                  </p>
                </div>
              ) : null}
              {filteredApplications.map((application) => (
                <article key={application.id} className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-aura-600">
                        {application.application_type.replace('_', ' ')}
                      </p>
                      <h2 className="mt-1 font-display text-xl font-bold text-ink-900">{application.business_name}</h2>
                      <p className="mt-1 text-xs text-ink-600">
                        {application.user_name} - {application.user_email}
                      </p>
                      <p className="mt-1.5 text-xs font-medium text-ink-500">{application.business_city}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedApplication(application)}
                        className="rounded-full text-xs"
                      >
                        View Details
                      </Button>
                      <Button onClick={() => void handleApprove(application.id)} className="rounded-full text-xs bg-ink-900 text-white hover:bg-ink-800">
                        Approve
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">System</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">System Configuration</h1>
              <p className="mt-1 text-sm text-ink-600">Manage administrative workspace configurations and verification rules.</p>
            </div>

            <div className="rounded-3xl bg-white border border-ink-200 p-6 shadow-sm space-y-4">
              <h3 className="font-display text-lg font-semibold text-ink-900">Pro Verification Rules</h3>
              <p className="text-xs text-ink-600">
                Configure auto-rejection timeouts, email notice structures for approved providers, and required document files.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border border-ink-100 rounded-2xl bg-ink-50/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Verification Engine</span>
                  <p className="text-xs font-semibold text-ink-900 mt-1">Manual Document Inspection</p>
                </div>
                <div className="p-4 border border-ink-100 rounded-2xl bg-ink-50/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Default Response SLA</span>
                  <p className="text-xs font-semibold text-ink-900 mt-1">48 Business Hours</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
    </DashboardLayout>
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

