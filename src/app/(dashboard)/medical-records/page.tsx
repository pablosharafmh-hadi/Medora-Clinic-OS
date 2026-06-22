"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ChevronDown,
  FileText,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  Shield,
  Lock,
  CalendarClock,
} from "lucide-react";
import { getMedicalRecords, deleteMedicalRecord } from "@/lib/supabase/medical-records";
import { getAllDoctors } from "@/lib/supabase/doctors";
import { RecordMetricsBar } from "@/components/medical-records/record-metrics";
import { RecordStatusBadge } from "@/components/medical-records/record-status-badge";
import type { MedicalRecordWithRelations, Doctor } from "@/lib/types";

function useDebounce<T>(value: T, ms: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debouncedValue;
}

export default function MedicalRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<MedicalRecordWithRelations[]>([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "final" | "amended">("all");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const PAGE_SIZE = 20;

  useEffect(() => {
    getAllDoctors().then(setDoctors).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMedicalRecords({
        search: debouncedSearch,
        status: statusFilter,
        doctorId: doctorFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setRecords(result.data);
      setCount(result.count);
      setTotalPages(result.totalPages);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, doctorFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, doctorFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMedicalRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setCount((c) => c - 1);
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* HIPAA notice */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl">
        <Shield size={15} className="text-blue-600 shrink-0" />
        <p className="text-[12px] text-blue-700 font-medium">
          Medical records are protected. All access is logged and audited for compliance.
        </p>
        <Lock size={12} className="text-blue-400 ml-auto shrink-0" />
      </div>

      <RecordMetricsBar />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search complaint or diagnosis…"
              className="pl-9 pr-4 h-9 text-[13px] bg-white border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 pl-3 pr-8 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none transition-colors"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="final">Final</option>
              <option value="amended">Amended</option>
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="h-9 pl-3 pr-8 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none transition-colors"
            >
              <option value="">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <Link
          href="/medical-records/new"
          className="flex items-center gap-2 h-9 px-4 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={14} />
          New record
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-slate-900">Medical records</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {loading ? "Loading…" : `${count} record${count !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {["Date", "Patient", "Doctor", "Chief complaint", "Diagnosis", "Rx", "Follow-up", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + (j * 17) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <FileText size={20} className="text-slate-400" />
                      </div>
                      <p className="text-[13px] font-semibold text-slate-700">No records found</p>
                      <p className="text-[12px] text-slate-400 max-w-xs leading-relaxed text-center">
                        {search || statusFilter !== "all" || doctorFilter
                          ? "Try adjusting your filters."
                          : "Medical records will appear here once clinical visits are documented."}
                      </p>
                      <Link
                        href="/medical-records/new"
                        className="mt-1 flex items-center gap-2 h-8 px-4 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        <Plus size={13} />
                        Create first record
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const patientName = r.patient
                    ? `${r.patient.first_name} ${r.patient.last_name}`
                    : "Unknown";
                  const doctorName = r.doctor ? `Dr. ${r.doctor.last_name}` : "—";
                  const visitDate = new Date(r.visit_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                      onClick={() => router.push(`/medical-records/${r.id}`)}
                    >
                      <td className="px-4 py-3 text-[12px] text-slate-600 whitespace-nowrap font-mono">
                        {visitDate}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-slate-800">{patientName}</p>
                        {r.patient?.patient_number && (
                          <p className="text-[11px] font-mono text-slate-400">{r.patient.patient_number}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-600 whitespace-nowrap">
                        {doctorName}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-700 max-w-[180px]">
                        <p className="truncate">{r.chief_complaint}</p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-600 max-w-[160px]">
                        <p className="truncate">{r.diagnosis ?? <span className="text-slate-300 text-[12px]">—</span>}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.prescriptions.length > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-50 text-violet-700 text-[11px] font-bold">
                            {r.prescriptions.length}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.follow_up_required ? (
                          <div className="flex items-center gap-1">
                            <CalendarClock size={12} className="text-amber-500" />
                            <span className="text-[11px] text-amber-600 font-medium">
                              {r.follow_up_date
                                ? new Date(r.follow_up_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                : "Yes"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RecordStatusBadge status={r.status} />
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative">
                          {pendingDeleteId === r.id ? (
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle size={12} className="text-red-500" />
                              <button
                                onClick={() => handleDelete(r.id)}
                                disabled={deletingId === r.id}
                                className="px-2 h-6 text-[11px] font-semibold text-white bg-red-600 rounded hover:bg-red-700 transition-colors disabled:opacity-60"
                              >
                                {deletingId === r.id ? "…" : "Delete"}
                              </button>
                              <button
                                onClick={() => setPendingDeleteId(null)}
                                className="px-2 h-6 text-[11px] text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
                              >
                                Keep
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === r.id ? null : r.id);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          )}

                          {openMenuId === r.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-2xl border border-slate-100 shadow-lg z-10 overflow-hidden">
                              <Link
                                href={`/medical-records/${r.id}`}
                                className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Eye size={13} /> View record
                              </Link>
                              <Link
                                href={`/medical-records/${r.id}/edit`}
                                className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Edit2 size={13} /> Edit record
                              </Link>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingDeleteId(r.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[12px] text-slate-500">
              Page {page} of {totalPages} · {count} total
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
