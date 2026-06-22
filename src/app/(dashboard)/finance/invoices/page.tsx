"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  FileText,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getInvoices, deleteInvoice } from "@/lib/supabase/invoices";
import { InvoiceStatusBadge, formatCurrency } from "@/components/finance/invoice-status-badge";
import type { InvoiceWithRelations, InvoiceStatus } from "@/lib/types";

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${40 + i * 7}%` }} />
        </td>
      ))}
    </tr>
  );
}

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Partial", value: "partially_paid" },
  { label: "Overdue", value: "overdue" },
  { label: "Cancelled", value: "cancelled" },
];

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceWithRelations | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getInvoices({ search: debouncedSearch, status, page, pageSize: 20 });
      setInvoices(result.data);
      setTotalPages(result.totalPages);
      setTotalCount(result.count);
    } catch {
      setError("Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, page]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteInvoice(deleteTarget.id);
      setDeleteTarget(null);
      fetchInvoices();
    } catch {
      setError("Failed to delete invoice.");
    } finally {
      setDeleting(false);
    }
  };

  const pageSize = 20;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by patient name or invoice #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setDebouncedSearch(search); setPage(1); } }}
            className="w-full h-9 pl-8 pr-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-400 transition-colors"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-9 px-3 text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 cursor-pointer transition-colors"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <Link
          href="/finance/invoices/new"
          className="flex items-center gap-2 h-9 px-4 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors ml-auto"
        >
          <Plus size={14} />
          New invoice
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
          <span className="font-medium">Error:</span> {error}
          <button className="ml-auto text-[12px] font-medium text-red-600 hover:text-red-800" onClick={() => { setError(null); fetchInvoices(); }}>
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {!loading && invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
              <FileText size={20} className="text-slate-400" />
            </div>
            <h3 className="text-[14px] font-semibold text-slate-700 mb-1">
              {debouncedSearch || status !== "all" ? "No invoices found" : "No invoices yet"}
            </h3>
            <p className="text-[12px] text-slate-400 max-w-xs">
              {debouncedSearch || status !== "all"
                ? "Try adjusting your search or filter."
                : "Create your first invoice to start tracking patient billing."}
            </p>
            {!debouncedSearch && status === "all" && (
              <Link href="/finance/invoices/new" className="mt-5 flex items-center gap-2 h-8 px-4 text-[12px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                <Plus size={13} />
                Create invoice
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {["Invoice #", "Patient", "Issue Date", "Due Date", "Total", "Paid", "Balance", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                    : invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                      >
                        <td className="px-4 py-3">
                          <span className="text-[12px] font-mono font-semibold text-slate-700">
                            {inv.invoice_number ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-slate-800">
                          {inv.patient
                            ? `${inv.patient.first_name} ${inv.patient.last_name}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-slate-500">
                          {new Date(inv.issue_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-slate-500">
                          {inv.due_date
                            ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-semibold text-slate-800">
                          {formatCurrency(inv.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-emerald-600 font-medium">
                          {formatCurrency(inv.amount_paid)}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-[13px] font-medium",
                          inv.balance_due > 0 ? "text-red-600" : "text-slate-400"
                        )}>
                          {formatCurrency(inv.balance_due)}
                        </td>
                        <td className="px-4 py-3">
                          <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Eye size={13} />
                            </button>
                            {(inv.status === "draft" || inv.status === "cancelled") && (
                              <button
                                onClick={() => setDeleteTarget(inv)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-[12px] text-slate-500">
                  Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()} invoices
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

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-[14px] font-semibold text-slate-900 mb-2">Delete invoice?</p>
            <p className="text-[13px] text-slate-600 mb-5">
              Invoice <span className="font-mono font-semibold">{deleteTarget.invoice_number}</span> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                Keep
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 h-9 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
