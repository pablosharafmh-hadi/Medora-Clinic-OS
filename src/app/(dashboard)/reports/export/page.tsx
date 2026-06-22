"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Stethoscope, CreditCard, CalendarCheck,
  FileDown, FileSpreadsheet, FileText, Printer,
  AlertCircle, Loader2, ChevronRight, Filter,
  TrendingUp, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPatientSummaryReport,
  getPatientVisitHistoryReport,
  getPatientPaymentHistoryReport,
  getPatientOutstandingBalanceReport,
  getDoctorPerformanceReport,
  getRevenueReport,
  getOutstandingInvoicesReport,
  getPaymentSummaryReport,
  getAppointmentReport,
  getReportDoctors,
  getReportPatients,
  type ReportFilters,
  type ReportData,
  type DoctorOption,
  type PatientOption,
} from "@/lib/supabase/reports";
import { exportToPDF, exportToExcel, exportToCSV, printReport } from "@/lib/export/pdf";

// ─── Report catalog ───────────────────────────────────────────────────────────

type FilterKey = "dateRange" | "doctor" | "patient" | "status" | "paymentMethod";

type ReportConfig = {
  id: string;
  label: string;
  description: string;
  category: "patient" | "doctor" | "financial" | "appointment";
  filters: FilterKey[];
  statusOptions?: { value: string; label: string }[];
  paymentMethodOptions?: { value: string; label: string }[];
  run: (f: ReportFilters) => Promise<ReportData>;
};

const PAYMENT_METHODS = [
  { value: "cash",          label: "Cash" },
  { value: "credit_card",   label: "Credit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "insurance",     label: "Insurance" },
  { value: "other",         label: "Other" },
];

const APT_STATUSES = [
  { value: "scheduled",  label: "Scheduled" },
  { value: "confirmed",  label: "Confirmed" },
  { value: "completed",  label: "Completed" },
  { value: "cancelled",  label: "Cancelled" },
  { value: "no_show",    label: "No Show" },
];

const INV_STATUSES = [
  { value: "pending",         label: "Pending" },
  { value: "partially_paid",  label: "Partially Paid" },
  { value: "paid",            label: "Paid" },
  { value: "overdue",         label: "Overdue" },
];

const PAT_STATUSES = [
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const REPORT_CATALOG: ReportConfig[] = [
  // ── Patient ──
  {
    id: "patient-summary",
    label: "Patient Summary",
    description: "Complete list of patients with demographics and registration date.",
    category: "patient",
    filters: ["dateRange", "status"],
    statusOptions: PAT_STATUSES,
    run: getPatientSummaryReport,
  },
  {
    id: "patient-visits",
    label: "Visit History",
    description: "All appointments for a patient or date range, including doctor and service.",
    category: "patient",
    filters: ["dateRange", "patient", "doctor", "status"],
    statusOptions: APT_STATUSES,
    run: getPatientVisitHistoryReport,
  },
  {
    id: "patient-payments",
    label: "Payment History",
    description: "Payments collected, linked to patients and invoices.",
    category: "patient",
    filters: ["dateRange", "patient", "paymentMethod"],
    paymentMethodOptions: PAYMENT_METHODS,
    run: getPatientPaymentHistoryReport,
  },
  {
    id: "patient-outstanding",
    label: "Outstanding Balance",
    description: "Patients with unpaid or partially paid invoices.",
    category: "patient",
    filters: ["dateRange", "patient", "status"],
    statusOptions: INV_STATUSES,
    run: getPatientOutstandingBalanceReport,
  },
  // ── Doctor ──
  {
    id: "doctor-performance",
    label: "Doctor Performance",
    description: "Appointments, completion rate, patients seen, and revenue per doctor.",
    category: "doctor",
    filters: ["dateRange", "doctor"],
    run: getDoctorPerformanceReport,
  },
  // ── Financial ──
  {
    id: "revenue-report",
    label: "Revenue Report",
    description: "Individual payment transactions with method and invoice reference.",
    category: "financial",
    filters: ["dateRange", "paymentMethod"],
    paymentMethodOptions: PAYMENT_METHODS,
    run: getRevenueReport,
  },
  {
    id: "outstanding-invoices",
    label: "Outstanding Invoices",
    description: "Unpaid and overdue invoices with balance and due dates.",
    category: "financial",
    filters: ["dateRange", "status"],
    statusOptions: INV_STATUSES,
    run: getOutstandingInvoicesReport,
  },
  {
    id: "payment-summary",
    label: "Payment Summary",
    description: "Revenue aggregated by payment method with transaction counts.",
    category: "financial",
    filters: ["dateRange"],
    run: getPaymentSummaryReport,
  },
  // ── Appointments ──
  {
    id: "appointment-report",
    label: "Appointment Report",
    description: "All appointments with patient, doctor, service, and status details.",
    category: "appointment",
    filters: ["dateRange", "doctor", "patient", "status"],
    statusOptions: APT_STATUSES,
    run: getAppointmentReport,
  },
];

const CATEGORIES: { key: ReportConfig["category"]; label: string; icon: React.ElementType; color: string }[] = [
  { key: "patient",     label: "Patient",      icon: Users,         color: "text-blue-600" },
  { key: "doctor",      label: "Doctor",       icon: Stethoscope,   color: "text-violet-600" },
  { key: "financial",   label: "Financial",    icon: CreditCard,    color: "text-emerald-600" },
  { key: "appointment", label: "Appointments", icon: CalendarCheck, color: "text-amber-600" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function monthStartStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
}

function buildSubtitle(f: ReportFilters, doctors: DoctorOption[], patients: PatientOption[]): string {
  const parts: string[] = [];
  parts.push(`${f.from} to ${f.to}`);
  if (f.doctorId) {
    const d = doctors.find((x) => x.id === f.doctorId);
    if (d) parts.push(`Doctor: ${d.name}`);
  }
  if (f.patientId) {
    const p = patients.find((x) => x.id === f.patientId);
    if (p) parts.push(`Patient: ${p.name}`);
  }
  if (f.status)        parts.push(`Status: ${f.status}`);
  if (f.paymentMethod) parts.push(`Method: ${f.paymentMethod}`);
  return parts.join("  |  ");
}

const PREVIEW_LIMIT = 100;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExportCenterPage() {
  const [selected, setSelected]   = useState<ReportConfig | null>(null);
  const [filters, setFilters]     = useState<ReportFilters>({ from: monthStartStr(), to: todayStr() });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [doctors, setDoctors]     = useState<DoctorOption[]>([]);
  const [patients, setPatients]   = useState<PatientOption[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    getReportDoctors().then(setDoctors).catch(console.error);
    getReportPatients().then(setPatients).catch(console.error);
  }, []);

  const selectReport = (cfg: ReportConfig) => {
    setSelected(cfg);
    setReportData(null);
    setError(null);
    setFilters({ from: monthStartStr(), to: todayStr() });
  };

  const generate = useCallback(async () => {
    if (!selected) return;
    setGenerating(true);
    setError(null);
    setReportData(null);
    try {
      const data = await selected.run(filters);
      setReportData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  }, [selected, filters]);

  const handleExport = async (type: "pdf" | "excel" | "csv" | "print") => {
    if (!reportData || !selected) return;
    setExporting(type);
    const cfg = {
      title: selected.label,
      subtitle: buildSubtitle(filters, doctors, patients),
      columns: reportData.columns,
      rows: reportData.rows,
      filename: selected.id,
    };
    try {
      if (type === "pdf")   await exportToPDF(cfg);
      if (type === "excel") await exportToExcel(cfg);
      if (type === "csv")   exportToCSV(cfg);
      if (type === "print") printReport(cfg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  };

  const setFilter = (key: keyof ReportFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setReportData(null);
  };

  const previewRows  = reportData?.rows.slice(0, PREVIEW_LIMIT) ?? [];
  const hasMore      = (reportData?.totalRows ?? 0) > PREVIEW_LIMIT;

  return (
    <div className="flex gap-5 h-[calc(100vh-80px)]">

      {/* ── Left: Report Catalog ── */}
      <div className="w-[220px] flex-shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-y-auto">
        <div className="px-4 pt-4 pb-3 border-b border-slate-50">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Report Catalog</p>
        </div>
        <div className="p-2 space-y-3">
          {CATEGORIES.map(({ key, label, icon: Icon, color }) => {
            const items = REPORT_CATALOG.filter((r) => r.category === key);
            return (
              <div key={key}>
                <div className={cn("flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider", color)}>
                  <Icon size={11} />
                  {label}
                </div>
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectReport(item)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-[12px] transition-colors mb-0.5",
                      selected?.id === item.id
                        ? "bg-blue-600 text-white font-medium"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                    <ChevronRight size={11} className={cn("flex-shrink-0 ml-1", selected?.id === item.id ? "text-blue-200" : "text-slate-300")} />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Report Panel ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">

        {/* Empty state */}
        {!selected && (
          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <TrendingUp size={26} className="text-slate-300" />
            </div>
            <h3 className="text-[15px] font-bold text-slate-800">Select a report</h3>
            <p className="text-[13px] text-slate-400 mt-1.5 text-center max-w-xs leading-relaxed">
              Choose a report type from the catalog on the left to configure filters and generate data.
            </p>
            <div className="flex flex-wrap gap-2 mt-5 justify-center">
              {REPORT_CATALOG.slice(0, 4).map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectReport(r)}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Report config card */}
        {selected && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">

            {/* Title row */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">{selected.label}</h2>
                <p className="text-[12px] text-slate-400 mt-0.5">{selected.description}</p>
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg",
                selected.category === "patient"     ? "bg-blue-50 text-blue-700" :
                selected.category === "doctor"      ? "bg-violet-50 text-violet-700" :
                selected.category === "financial"   ? "bg-emerald-50 text-emerald-700" :
                "bg-amber-50 text-amber-700"
              )}>
                {CATEGORIES.find((c) => c.key === selected.category)?.label}
              </span>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1.5 mb-3">
              <Filter size={12} className="text-slate-400" />
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Filters</p>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">

              {/* Date range — always shown */}
              {selected.filters.includes("dateRange") && (
                <>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      From
                    </label>
                    <input
                      type="date"
                      value={filters.from}
                      max={filters.to}
                      onChange={(e) => setFilter("from", e.target.value)}
                      className="w-full h-8 px-3 text-[12px] text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      To
                    </label>
                    <input
                      type="date"
                      value={filters.to}
                      min={filters.from}
                      onChange={(e) => setFilter("to", e.target.value)}
                      className="w-full h-8 px-3 text-[12px] text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-slate-50"
                    />
                  </div>
                </>
              )}

              {/* Doctor dropdown */}
              {selected.filters.includes("doctor") && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Doctor
                  </label>
                  <select
                    value={filters.doctorId ?? ""}
                    onChange={(e) => setFilter("doctorId", e.target.value)}
                    className="w-full h-8 px-3 text-[12px] text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-slate-50"
                  >
                    <option value="">All doctors</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Patient dropdown */}
              {selected.filters.includes("patient") && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Patient
                  </label>
                  <select
                    value={filters.patientId ?? ""}
                    onChange={(e) => setFilter("patientId", e.target.value)}
                    className="w-full h-8 px-3 text-[12px] text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-slate-50"
                  >
                    <option value="">All patients</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status dropdown */}
              {selected.filters.includes("status") && selected.statusOptions && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={filters.status ?? ""}
                    onChange={(e) => setFilter("status", e.target.value)}
                    className="w-full h-8 px-3 text-[12px] text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-slate-50"
                  >
                    <option value="">All statuses</option>
                    {selected.statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payment method dropdown */}
              {selected.filters.includes("paymentMethod") && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={filters.paymentMethod ?? ""}
                    onChange={(e) => setFilter("paymentMethod", e.target.value)}
                    className="w-full h-8 px-3 text-[12px] text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-slate-50"
                  >
                    <option value="">All methods</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={generating}
              className={cn(
                "flex items-center gap-2 h-9 px-5 rounded-xl text-[13px] font-semibold transition-all",
                generating
                  ? "bg-blue-400 text-white cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md"
              )}
            >
              {generating ? (
                <><Loader2 size={14} className="animate-spin" /> Generating…</>
              ) : (
                <><TrendingUp size={14} /> Generate Report</>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-700">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── Report Results ── */}
        {reportData && (
          <>
            {/* Summary strip */}
            {reportData.summary && reportData.summary.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {reportData.summary.map((s) => (
                  <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex-1 min-w-[120px]">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{s.label}</p>
                    <p className="text-[20px] font-bold text-slate-900 mt-0.5 leading-none">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Table + export */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

              {/* Table header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-slate-900">{selected?.label}</p>
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {reportData.totalRows} row{reportData.totalRows !== 1 ? "s" : ""}
                  </span>
                  {hasMore && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                      showing first {PREVIEW_LIMIT}
                    </span>
                  )}
                </div>

                {/* Export buttons */}
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { key: "pdf",   icon: FileText,        label: "PDF"   },
                      { key: "excel", icon: FileSpreadsheet,  label: "Excel" },
                      { key: "csv",   icon: FileDown,         label: "CSV"   },
                      { key: "print", icon: Printer,          label: "Print" },
                    ] as const
                  ).map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      onClick={() => handleExport(key)}
                      disabled={!!exporting}
                      className={cn(
                        "flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all border",
                        exporting === key
                          ? "bg-blue-50 border-blue-200 text-blue-600 cursor-wait"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800"
                      )}
                    >
                      {exporting === key
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Icon size={11} />
                      }
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data table */}
              {reportData.totalRows === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Download size={16} className="text-slate-300" />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-700">No data found</p>
                  <p className="text-[12px] text-slate-400">Try adjusting the date range or filters and regenerate.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100">
                        {reportData.columns.map((col) => (
                          <th
                            key={col}
                            className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {previewRows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-slate-50/50 transition-colors">
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className={cn(
                                "px-4 py-2.5 text-[12px] text-slate-700 whitespace-nowrap",
                                ci === 0 && "font-medium text-slate-900"
                              )}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer: export all note */}
              {hasMore && (
                <div className="px-5 py-2.5 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-700 font-medium">
                  Preview limited to {PREVIEW_LIMIT} rows. All {reportData.totalRows} rows are included in PDF, Excel, and CSV exports.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
