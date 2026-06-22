"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit2,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPatients, deletePatient } from "@/lib/supabase/patients";
import { DeleteModal } from "@/components/patients/delete-modal";
import { PatientMetricsBar } from "@/components/patients/patient-metrics";
import type { Patient } from "@/lib/types";
import type { SortField, SortOrder, StatusFilter, PaginatedPatients } from "@/lib/supabase/patients";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-amber-50 text-amber-700",
  deceased: "bg-slate-100 text-slate-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize", STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

function SortIcon({ field, current, order }: { field: SortField; current: SortField; order: SortOrder }) {
  if (field !== current) return <ChevronsUpDown size={13} className="text-slate-300" />;
  return order === "asc"
    ? <ChevronUp size={13} className="text-blue-600" />
    : <ChevronDown size={13} className="text-blue-600" />;
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${50 + i * 8}%` }} />
        </td>
      ))}
    </tr>
  );
}

function formatDOB(dob: string | null): string {
  if (!dob) return "—";
  const date = new Date(dob);
  const now = new Date();
  const age = now.getFullYear() - date.getFullYear() -
    (now < new Date(now.getFullYear(), date.getMonth(), date.getDate()) ? 1 : 0);
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} (${age}y)`;
}

export default function PatientsPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedPatients | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPatients({
        search: debouncedSearch,
        status,
        sortBy,
        sortOrder,
        page,
        pageSize: 20,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load patients. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    const handler = () => setOpenMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deletePatient(deleteTarget.id);
    setDeleteTarget(null);
    fetchPatients();
  };

  const patients = result?.data ?? [];
  const totalPages = result?.totalPages ?? 1;
  const count = result?.count ?? 0;

  return (
    <div className="space-y-5">
      <PatientMetricsBar />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            className="w-full h-9 pl-8 pr-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-400 transition-colors"
            placeholder="Search by name, phone, patient #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setDebouncedSearch(search);
                setPage(1);
              }
            }}
          />
        </div>

        <select
          className="h-9 px-3 text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 cursor-pointer transition-colors"
          value={status}
          onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="deceased">Deceased</option>
        </select>

        <Link
          href="/patients/new"
          className="flex items-center gap-2 h-9 px-4 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors ml-auto"
        >
          <Plus size={15} />
          Add patient
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
          <span className="font-medium">Error:</span> {error}
          <button
            className="ml-auto text-[12px] font-medium text-red-600 hover:text-red-800 transition-colors"
            onClick={() => { setError(null); fetchPatients(); }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {!loading && patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
              <Users size={20} className="text-slate-400" />
            </div>
            <h3 className="text-[14px] font-semibold text-slate-700 mb-1">
              {debouncedSearch || status !== "all" ? "No patients found" : "No patients yet"}
            </h3>
            <p className="text-[12px] text-slate-400 max-w-xs">
              {debouncedSearch || status !== "all"
                ? "Try adjusting your search or filter to find what you're looking for."
                : "Add your first patient to start building your clinic's patient database."}
            </p>
            {!debouncedSearch && status === "all" && (
              <Link
                href="/patients/new"
                className="mt-5 flex items-center gap-2 h-8 px-4 text-[12px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={13} />
                Add first patient
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {[
                      { label: "Patient", field: "first_name" as SortField },
                      { label: "Patient #", field: "patient_number" as SortField },
                      { label: "Date of birth" },
                      { label: "Phone" },
                      { label: "Status", field: "status" as SortField },
                      { label: "" },
                    ].map(({ label, field }) => (
                      <th
                        key={label}
                        className={cn(
                          "px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]",
                          field && "cursor-pointer select-none hover:text-slate-700 group"
                        )}
                        onClick={() => field && toggleSort(field)}
                      >
                        {field ? (
                          <span className="flex items-center gap-1.5">
                            {label}
                            <SortIcon field={field} current={sortBy} order={sortOrder} />
                          </span>
                        ) : label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                    : patients.map((patient) => (
                      <tr
                        key={patient.id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/patients/${patient.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <User size={14} className="text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-slate-900 truncate">
                                {patient.first_name} {patient.last_name}
                              </p>
                              {patient.email && (
                                <p className="text-[11px] text-slate-400 truncate">{patient.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[12px] font-mono text-slate-600">
                            {patient.patient_number ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-slate-600">
                          {formatDOB(patient.date_of_birth)}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-slate-600">
                          {patient.phone}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={patient.status} />
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="relative flex justify-end">
                            <button
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenu(openMenu === patient.id ? null : patient.id);
                              }}
                            >
                              <MoreHorizontal size={15} />
                            </button>
                            {openMenu === patient.id && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-100 rounded-2xl shadow-lg shadow-slate-200/60 py-1 z-10">
                                <button
                                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors"
                                  onClick={() => router.push(`/patients/${patient.id}`)}
                                >
                                  <User size={13} className="text-slate-400" />
                                  View profile
                                </button>
                                <button
                                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors"
                                  onClick={() => router.push(`/patients/${patient.id}/edit`)}
                                >
                                  <Edit2 size={13} className="text-slate-400" />
                                  Edit patient
                                </button>
                                <div className="my-1 border-t border-slate-100" />
                                <button
                                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-red-600 hover:bg-red-50 transition-colors"
                                  onClick={() => { setDeleteTarget(patient); setOpenMenu(null); }}
                                >
                                  <Trash2 size={13} />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-[12px] text-slate-500">
                  Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, count)} of {count.toLocaleString()} patients
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          "w-7 h-7 text-[12px] font-medium rounded-lg transition-colors",
                          page === p
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {deleteTarget && (
        <DeleteModal
          patientName={`${deleteTarget.first_name} ${deleteTarget.last_name}`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
