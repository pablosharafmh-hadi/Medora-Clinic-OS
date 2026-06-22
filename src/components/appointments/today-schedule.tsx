"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, ArrowRight, Plus, Clock, User } from "lucide-react";
import { getTodayAppointments } from "@/lib/supabase/appointments";
import { StatusBadge } from "@/components/appointments/status-badge";
import type { AppointmentWithRelations } from "@/lib/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const TYPE_DOT: Record<string, string> = {
  consultation: "bg-blue-500",
  follow_up:    "bg-violet-500",
  procedure:    "bg-amber-500",
  check_up:     "bg-emerald-500",
  emergency:    "bg-red-500",
  custom:       "bg-slate-400",
};

export function TodaySchedule() {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTodayAppointments()
      .then(setAppointments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-[14px] font-bold text-slate-900">Today&apos;s Schedule</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <Link
          href="/appointments"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          Open calendar
          <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="flex-1 p-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 px-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <CalendarCheck size={20} className="text-slate-400" />
          </div>
          <p className="text-[13px] font-semibold text-slate-700">No appointments today</p>
          <p className="text-[12px] text-slate-400 mt-1.5 max-w-[220px] leading-relaxed">
            Your clinic has no visits scheduled for today.
          </p>
          <Link
            href="/appointments/new"
            className="mt-4 inline-flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus size={12} />
            Schedule appointment
          </Link>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {appointments.map((apt) => (
            <Link
              key={apt.id}
              href={`/appointments/${apt.id}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group"
            >
              <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
                <span className="text-[13px] font-bold text-slate-800">
                  {formatTime(apt.scheduled_at)}
                </span>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Clock size={9} />
                  {apt.duration_minutes}m
                </div>
              </div>

              <div className={`w-1 h-10 rounded-full flex-shrink-0 ${TYPE_DOT[apt.type] ?? TYPE_DOT.custom}`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-slate-800 truncate">
                    {apt.patient
                      ? `${apt.patient.first_name} ${apt.patient.last_name}`
                      : "Unknown patient"}
                  </p>
                  <StatusBadge status={apt.status} size="xs" />
                </div>
                {apt.doctor && (
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    Dr. {apt.doctor.first_name} {apt.doctor.last_name} · {apt.doctor.specialty}
                  </p>
                )}
              </div>

              <ArrowRight
                size={13}
                className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0"
              />
            </Link>
          ))}
        </div>
      )}

      {!loading && appointments.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100">
          <Link
            href="/appointments"
            className="flex items-center justify-center gap-2 text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View full calendar
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
