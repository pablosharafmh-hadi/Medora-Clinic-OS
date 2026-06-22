"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  List,
  Calendar,
  CalendarDays,
  MoreHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Stethoscope,
  Clock,
  Trash2,
  Edit2,
  CheckCircle,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAppointments,
  deleteAppointment,
  updateAppointmentStatus,
} from "@/lib/supabase/appointments";
import { AppointmentMetricsBar } from "@/components/appointments/appointment-metrics";
import { WeekCalendar } from "@/components/appointments/week-calendar";
import { MonthCalendar } from "@/components/appointments/month-calendar";
import { StatusBadge, TypeBadge } from "@/components/appointments/status-badge";
import type {
  AppointmentWithRelations,
  AppointmentStatus,
} from "@/lib/types";
import type { StatusFilter, TypeFilter, PaginatedAppointments } from "@/lib/supabase/appointments";

type View = "list" | "week" | "month";

// ─── Delete confirmation ──────────────────────────────────────────────────────

function DeleteModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setDeleting(true);
    setError(null);
    try { await onConfirm(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed."); setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-900">Cancel appointment</p>
            <p className="text-[12px] text-slate-500">This will permanently delete the record</p>
          </div>
        </div>
        <p className="text-[13px] text-slate-600 mb-4">
          Delete appointment for <span className="font-semibold">{name}</span>? This action cannot be undone.
        </p>
        {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={deleting} className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
            Keep
          </button>
          <button onClick={go} disabled={deleting} className="flex-1 h-9 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  // List-view state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedAppointments | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentWithRelations | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAppointments({ status: statusFilter, type: typeFilter, page, pageSize: 25 });
      setResult(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter, typeFilter, page]);

  useEffect(() => {
    if (view === "list") fetchList();
  }, [view, fetchList]);

  useEffect(() => {
    const handler = () => setOpenMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    await updateAppointmentStatus(id, status);
    fetchList();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteAppointment(deleteTarget.id);
    setDeleteTarget(null);
    fetchList();
  };

  const appointments = result?.data ?? [];
  const totalPages = result?.totalPages ?? 1;
  const count = result?.count ?? 0;

  return (
    <div className="space-y-5">
      <AppointmentMetricsBar />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* View toggle */}
        <div className="flex items-center bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden p-0.5 gap-0.5">
          {([
            { v: "list" as View, icon: List, label: "List" },
            { v: "week" as View, icon: Calendar, label: "Week" },
            { v: "month" as View, icon: CalendarDays, label: "Month" },
          ] as const).map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium rounded-md transition-all",
                view === v
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {view === "list" && (
          <>
            <div className="relative">
              <select
                className="h-9 pl-3 pr-8 text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 cursor-pointer appearance-none"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
              >
                <option value="all">All statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked In</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                className="h-9 pl-3 pr-8 text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 cursor-pointer appearance-none"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value as TypeFilter); setPage(1); }}
              >
                <option value="all">All types</option>
                <option value="consultation">Consultation</option>
                <option value="follow_up">Follow-Up</option>
                <option value="procedure">Procedure</option>
                <option value="check_up">Check-Up</option>
                <option value="emergency">Emergency</option>
                <option value="custom">Custom</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </>
        )}

        <Link
          href="/appointments/new"
          className="flex items-center gap-2 h-9 px-4 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors ml-auto"
        >
          <Plus size={14} />
          New appointment
        </Link>
      </div>

      {/* Views */}
      {view === "week" && (
        <WeekCalendar currentDate={currentDate} onDateChange={setCurrentDate} />
      )}

      {view === "month" && (
        <MonthCalendar currentDate={currentDate} onDateChange={(d) => { setCurrentDate(d); setView("week"); }} />
      )}

      {view === "list" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {!loading && appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                <Calendar size={20} className="text-slate-400" />
              </div>
              <h3 className="text-[14px] font-semibold text-slate-700 mb-1">
                {statusFilter !== "all" || typeFilter !== "all" ? "No appointments found" : "No appointments yet"}
              </h3>
              <p className="text-[12px] text-slate-400 max-w-xs">
                {statusFilter !== "all" || typeFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Schedule your first appointment to get started."}
              </p>
              {statusFilter === "all" && typeFilter === "all" && (
                <Link href="/appointments/new" className="mt-4 flex items-center gap-2 h-8 px-4 text-[12px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus size={13} />
                  New appointment
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      {["Date & time", "Patient", "Doctor", "Type", "Duration", "Status", ""].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading
                      ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                      : appointments.map((apt) => {
                          const { date, time } = formatDateTime(apt.scheduled_at);
                          const patientName = apt.patient
                            ? `${apt.patient.first_name} ${apt.patient.last_name}`
                            : "—";
                          const doctorName = apt.doctor
                            ? `Dr. ${apt.doctor.first_name} ${apt.doctor.last_name}`
                            : "—";

                          return (
                            <tr
                              key={apt.id}
                              className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                              onClick={() => router.push(`/appointments/${apt.id}`)}
                            >
                              <td className="px-4 py-3">
                                <p className="text-[13px] font-semibold text-slate-800">{time}</p>
                                <p className="text-[11px] text-slate-400">{date}</p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                    <User size={13} className="text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-medium text-slate-800 truncate max-w-[140px]">{patientName}</p>
                                    {apt.patient?.patient_number && (
                                      <p className="text-[10px] font-mono text-slate-400">{apt.patient.patient_number}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                    <Stethoscope size={13} className="text-emerald-600" />
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-medium text-slate-800 truncate max-w-[130px]">{doctorName}</p>
                                    {apt.doctor?.specialty && (
                                      <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{apt.doctor.specialty}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <TypeBadge type={apt.type} customLabel={apt.custom_type_label} />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 text-[12px] text-slate-600">
                                  <Clock size={11} className="text-slate-400" />
                                  {apt.duration_minutes} min
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={apt.status} />
                              </td>
                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <div className="relative flex justify-end">
                                  <button
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === apt.id ? null : apt.id); }}
                                  >
                                    <MoreHorizontal size={15} />
                                  </button>
                                  {openMenu === apt.id && (
                                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-100 rounded-2xl shadow-lg shadow-slate-200/60 py-1 z-10">
                                      <button className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => router.push(`/appointments/${apt.id}`)}>
                                        <User size={13} className="text-slate-400" /> View details
                                      </button>
                                      <button className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => router.push(`/appointments/${apt.id}/edit`)}>
                                        <Edit2 size={13} className="text-slate-400" /> Edit
                                      </button>
                                      {apt.status === "scheduled" && (
                                        <button className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-blue-700 hover:bg-blue-50 transition-colors" onClick={() => handleStatusChange(apt.id, "confirmed")}>
                                          <CheckCircle size={13} /> Confirm
                                        </button>
                                      )}
                                      {(apt.status === "scheduled" || apt.status === "confirmed") && (
                                        <button className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-violet-700 hover:bg-violet-50 transition-colors" onClick={() => handleStatusChange(apt.id, "checked_in")}>
                                          <UserCheck size={13} /> Check in
                                        </button>
                                      )}
                                      <div className="my-1 border-t border-slate-100" />
                                      <button className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-red-600 hover:bg-red-50 transition-colors" onClick={() => { setDeleteTarget(apt); setOpenMenu(null); }}>
                                        <Trash2 size={13} /> Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <p className="text-[12px] text-slate-500">
                    Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, count)} of {count.toLocaleString()} appointments
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      const p = i + 1;
                      return (
                        <button key={p} onClick={() => setPage(p)} className={cn("w-7 h-7 text-[12px] font-medium rounded-lg transition-colors", page === p ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
                          {p}
                        </button>
                      );
                    })}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.patient ? `${deleteTarget.patient.first_name} ${deleteTarget.patient.last_name}` : "this appointment"}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
