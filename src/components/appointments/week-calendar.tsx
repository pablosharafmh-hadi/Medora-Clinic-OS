"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAppointmentsForDateRange } from "@/lib/supabase/appointments";
import type { AppointmentWithRelations } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 56; // px per hour
const DAY_START = 8;    // 8am
const DAY_END = 19;     // 7pm (exclusive, so shows up to 18:59)
const PX_PER_MIN = HOUR_HEIGHT / 60;
const CALENDAR_HEIGHT = (DAY_END - DAY_START) * HOUR_HEIGHT;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

// ─── Type colors ──────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  consultation: { bg: "bg-blue-100",   border: "border-blue-300",   text: "text-blue-900" },
  follow_up:    { bg: "bg-violet-100", border: "border-violet-300", text: "text-violet-900" },
  procedure:    { bg: "bg-amber-100",  border: "border-amber-300",  text: "text-amber-900" },
  check_up:     { bg: "bg-emerald-100",border: "border-emerald-300",text: "text-emerald-900" },
  emergency:    { bg: "bg-red-100",    border: "border-red-300",    text: "text-red-900" },
  custom:       { bg: "bg-slate-100",  border: "border-slate-300",  text: "text-slate-800" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}${ampm}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WeekCalendarProps {
  currentDate: Date;
  onDateChange: (d: Date) => void;
}

export function WeekCalendar({ currentDate, onDateChange }: WeekCalendarProps) {
  const router = useRouter();
  const today = new Date();

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekStartKey = weekStart.toISOString().slice(0, 10);

  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const end = new Date(weekDays[6]);
    end.setHours(23, 59, 59, 999);
    setLoading(true);
    getAppointmentsForDateRange(weekDays[0], end)
      .then(setAppointments)
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartKey]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    onDateChange(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    onDateChange(d);
  };

  const weekLabel = `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // Current time indicator
  const nowMins = (today.getHours() - DAY_START) * 60 + today.getMinutes();
  const nowTop = nowMins * PX_PER_MIN;
  const showNow = nowMins >= 0 && nowMins <= (DAY_END - DAY_START) * 60;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Navigation bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={14} className="text-slate-500" />
          </button>
          <span className="text-[13px] font-semibold text-slate-800">{weekLabel}</span>
          <button
            onClick={nextWeek}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={14} className="text-slate-500" />
          </button>
        </div>
        <button
          onClick={() => onDateChange(new Date())}
          className="h-7 px-3 text-[12px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Today
        </button>
      </div>

      {/* Day column headers */}
      <div
        className="grid border-b border-slate-100"
        style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}
      >
        <div className="border-r border-slate-100 h-10" />
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className="h-10 flex flex-col items-center justify-center border-r border-slate-100 last:border-r-0"
            >
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.08em]">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span
                className={cn(
                  "text-[13px] font-bold mt-0.5 w-6 h-6 flex items-center justify-center rounded-full",
                  isToday ? "bg-blue-600 text-white" : "text-slate-700"
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="overflow-y-auto" style={{ maxHeight: "560px" }}>
        <div
          className="relative grid"
          style={{ gridTemplateColumns: "52px repeat(7, 1fr)", height: CALENDAR_HEIGHT }}
        >
          {/* Time gutter */}
          <div className="relative border-r border-slate-100">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-slate-100 flex items-start"
                style={{ top: (h - DAY_START) * HOUR_HEIGHT }}
              >
                <span className="text-[9px] text-slate-400 px-1.5 pt-0.5">{formatHour(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, colIdx) => {
            const isToday = isSameDay(day, today);
            const dayAppts = appointments.filter((a) =>
              isSameDay(new Date(a.scheduled_at), day)
            );

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative border-r border-slate-100 last:border-r-0",
                  isToday && "bg-blue-50/25"
                )}
                style={{ height: CALENDAR_HEIGHT }}
              >
                {/* Gridlines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-slate-100"
                    style={{ top: (h - DAY_START) * HOUR_HEIGHT }}
                  />
                ))}
                {HOURS.map((h) => (
                  <div
                    key={`${h}-half`}
                    className="absolute left-0 right-0 border-t border-slate-50"
                    style={{ top: (h - DAY_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                ))}

                {/* Click to create */}
                <div
                  className="absolute inset-0 cursor-pointer group"
                  onClick={() => {
                    const dateStr = day.toISOString().slice(0, 10);
                    router.push(`/appointments/new?date=${dateStr}`);
                  }}
                >
                  <div className="absolute inset-0 group-hover:bg-blue-50/40 transition-colors" />
                  <Plus
                    size={14}
                    className="absolute right-1 top-1 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>

                {/* Current time line */}
                {isToday && showNow && (
                  <div
                    className="absolute left-0 right-0 flex items-center z-10 pointer-events-none"
                    style={{ top: nowTop }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                    <div className="flex-1 h-px bg-red-400" />
                  </div>
                )}

                {/* Appointments */}
                {dayAppts.map((apt) => {
                  const d = new Date(apt.scheduled_at);
                  const minsFromStart = (d.getHours() - DAY_START) * 60 + d.getMinutes();
                  if (minsFromStart < 0 || minsFromStart >= (DAY_END - DAY_START) * 60) return null;
                  const top = minsFromStart * PX_PER_MIN;
                  const height = Math.max(apt.duration_minutes * PX_PER_MIN, 28);
                  const style = TYPE_STYLES[apt.type] ?? TYPE_STYLES.custom;

                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        "absolute rounded-md border px-1.5 py-1 overflow-hidden cursor-pointer z-10",
                        "hover:brightness-95 transition-all",
                        style.bg,
                        style.border
                      )}
                      style={{ top, height, left: 3, right: 3 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/appointments/${apt.id}`);
                      }}
                    >
                      <p className={cn("text-[10px] font-bold truncate leading-tight", style.text)}>
                        {formatTime(d)}
                      </p>
                      {height >= 36 && apt.patient && (
                        <p className={cn("text-[10px] truncate", style.text, "opacity-80")}>
                          {apt.patient.first_name} {apt.patient.last_name}
                        </p>
                      )}
                      {height >= 50 && apt.doctor && (
                        <p className={cn("text-[9px] truncate opacity-60", style.text)}>
                          Dr. {apt.doctor.last_name}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
          <div className="text-[12px] text-slate-400">Loading schedule…</div>
        </div>
      )}
    </div>
  );
}
