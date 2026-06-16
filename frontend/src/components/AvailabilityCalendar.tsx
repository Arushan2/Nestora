import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Info, XCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { requestJson } from '../lib/api';

interface InquiryInfo {
  id: number;
  booking_date: string;
  status: string;
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

interface AvailabilityCalendarProps {
  providerId: number;
  interactive?: boolean;
  selectedDate?: string; // YYYY-MM-DD
  onDateSelect?: (date: string) => void;
  showSummary?: boolean;
  refreshTrigger?: number;
}

export function AvailabilityCalendar({
  providerId,
  interactive = false,
  selectedDate,
  onDateSelect,
  showSummary = true,
  refreshTrigger = 0,
}: AvailabilityCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scheduleData, setScheduleData] = useState<ScheduleResponse | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchSchedule() {
      if (!providerId) return;
      setLoading(true);
      setError('');
      try {
        const response = await requestJson<any>(`/api/providers/${providerId}/schedule`);
        if (active) {
          setScheduleData(response as ScheduleResponse);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Failed to load availability calendar');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void fetchSchedule();
    return () => {
      active = false;
    };
  }, [providerId, refreshTrigger]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate calendar days
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: firstDayIndex }, (_, i) => i);

  const getDayStatus = (dateStr: string) => {
    if (!scheduleData) return { type: 'available', occupied: 0, capacity: 1, notes: '' };

    const capacity = scheduleData.teams_count || 1;

    // Check leave
    const leaveBlock = scheduleData.schedules.find(
      (s) => s.event_date === dateStr && s.type === 'leave'
    );
    if (leaveBlock) {
      return { type: 'leave', occupied: 0, capacity, notes: leaveBlock.notes || 'Leave' };
    }

    // Count customer bookings (active inquiries)
    const activeInquiriesCount = scheduleData.inquiries.filter(
      (i) => i.booking_date === dateStr
    ).length;

    // Count manual bookings
    const manualWorkBlocks = scheduleData.schedules.filter(
      (s) => s.event_date === dateStr && s.type === 'manual_work'
    );
    const manualCount = manualWorkBlocks.length;
    const manualNotes = manualWorkBlocks.map((b) => b.notes).filter(Boolean).join(', ');

    const occupied = activeInquiriesCount + manualCount;

    if (occupied >= capacity) {
      return { type: 'fully_booked', occupied, capacity, notes: 'Fully Booked' };
    } else if (occupied > 0) {
      return { type: 'partially_booked', occupied, capacity, notes: manualNotes || `${occupied}/${capacity} slots occupied` };
    }

    return { type: 'available', occupied: 0, capacity, notes: '' };
  };

  const formatDateString = (day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="rounded-3xl border border-ink-150 bg-white/95 p-5 shadow-lg backdrop-blur-sm">
      {/* Header Month Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-ink-100">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-aura-600" />
          <h4 className="font-display text-sm font-bold text-ink-900">
            {monthNames[month]} {year}
          </h4>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="rounded-lg p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="rounded-lg p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
          <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Loading Schedule...</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-xs text-red-600 font-bold justify-center py-8">
          <AlertCircle className="h-4.5 w-4.5" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="mt-4">
          {/* Day Names Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-2">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {paddingDays.map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}

            {days.map((day) => {
              const dateStr = formatDateString(day);
              const status = getDayStatus(dateStr);
              const isSelected = selectedDate === dateStr;
              const isToday = todayStr === dateStr;
              const isPast = dateStr < todayStr;

              // Determine classes based on status
              let cellClass = '';
              let indicatorClass = '';

              switch (status.type) {
                case 'leave':
                  cellClass = 'bg-ink-50 text-ink-300 cursor-not-allowed border-dashed border-ink-200';
                  indicatorClass = 'bg-ink-300';
                  break;
                case 'fully_booked':
                  cellClass = 'bg-red-50 text-red-400 cursor-not-allowed border-red-100';
                  indicatorClass = 'bg-red-500';
                  break;
                case 'partially_booked':
                  cellClass = isPast
                    ? 'bg-amber-50/50 text-ink-400 cursor-not-allowed'
                    : 'bg-amber-50 text-amber-800 border-amber-100 hover:bg-amber-100/70 cursor-pointer';
                  indicatorClass = 'bg-amber-500';
                  break;
                case 'available':
                default:
                  cellClass = isPast
                    ? 'bg-white text-ink-300 cursor-not-allowed'
                    : 'bg-emerald-50/20 text-emerald-950 border-emerald-100 hover:bg-emerald-50/60 cursor-pointer';
                  indicatorClass = 'bg-emerald-500';
                  break;
              }

              const isClickable = interactive && !isPast && status.type !== 'leave' && status.type !== 'fully_booked';

              return (
                <button
                  key={day}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onDateSelect && onDateSelect(dateStr)}
                  title={status.notes || `${day} ${monthNames[month]}`}
                  className={`relative aspect-square rounded-xl border flex flex-col items-center justify-between p-1.5 transition-all text-xs font-bold ${cellClass} ${
                    isSelected ? 'ring-2 ring-aura-600 border-aura-600 scale-95 z-10 shadow-sm' : ''
                  } ${isToday ? 'border-ink-800' : ''}`}
                >
                  <span className="self-start text-[10px]">{day}</span>

                  {/* Indicator bullet or slot status */}
                  <div className="flex items-center gap-1 w-full justify-end">
                    {status.type === 'partially_booked' && (
                      <span className="hidden md:inline text-[8px] font-extrabold text-amber-700">
                        {status.capacity - status.occupied} left
                      </span>
                    )}
                    <span className={`h-1.5 w-1.5 rounded-full ${indicatorClass}`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Calendar Summary/Legend */}
          {showSummary && (
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-ink-100 pt-3.5 text-[10px] font-bold text-ink-500">
              <div className="flex items-center gap-2 bg-emerald-50/30 border border-emerald-100/50 rounded-xl px-2 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-2 py-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                <span>Partial Booked</span>
              </div>
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
                <XCircle className="h-3.5 w-3.5 text-red-600" />
                <span>Fully Booked</span>
              </div>
              <div className="flex items-center gap-2 bg-ink-50 border border-ink-100 rounded-xl px-2 py-1">
                <Info className="h-3.5 w-3.5 text-ink-400" />
                <span>Leave Day</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
