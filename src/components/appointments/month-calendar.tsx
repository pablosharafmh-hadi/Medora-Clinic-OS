"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAppointmentsForDateRange } from "@/lib/supabase/appointments";
import type { AppointmentWithRelations } from "@/lib/types";

const TYPE_DOT: Record<string, string> = {
  consultation: "bg-blue-500",
  follow_up:    "bg-violet-500",
  procedure:    "bg-amber-500",
  check_up:     "bg-emerald-500",
  emergency:    "bg-red-500",
  custom:       "bg-slate-400",
};

function getMonthDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1; // Mon = 0
  const endPad = last.getDay() === 0 ? 0 : 7 - last.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  for (let i = 0; i < endPad; i++) cells.push(null);
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

interface MonthCalendarProps {
  currentDate: Date;
  onDateChange: (d: Date) => void;
}

export function MonthCalendar({ currentDate, onDateChange }: MonthCalendarProps) {
  const router = useRouter();
  const today = new Date();

  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth());
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);

  useEffect(() => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    setLoading(true);
    getAppointmentsForDateRange(start, end)
      .then(setAppointments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const getAptsForDay = (day: Date) =>
    appointments.filter((a) => isSameDay(new Date(a.scheduled_at), day));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Navigation */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft size={14} className="text-slate-500" />
          </button>
          <span className="text-[13px] font-semibold text-slate-800 min-w-[140px] text-center">
            {monthLabel}
          </span>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight size={14} className="text-slate-500" />
          </button>
        </div>
        <button
          onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); onDateChange(today); }}
          className="h-7 px-3 text-[12px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Today
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em]">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {monthDays.map((day, idx) => {
          if (!day) {
            return <div key={`pad-${idx}`} className="min-h-[90px] border-b border-r border-slate-50 last:border-r-0" />;
          }

          const isToday = isSameDay(day, today);
          const isCurrentMonth = day.getMonth() === month;
          const apts = getAptsForDay(day);
          const shown = apts.slice(0, 3);
          const overflow = apts.length - shown.length;
          const colIdx = idx % 7;
          const isLastCol = colIdx === 6;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[90px] p-1.5 border-b border-r border-slate-50 cursor-pointer group transition-colors",
                isLastCol && "border-r-0",
                isToday ? "bg-blue-50/40" : "hover:bg-slate-50/60",
                !isCurrentMonth && "opacity-40"
              )}
              onClick={() => {
                onDateChange(day);
                router.push(`/appointments/new?date=${day.toISOString().slice(0, 10)}`);
              }}
            >
              <div className={cn(
                "w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-semibold mb-1",
                isToday ? "bg-blue-600 text-white" : "text-slate-700 group-hover:bg-slate-100"
              )}>
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {shown.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium text-slate-700 hover:bg-slate-100 truncate"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/appointments/${apt.id}`);
                    }}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", TYPE_DOT[apt.type] ?? TYPE_DOT.custom)} />
                    <span className="truncate">
                      {new Date(apt.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", hour12: true })}
                      {apt.patient ? ` ${apt.patient.first_name}` : ""}
                    </span>
                  </div>
                ))}
                {overflow > 0 && (
                  <div className="text-[9px] text-slate-400 pl-1">+{overflow} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
