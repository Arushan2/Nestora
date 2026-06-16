import { HeaderBar } from '../../components/HeaderBar';
import { InquiryListAndDetail } from '../../components/InquiryListAndDetail';
import type { User } from '../../types/session';
import { Link } from 'react-router-dom';
import { GoogleCalendarSyncCard } from '../../components/GoogleCalendarSyncCard';

export function UserInquiriesPage({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => Promise<void>;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10 pb-20">
      <HeaderBar user={user} onLogout={onLogout} />

      {/* Breadcrumb / Back Button */}
      <div className="mb-6 mt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-4 py-2 text-xs font-semibold text-ink-700 hover:text-ink-950 hover:bg-ink-50 shadow-sm backdrop-blur transition-all"
        >
          &larr; Back to Marketplace
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Service Workspaces</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink-900 md:text-4xl">Service Inquiries</h1>
          <p className="mt-1 text-sm text-ink-600">
            Track inquiries, coordinate pricing detail revisions, accept proposals, and coordinate project completions.
          </p>
        </div>

        <GoogleCalendarSyncCard />

        <div className="pt-2">
          <InquiryListAndDetail user={user} />
        </div>
      </div>
    </main>
  );
}
