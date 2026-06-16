import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Users, Plus, Trash2, ArrowUpRight, Ban, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { requestJson } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { AvailabilityCalendar } from '../../../components/AvailabilityCalendar';
import type { User } from '../../../types/session';
import { GoogleCalendarSyncCard } from '../../../components/GoogleCalendarSyncCard';

interface InquiryInfo {
  id: number;
  booking_date: string;
  status: string;
  customer_id: number;
}

interface ScheduleBlock {
  id: number;
  event_date: string;
  type: 'leave' | 'manual_work';
  notes: string | null;
}

interface ScheduleResponse {
  teams_count: number;
  inquiries: InquiryInfo[];
  schedules: ScheduleBlock[];
}

export function ProviderCalendarView({ user }: { user: User }) {
  const [scheduleData, setScheduleData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamsCount, setTeamsCount] = useState(1);
  const [updatingTeams, setUpdatingTeams] = useState(false);
  const [teamsSuccess, setTeamsSuccess] = useState('');

  // Selected date details modal state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manualNote, setManualNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchScheduleDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await requestJson<any>(`/api/providers/${user.id}/schedule`);
      const data = response as ScheduleResponse;
      setScheduleData(data);
      setTeamsCount(data.teams_count || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch schedule configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchScheduleDetails();
  }, [user.id, refreshTrigger]);

  const handleUpdateTeams = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingTeams(true);
    setTeamsSuccess('');
    try {
      await requestJson('/api/provider/schedule/teams', { teams_count: teamsCount });
      setTeamsSuccess('Teams capacity updated successfully!');
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => setTeamsSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update teams capacity');
    } finally {
      setUpdatingTeams(false);
    }
  };

  // Find occurrences on the selected date
  const dateInquiries = scheduleData?.inquiries.filter((i) => i.booking_date === selectedDate) || [];
  const dateBlocks = scheduleData?.schedules.filter((s) => s.event_date === selectedDate) || [];
  const isLeave = dateBlocks.some((b) => b.type === 'leave');
  const manualWorks = dateBlocks.filter((b) => b.type === 'manual_work');

  const handleToggleLeave = async () => {
    if (!selectedDate) return;
    setSubmittingAction(true);
    setActionError('');
    try {
      if (isLeave) {
        await requestJson('/api/provider/schedule/unblock', {
          event_date: selectedDate,
          type: 'leave',
        });
      } else {
        await requestJson('/api/provider/schedule/block', {
          event_date: selectedDate,
          type: 'leave',
          notes: 'Provider Out of Office',
        });
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update leave status');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAddManualWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || manualNote.trim() === '') return;
    setSubmittingAction(true);
    setActionError('');
    try {
      await requestJson('/api/provider/schedule/block', {
        event_date: selectedDate,
        type: 'manual_work',
        notes: manualNote,
      });
      setManualNote('');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setActionError(err.message || 'Failed to add manual booking');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRemoveManualWork = async (blockId: number, eventDate: string) => {
    setSubmittingAction(true);
    setActionError('');
    try {
      await requestJson('/api/provider/schedule/unblock', {
        event_date: eventDate,
        type: 'manual_work',
      });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove manual booking');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6 pt-2">
      {/* Top Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Teams Capacity Setting */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-aura-600" />
              <h3 className="font-display text-base font-bold text-ink-900">Configure Capacity</h3>
            </div>
            <p className="mt-1 text-xs text-ink-500 leading-relaxed">
              Define how many working crews/teams you operate. Each team represents one independent project/work slot you can handle per day.
            </p>
          </div>

          <form onSubmit={handleUpdateTeams} className="mt-4 flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Number of Teams</label>
              <input
                type="number"
                min="1"
                required
                value={teamsCount}
                onChange={(e) => setTeamsCount(parseInt(e.target.value) || 1)}
                className="w-full rounded-2xl border border-ink-100 px-3.5 py-2 text-xs font-bold text-ink-800 focus:outline-none focus:ring-1 focus:ring-aura-500"
              />
            </div>
            <Button
              type="submit"
              disabled={updatingTeams}
              className="bg-aura-600 hover:bg-aura-700 text-white rounded-2xl text-xs py-2 px-5 font-bold h-9"
            >
              {updatingTeams ? 'Saving...' : 'Save Settings'}
            </Button>
          </form>
          {teamsSuccess && (
            <p className="mt-2 text-xs text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              {teamsSuccess}
            </p>
          )}
        </div>

        {/* Schedule Summary Info */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-aura-600" />
              <h3 className="font-display text-base font-bold text-ink-900">Availability Summary</h3>
            </div>
            <p className="mt-1 text-xs text-ink-500 leading-relaxed">
              Click on any day in the monthly calendar to block leaves, schedule manual works, or view detailed allocations for active customer inquiries.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            <div className="bg-white/50 border border-ink-100 rounded-2xl p-2.5">
              <p className="text-[9px] font-bold text-ink-400 uppercase tracking-wider">Active Inquiries</p>
              <p className="text-lg font-display font-extrabold text-ink-900 mt-0.5">
                {scheduleData?.inquiries.length || 0}
              </p>
            </div>
            <div className="bg-white/50 border border-ink-100 rounded-2xl p-2.5">
              <p className="text-[9px] font-bold text-ink-400 uppercase tracking-wider">Manual Works</p>
              <p className="text-lg font-display font-extrabold text-ink-900 mt-0.5">
                {scheduleData?.schedules.filter((s) => s.type === 'manual_work').length || 0}
              </p>
            </div>
            <div className="bg-white/50 border border-ink-100 rounded-2xl p-2.5">
              <p className="text-[9px] font-bold text-ink-400 uppercase tracking-wider">Blocked Leaves</p>
              <p className="text-lg font-display font-extrabold text-ink-900 mt-0.5">
                {scheduleData?.schedules.filter((s) => s.type === 'leave').length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Google Calendar Sync */}
      <GoogleCalendarSyncCard />

      {/* Interactive Monthly Calendar Card */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink-900">Manage Availability Calendar</h3>
          <button
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <AvailabilityCalendar
          providerId={Number(user.id)}
          interactive={true}
          selectedDate={selectedDate || undefined}
          onDateSelect={(date) => {
            setSelectedDate(date);
            setIsModalOpen(true);
          }}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Day details modal */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-ink-150 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-ink-900">Manage Schedule</h3>
                <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider mt-0.5">
                  Date: {selectedDate}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedDate(null);
                  setActionError('');
                }}
                className="text-xs font-bold text-ink-400 hover:text-ink-900 transition-colors"
              >
                Close
              </button>
            </div>

            {actionError && (
              <p className="mt-3 text-xs text-red-600 font-bold flex items-center gap-1 bg-red-50 border border-red-100 rounded-xl p-2.5">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                {actionError}
              </p>
            )}

            {/* List of allocations */}
            <div className="mt-4 space-y-4">
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-ink-400 uppercase tracking-wider">Daily Allocations</h4>
                {dateInquiries.length === 0 && manualWorks.length === 0 && !isLeave && (
                  <p className="text-xs text-ink-500 italic bg-ink-50 p-4 rounded-2xl border border-dashed border-ink-200">
                    No work entries or leave blocks allocated on this date. All {scheduleData?.teams_count} team slots are available.
                  </p>
                )}

                {/* Leave indication */}
                {isLeave && (
                  <div className="flex items-center justify-between bg-red-50/50 border border-red-150 p-3.5 rounded-2xl">
                    <div className="flex items-center gap-2.5">
                      <Ban className="h-4.5 w-4.5 text-red-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-red-950">Out of Office (Leave Day)</p>
                        <p className="text-[10px] text-red-700 font-semibold">Entire day blocked. Crews are not working.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer inquiries */}
                {dateInquiries.map((inq) => (
                  <div key={inq.id} className="flex items-center justify-between bg-emerald-50/20 border border-emerald-100 p-3.5 rounded-2xl">
                    <div>
                      <p className="text-xs font-bold text-ink-950">Active Customer Inquiry</p>
                      <p className="text-[10px] text-ink-500 font-semibold mt-0.5">Status: <span className="uppercase font-bold text-aura-600">{inq.status}</span></p>
                    </div>
                    <a
                      href={`/dashboard?tab=services`}
                      onClick={() => setIsModalOpen(false)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-aura-600 hover:underline bg-white border border-ink-150 px-2.5 py-1.5 rounded-xl shadow-sm"
                    >
                      <span>Detail</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </div>
                ))}

                {/* Manual works */}
                {manualWorks.map((work) => (
                  <div key={work.id} className="flex items-center justify-between bg-amber-50/50 border border-amber-100 p-3.5 rounded-2xl">
                    <div>
                      <p className="text-xs font-bold text-amber-950">Manual Work Allocation</p>
                      <p className="text-[10px] text-amber-800 font-semibold mt-0.5 italic">"{work.notes}"</p>
                    </div>
                    <button
                      onClick={() => handleRemoveManualWork(work.id, selectedDate)}
                      disabled={submittingAction}
                      className="text-red-600 hover:text-red-700 p-1.5 rounded-xl border border-red-100 bg-white hover:bg-red-50 transition-colors shadow-sm disabled:opacity-50"
                      title="Delete allocation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="border-t border-ink-100 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-ink-400 uppercase tracking-wider">Quick Actions</h4>
                
                <div className="flex gap-2">
                  {/* Leave toggle */}
                  <Button
                    type="button"
                    variant={isLeave ? 'outline' : 'default'}
                    disabled={submittingAction}
                    onClick={handleToggleLeave}
                    className={`flex-1 rounded-2xl text-xs py-2 font-bold ${
                      isLeave ? '' : 'bg-red-600 hover:bg-red-700 text-white border-none'
                    }`}
                  >
                    {isLeave ? 'Remove Leave / Activate Crews' : 'Mark Day as Leave'}
                  </Button>
                </div>

                {/* Add manual work form */}
                {!isLeave && (
                  <form onSubmit={handleAddManualWork} className="space-y-2.5">
                    <label className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Add Manual Work Block</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Client name, site location, or project note..."
                        required
                        disabled={submittingAction}
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        className="flex-1 rounded-2xl border border-ink-100 px-3.5 py-2 text-xs font-semibold text-ink-800 focus:outline-none focus:ring-1 focus:ring-aura-500 placeholder:text-ink-400 placeholder:font-normal"
                      />
                      <Button
                        type="submit"
                        disabled={submittingAction}
                        className="bg-aura-600 hover:bg-aura-700 text-white rounded-2xl text-xs px-4 font-bold flex items-center gap-1 shrink-0 h-9"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Book Slot</span>
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
