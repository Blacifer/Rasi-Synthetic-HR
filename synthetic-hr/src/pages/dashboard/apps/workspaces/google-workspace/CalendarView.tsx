import { useState } from 'react';
import { Calendar, Clock, MapPin, Users, Plus, ChevronDown, Mail, X } from 'lucide-react';
import { WriteForm, PendingApprovalRow, type WriteFormField } from '../shared';
import type { ApprovalRequest } from '../../../../../lib/api/approvals';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  attendees?: { email: string; responseStatus?: string; displayName?: string }[];
  status?: string;
  organizer?: { email: string; displayName?: string };
  htmlLink?: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  loading: boolean;
  onCreate: (data: Record<string, string>) => void;
  pendingApprovals?: ApprovalRequest[];
  onApprovalResolved?: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dt?: { dateTime?: string; date?: string }): string {
  if (!dt) return '';
  if (dt.dateTime) {
    return new Date(dt.dateTime).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  if (dt.date) return new Date(dt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return '';
}

function formatTime(dt?: { dateTime?: string; date?: string }): string {
  if (!dt) return '';
  if (dt.dateTime) return new Date(dt.dateTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (dt.date) return new Date(dt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return '';
}

function isUpcoming(dt?: { dateTime?: string; date?: string }): boolean {
  if (!dt) return false;
  const d = dt.dateTime || dt.date;
  return !!d && new Date(d) >= new Date();
}

function rsvpColor(status?: string) {
  if (status === 'accepted') return 'text-emerald-400';
  if (status === 'declined') return 'text-rose-400';
  if (status === 'tentative') return 'text-amber-400';
  return 'text-slate-500';
}

/* ------------------------------------------------------------------ */
/*  Event Card                                                         */
/* ------------------------------------------------------------------ */

function EventCard({ event }: { event: CalendarEvent }) {
  const [open, setOpen] = useState(false);
  const upcoming = isUpcoming(event.start);

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all cursor-pointer ${
        open
          ? 'border-blue-500/30 bg-blue-500/[0.05]'
          : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]'
      }`}
      onClick={() => setOpen((v) => !v)}
    >
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Date block */}
        <div className={`w-10 text-center shrink-0 ${upcoming ? 'text-blue-400' : 'text-slate-600'}`}>
          {event.start?.dateTime || event.start?.date ? (
            <>
              <p className="text-[10px] font-medium uppercase leading-none">
                {new Date(event.start.dateTime || event.start.date!).toLocaleString(undefined, { month: 'short' })}
              </p>
              <p className="text-lg font-bold leading-tight">
                {new Date(event.start.dateTime || event.start.date!).getDate()}
              </p>
            </>
          ) : (
            <Calendar className="w-5 h-5 mx-auto" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${upcoming ? 'text-slate-100' : 'text-slate-400'}`}>
            {event.summary || 'Untitled Event'}
          </p>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500 flex-wrap">
            {event.start && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(event.start)}
                {event.end && ` – ${formatTime(event.end)}`}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {event.location}
              </span>
            )}
            {event.attendees && event.attendees.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {event.attendees.length} people
              </span>
            )}
          </div>
        </div>

        <ChevronDown className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-white/[0.06] px-4 py-4 space-y-3" onClick={(e) => e.stopPropagation()}>
          {/* Full time */}
          {event.start && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">When</p>
              <p className="text-sm text-slate-200">
                {formatDate(event.start)}
                {event.end && ` → ${formatDate(event.end)}`}
              </p>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">Where</p>
              <p className="text-sm text-slate-200">{event.location}</p>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">Description</p>
              <p className="text-sm text-slate-300 whitespace-pre-line">{event.description}</p>
            </div>
          )}

          {/* Organizer */}
          {event.organizer && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">Organizer</p>
              <p className="text-sm text-slate-200 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                {event.organizer.displayName || event.organizer.email}
              </p>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-2">
                Attendees ({event.attendees.length})
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {event.attendees.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] font-semibold text-slate-300 shrink-0">
                      {(a.displayName?.[0] || a.email[0]).toUpperCase()}
                    </div>
                    <span className="text-xs text-slate-300 truncate">{a.displayName || a.email}</span>
                    <span className={`text-[10px] font-medium ml-auto shrink-0 ${rsvpColor(a.responseStatus)}`}>
                      {a.responseStatus ?? 'invited'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open in Google Calendar */}
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Open in Google Calendar
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function CalendarView({ events, loading, onCreate, pendingApprovals = [], onApprovalResolved }: CalendarViewProps) {
  const [showCreate, setShowCreate] = useState(false);

  const createFields: WriteFormField[] = [
    { name: 'summary', label: 'Title', type: 'text', required: true, placeholder: 'Meeting title' },
    { name: 'startDateTime', label: 'Start', type: 'text', required: true, placeholder: 'YYYY-MM-DDTHH:mm:ss' },
    { name: 'endDateTime', label: 'End', type: 'text', required: true, placeholder: 'YYYY-MM-DDTHH:mm:ss' },
    { name: 'location', label: 'Location', type: 'text', placeholder: 'Conference Room A' },
    { name: 'attendees', label: 'Attendees', type: 'text', placeholder: 'email1@co.com, email2@co.com' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Meeting notes…' },
  ];

  const upcoming = events.filter((e) => isUpcoming(e.start));
  const past = events.filter((e) => !isUpcoming(e.start));

  return (
    <div className="flex flex-col h-full">
      {/* Pending approvals */}
      {pendingApprovals.length > 0 && (
        <div className="px-4 py-3 border-b border-amber-500/15 bg-amber-500/[0.03] space-y-1.5 shrink-0">
          <p className="text-[10px] text-amber-400/80 font-semibold uppercase tracking-wider mb-2">
            Awaiting your approval — {pendingApprovals.length} event{pendingApprovals.length !== 1 ? 's' : ''} to create
          </p>
          {pendingApprovals.map((a) => (
            <PendingApprovalRow key={a.id} approval={a} onResolved={onApprovalResolved ?? (() => {})} />
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 shrink-0">
        <span className="text-[11px] text-slate-500">{events.length} events</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 text-xs font-medium hover:bg-blue-600/30 transition-colors"
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : 'New Event'}
        </button>
      </div>

      {showCreate && (
        <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] shrink-0">
          <WriteForm
            title="New Event"
            fields={createFields}
            onSubmit={async (values) => { onCreate(values); setShowCreate(false); }}
            onCancel={() => setShowCreate(false)}
            submitLabel="Create Event"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="animate-pulse space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/[0.03] rounded-xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No events found</p>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {upcoming.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
                  Upcoming · {upcoming.length}
                </p>
                <div className="space-y-2">
                  {upcoming.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
                  Past · {past.length}
                </p>
                <div className="space-y-2 opacity-60">
                  {past.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
