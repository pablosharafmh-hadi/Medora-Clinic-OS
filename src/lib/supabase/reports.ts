import { supabase } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportFilters = {
  from: string;
  to: string;
  doctorId?: string;
  patientId?: string;
  status?: string;
  paymentMethod?: string;
};

export type ReportData = {
  columns: string[];
  rows: string[][];
  totalRows: number;
  summary?: { label: string; value: string }[];
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function capStatus(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—";
}

// ─── 1. Patient Summary Report ────────────────────────────────────────────────

type PatientRow = {
  id: string; first_name: string; last_name: string;
  date_of_birth: string | null; gender: string | null;
  phone: string; email: string; status: string; created_at: string;
};

export async function getPatientSummaryReport(f: ReportFilters): Promise<ReportData> {
  let q = supabase
    .from("patients")
    .select("id, first_name, last_name, date_of_birth, gender, phone, email, status, created_at")
    .gte("created_at", f.from + "T00:00:00")
    .lte("created_at", f.to + "T23:59:59")
    .order("created_at", { ascending: false });

  if (f.status) q = q.eq("status", f.status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as PatientRow[];
  const active = rows.filter((r) => r.status === "active").length;

  return {
    columns: ["Full Name", "Date of Birth", "Gender", "Phone", "Email", "Status", "Registered"],
    rows: rows.map((r) => [
      `${r.first_name} ${r.last_name}`,
      fmtDate(r.date_of_birth),
      capStatus(r.gender ?? ""),
      r.phone || "—",
      r.email || "—",
      capStatus(r.status),
      fmtDate(r.created_at),
    ]),
    totalRows: rows.length,
    summary: [
      { label: "Total patients", value: String(rows.length) },
      { label: "Active", value: String(active) },
      { label: "Inactive", value: String(rows.length - active) },
    ],
  };
}

// ─── 2. Patient Visit History ─────────────────────────────────────────────────

type AptRow = {
  id: string; scheduled_at: string; status: string;
  service_name: string | null; service_price: number | null;
  patient_id: string; doctor_id: string;
};

export async function getPatientVisitHistoryReport(f: ReportFilters): Promise<ReportData> {
  let q = supabase
    .from("appointments")
    .select("id, scheduled_at, status, service_name, service_price, patient_id, doctor_id")
    .gte("scheduled_at", f.from + "T00:00:00")
    .lte("scheduled_at", f.to + "T23:59:59")
    .order("scheduled_at", { ascending: false });

  if (f.patientId) q = q.eq("patient_id", f.patientId);
  if (f.doctorId)  q = q.eq("doctor_id",  f.doctorId);
  if (f.status)    q = q.eq("status",      f.status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const apts = (data ?? []) as unknown as AptRow[];
  if (apts.length === 0) return { columns: ["Date", "Patient", "Doctor", "Service", "Price", "Status"], rows: [], totalRows: 0 };

  const patIds  = [...new Set(apts.map((a) => a.patient_id))];
  const docIds  = [...new Set(apts.map((a) => a.doctor_id).filter(Boolean))];

  const [patRes, docRes] = await Promise.all([
    supabase.from("patients").select("id, first_name, last_name").in("id", patIds),
    supabase.from("doctors").select("id, first_name, last_name").in("id", docIds),
  ]);

  type NameRow = { id: string; first_name: string; last_name: string };
  const patMap = new Map<string, string>(
    ((patRes.data ?? []) as NameRow[]).map((p) => [p.id, `${p.first_name} ${p.last_name}`])
  );
  const docMap = new Map<string, string>(
    ((docRes.data ?? []) as NameRow[]).map((d) => [d.id, `Dr. ${d.first_name} ${d.last_name}`])
  );

  const completed = apts.filter((a) => a.status === "completed").length;

  return {
    columns: ["Date & Time", "Patient", "Doctor", "Service", "Price", "Status"],
    rows: apts.map((a) => [
      fmtDateTime(a.scheduled_at),
      patMap.get(a.patient_id) ?? "—",
      docMap.get(a.doctor_id)  ?? "—",
      a.service_name ?? "General consultation",
      a.service_price != null ? fmtCurrency(a.service_price) : "—",
      capStatus(a.status),
    ]),
    totalRows: apts.length,
    summary: [
      { label: "Total visits", value: String(apts.length) },
      { label: "Completed", value: String(completed) },
      { label: "Cancelled / No-show", value: String(apts.length - completed) },
    ],
  };
}

// ─── 3. Patient Payment History ───────────────────────────────────────────────

type PaymentRow = { id: string; payment_date: string; amount: number; payment_method: string; notes: string | null; invoice_id: string };
type InvoiceRow = { id: string; invoice_number: string; appointment_id: string };

export async function getPatientPaymentHistoryReport(f: ReportFilters): Promise<ReportData> {
  let q = supabase
    .from("payments")
    .select("id, payment_date, amount, payment_method, notes, invoice_id")
    .gte("payment_date", f.from + "T00:00:00")
    .lte("payment_date", f.to + "T23:59:59")
    .order("payment_date", { ascending: false });

  if (f.paymentMethod) q = q.eq("payment_method", f.paymentMethod);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const payments = (data ?? []) as PaymentRow[];
  if (payments.length === 0) {
    return { columns: ["Date", "Patient", "Invoice #", "Amount", "Method", "Notes"], rows: [], totalRows: 0 };
  }

  const invIds = [...new Set(payments.map((p) => p.invoice_id).filter(Boolean))];
  const { data: invData } = await supabase
    .from("invoices")
    .select("id, invoice_number, appointment_id")
    .in("id", invIds);

  const invoices = (invData ?? []) as InvoiceRow[];
  const invMap = new Map(invoices.map((i) => [i.id, i]));

  const aptIds = [...new Set(invoices.map((i) => i.appointment_id).filter(Boolean))];
  const { data: aptData } = await supabase
    .from("appointments")
    .select("id, patient_id")
    .in("id", aptIds);

  type AptPatRow = { id: string; patient_id: string };
  const aptPats = (aptData ?? []) as AptPatRow[];
  const aptMap  = new Map(aptPats.map((a) => [a.id, a.patient_id]));

  const patIds = [...new Set(aptPats.map((a) => a.patient_id).filter(Boolean))];
  const { data: patData } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .in("id", patIds);

  type NameRow = { id: string; first_name: string; last_name: string };
  const patMap = new Map<string, string>(
    ((patData ?? []) as NameRow[]).map((p) => [p.id, `${p.first_name} ${p.last_name}`])
  );

  // Optional patient filter
  const filtered = f.patientId
    ? payments.filter((p) => {
        const inv = invMap.get(p.invoice_id);
        if (!inv) return false;
        return aptMap.get(inv.appointment_id) === f.patientId;
      })
    : payments;

  const total = filtered.reduce((s, p) => s + p.amount, 0);

  return {
    columns: ["Date", "Patient", "Invoice #", "Amount", "Method", "Notes"],
    rows: filtered.map((p) => {
      const inv = invMap.get(p.invoice_id);
      const patId = inv ? aptMap.get(inv.appointment_id) : undefined;
      return [
        fmtDate(p.payment_date),
        patId ? (patMap.get(patId) ?? "—") : "—",
        inv?.invoice_number ?? "—",
        fmtCurrency(p.amount),
        capStatus(p.payment_method),
        p.notes || "—",
      ];
    }),
    totalRows: filtered.length,
    summary: [
      { label: "Total transactions", value: String(filtered.length) },
      { label: "Total collected", value: fmtCurrency(total) },
    ],
  };
}

// ─── 4. Patient Outstanding Balance ──────────────────────────────────────────

type FullInvoice = { id: string; invoice_number: string; appointment_id: string; status: string; total_amount: number; amount_paid: number; due_date: string | null; created_at: string };

export async function getPatientOutstandingBalanceReport(f: ReportFilters): Promise<ReportData> {
  let q = supabase
    .from("invoices")
    .select("id, invoice_number, appointment_id, status, total_amount, amount_paid, due_date, created_at")
    .gte("created_at", f.from + "T00:00:00")
    .lte("created_at", f.to + "T23:59:59")
    .order("due_date");

  if (f.status) {
    q = q.eq("status", f.status);
  } else {
    q = q.in("status", ["pending", "partially_paid", "overdue"]);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const invoices = ((data ?? []) as FullInvoice[]).filter(
    (i) => i.total_amount - i.amount_paid > 0
  );

  if (invoices.length === 0) {
    return { columns: ["Patient", "Invoice #", "Total", "Paid", "Balance", "Due Date", "Status"], rows: [], totalRows: 0 };
  }

  const aptIds = [...new Set(invoices.map((i) => i.appointment_id).filter(Boolean))];
  const { data: aptData } = await supabase.from("appointments").select("id, patient_id").in("id", aptIds);

  type AptPatRow = { id: string; patient_id: string };
  const aptMap = new Map(((aptData ?? []) as AptPatRow[]).map((a) => [a.id, a.patient_id]));

  const patIds = [...new Set([...aptMap.values()])];
  const { data: patData } = await supabase.from("patients").select("id, first_name, last_name").in("id", patIds);

  type NameRow = { id: string; first_name: string; last_name: string };
  const patMap = new Map<string, string>(
    ((patData ?? []) as NameRow[]).map((p) => [p.id, `${p.first_name} ${p.last_name}`])
  );

  const filtered = f.patientId
    ? invoices.filter((i) => aptMap.get(i.appointment_id) === f.patientId)
    : invoices;

  const totalOutstanding = filtered.reduce((s, i) => s + (i.total_amount - i.amount_paid), 0);

  return {
    columns: ["Patient", "Invoice #", "Total", "Paid", "Balance", "Due Date", "Status"],
    rows: filtered.map((i) => {
      const patId = aptMap.get(i.appointment_id);
      const balance = i.total_amount - i.amount_paid;
      return [
        patId ? (patMap.get(patId) ?? "—") : "—",
        i.invoice_number,
        fmtCurrency(i.total_amount),
        fmtCurrency(i.amount_paid),
        fmtCurrency(balance),
        fmtDate(i.due_date),
        capStatus(i.status),
      ];
    }),
    totalRows: filtered.length,
    summary: [
      { label: "Invoices with balance", value: String(filtered.length) },
      { label: "Total outstanding", value: fmtCurrency(totalOutstanding) },
    ],
  };
}

// ─── 5. Doctor Performance Report ────────────────────────────────────────────

type DoctorDbRow = { id: string; first_name: string; last_name: string; specialty: string };

export async function getDoctorPerformanceReport(f: ReportFilters): Promise<ReportData> {
  let doctorsQ = supabase.from("doctors").select("id, first_name, last_name, specialty");
  if (f.doctorId) doctorsQ = doctorsQ.eq("id", f.doctorId);

  let aptsQ = supabase
    .from("appointments")
    .select("id, doctor_id, patient_id, status, service_price")
    .gte("scheduled_at", f.from + "T00:00:00")
    .lte("scheduled_at", f.to + "T23:59:59");

  if (f.doctorId) aptsQ = aptsQ.eq("doctor_id", f.doctorId);

  const [doctorsRes, aptsRes] = await Promise.all([doctorsQ, aptsQ]);
  if (doctorsRes.error) throw new Error(doctorsRes.error.message);

  const doctors = (doctorsRes.data ?? []) as DoctorDbRow[];
  type AptStatRow = { id: string; doctor_id: string; patient_id: string; status: string; service_price: number | null };
  const apts = (aptsRes.data ?? []) as AptStatRow[];

  // Get revenue from payments for those appointments
  const aptIds = apts.map((a) => a.id);
  const { data: invData } = await supabase
    .from("invoices")
    .select("id, appointment_id, amount_paid")
    .in("appointment_id", aptIds.length > 0 ? aptIds : ["__none__"]);

  type InvRevRow = { id: string; appointment_id: string; amount_paid: number };
  const invList = (invData ?? []) as InvRevRow[];
  const aptRevMap = new Map<string, number>(invList.map((i) => [i.appointment_id, i.amount_paid]));

  const rows = doctors.map((doc) => {
    const mine = apts.filter((a) => a.doctor_id === doc.id);
    const completed  = mine.filter((a) => a.status === "completed").length;
    const cancelled  = mine.filter((a) => a.status === "cancelled").length;
    const noShow     = mine.filter((a) => a.status === "no_show").length;
    const patientsSet = new Set(mine.map((a) => a.patient_id));
    const revenue    = mine.reduce((s, a) => s + (aptRevMap.get(a.id) ?? 0), 0);
    const rate       = mine.length > 0 ? Math.round((completed / mine.length) * 100) : 0;

    return [
      `Dr. ${doc.first_name} ${doc.last_name}`,
      doc.specialty,
      String(mine.length),
      String(completed),
      String(cancelled),
      String(noShow),
      `${rate}%`,
      String(patientsSet.size),
      fmtCurrency(revenue),
    ];
  }).filter((row) => Number(row[2]) > 0 || !f.doctorId);

  const topByRev = rows.reduce<string | null>((best, r) => {
    if (!best) return r[0];
    const bestRev = parseFloat(rows.find((x) => x[0] === best)?.[8]?.replace("$", "") ?? "0");
    const thisRev = parseFloat(r[8].replace("$", ""));
    return thisRev > bestRev ? r[0] : best;
  }, null);

  return {
    columns: ["Doctor", "Specialty", "Appointments", "Completed", "Cancelled", "No-Show", "Rate", "Patients Seen", "Revenue"],
    rows,
    totalRows: rows.length,
    summary: [
      { label: "Doctors analyzed", value: String(rows.length) },
      { label: "Top by revenue", value: topByRev ?? "—" },
      { label: "Total appointments", value: String(apts.length) },
    ],
  };
}

// ─── 6. Revenue Report ────────────────────────────────────────────────────────

export async function getRevenueReport(f: ReportFilters): Promise<ReportData> {
  let q = supabase
    .from("payments")
    .select("id, payment_date, amount, payment_method, notes, invoice_id")
    .gte("payment_date", f.from + "T00:00:00")
    .lte("payment_date", f.to + "T23:59:59")
    .order("payment_date", { ascending: false });

  if (f.paymentMethod) q = q.eq("payment_method", f.paymentMethod);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const payments = (data ?? []) as PaymentRow[];

  const invIds = [...new Set(payments.map((p) => p.invoice_id).filter(Boolean))];
  const { data: invData } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .in("id", invIds.length > 0 ? invIds : ["__none__"]);

  type InvNumRow = { id: string; invoice_number: string };
  const invMap = new Map<string, string>(
    ((invData ?? []) as InvNumRow[]).map((i) => [i.id, i.invoice_number])
  );

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const avg   = payments.length > 0 ? total / payments.length : 0;

  return {
    columns: ["Date", "Amount", "Payment Method", "Invoice #", "Notes"],
    rows: payments.map((p) => [
      fmtDate(p.payment_date),
      fmtCurrency(p.amount),
      capStatus(p.payment_method),
      invMap.get(p.invoice_id) ?? "—",
      p.notes || "—",
    ]),
    totalRows: payments.length,
    summary: [
      { label: "Total revenue", value: fmtCurrency(total) },
      { label: "Transactions", value: String(payments.length) },
      { label: "Average payment", value: fmtCurrency(avg) },
    ],
  };
}

// ─── 7. Outstanding Invoices ──────────────────────────────────────────────────

export async function getOutstandingInvoicesReport(f: ReportFilters): Promise<ReportData> {
  let q = supabase
    .from("invoices")
    .select("id, invoice_number, appointment_id, status, total_amount, amount_paid, due_date, created_at")
    .gte("created_at", f.from + "T00:00:00")
    .lte("created_at", f.to + "T23:59:59")
    .order("due_date");

  if (f.status) {
    q = q.eq("status", f.status);
  } else {
    q = q.in("status", ["pending", "partially_paid", "overdue"]);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const invoices = (data ?? []) as FullInvoice[];

  const aptIds = [...new Set(invoices.map((i) => i.appointment_id).filter(Boolean))];
  const { data: aptData } = await supabase.from("appointments").select("id, patient_id").in("id", aptIds.length > 0 ? aptIds : ["__none__"]);
  type AptPatRow = { id: string; patient_id: string };
  const aptMap = new Map(((aptData ?? []) as AptPatRow[]).map((a) => [a.id, a.patient_id]));

  const patIds = [...new Set([...aptMap.values()])];
  const { data: patData } = await supabase.from("patients").select("id, first_name, last_name").in("id", patIds.length > 0 ? patIds : ["__none__"]);
  type NameRow = { id: string; first_name: string; last_name: string };
  const patMap = new Map<string, string>(
    ((patData ?? []) as NameRow[]).map((p) => [p.id, `${p.first_name} ${p.last_name}`])
  );

  const totalOutstanding = invoices.reduce((s, i) => s + (i.total_amount - i.amount_paid), 0);
  const overdue = invoices.filter((i) => i.status === "overdue").length;

  return {
    columns: ["Invoice #", "Patient", "Total", "Paid", "Balance", "Due Date", "Status"],
    rows: invoices.map((i) => {
      const patId = aptMap.get(i.appointment_id);
      return [
        i.invoice_number,
        patId ? (patMap.get(patId) ?? "—") : "—",
        fmtCurrency(i.total_amount),
        fmtCurrency(i.amount_paid),
        fmtCurrency(i.total_amount - i.amount_paid),
        fmtDate(i.due_date),
        capStatus(i.status),
      ];
    }),
    totalRows: invoices.length,
    summary: [
      { label: "Open invoices", value: String(invoices.length) },
      { label: "Overdue", value: String(overdue) },
      { label: "Total outstanding", value: fmtCurrency(totalOutstanding) },
    ],
  };
}

// ─── 8. Payment Summary ───────────────────────────────────────────────────────

export async function getPaymentSummaryReport(f: ReportFilters): Promise<ReportData> {
  const { data, error } = await supabase
    .from("payments")
    .select("payment_date, amount, payment_method")
    .gte("payment_date", f.from + "T00:00:00")
    .lte("payment_date", f.to + "T23:59:59");

  if (error) throw new Error(error.message);

  type P = { amount: number; payment_method: string };
  const payments = (data ?? []) as P[];

  const byMethod: Record<string, { count: number; total: number }> = {};
  for (const p of payments) {
    if (!byMethod[p.payment_method]) byMethod[p.payment_method] = { count: 0, total: 0 };
    byMethod[p.payment_method].count++;
    byMethod[p.payment_method].total += p.amount;
  }

  const rows = Object.entries(byMethod)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([method, { count, total }]) => [
      capStatus(method),
      String(count),
      fmtCurrency(total),
      payments.length > 0 ? `${Math.round((count / payments.length) * 100)}%` : "0%",
    ]);

  const grandTotal = payments.reduce((s, p) => s + p.amount, 0);

  return {
    columns: ["Payment Method", "Transactions", "Total Amount", "Share"],
    rows,
    totalRows: rows.length,
    summary: [
      { label: "Total collected", value: fmtCurrency(grandTotal) },
      { label: "Transactions", value: String(payments.length) },
      { label: "Methods used", value: String(Object.keys(byMethod).length) },
    ],
  };
}

// ─── 9. Appointment Report ────────────────────────────────────────────────────

export async function getAppointmentReport(f: ReportFilters): Promise<ReportData> {
  let q = supabase
    .from("appointments")
    .select("id, scheduled_at, status, service_name, service_price, patient_id, doctor_id, notes")
    .gte("scheduled_at", f.from + "T00:00:00")
    .lte("scheduled_at", f.to + "T23:59:59")
    .order("scheduled_at", { ascending: false });

  if (f.patientId) q = q.eq("patient_id", f.patientId);
  if (f.doctorId)  q = q.eq("doctor_id",  f.doctorId);
  if (f.status)    q = q.eq("status",      f.status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  type FullApt = { id: string; scheduled_at: string; status: string; service_name: string | null; service_price: number | null; patient_id: string; doctor_id: string; notes: string | null };
  const apts = (data ?? []) as unknown as FullApt[];

  if (apts.length === 0) {
    return { columns: ["Date", "Time", "Patient", "Doctor", "Service", "Price", "Status"], rows: [], totalRows: 0 };
  }

  const patIds = [...new Set(apts.map((a) => a.patient_id))];
  const docIds = [...new Set(apts.map((a) => a.doctor_id).filter(Boolean))];

  const [patRes, docRes] = await Promise.all([
    supabase.from("patients").select("id, first_name, last_name").in("id", patIds),
    supabase.from("doctors").select("id, first_name, last_name").in("id", docIds),
  ]);

  type NameRow = { id: string; first_name: string; last_name: string };
  const patMap = new Map<string, string>(((patRes.data ?? []) as NameRow[]).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
  const docMap = new Map<string, string>(((docRes.data ?? []) as NameRow[]).map((d) => [d.id, `Dr. ${d.first_name} ${d.last_name}`]));

  const counts: Record<string, number> = {};
  for (const a of apts) counts[a.status] = (counts[a.status] ?? 0) + 1;

  return {
    columns: ["Date", "Time", "Patient", "Doctor", "Service", "Price", "Status"],
    rows: apts.map((a) => [
      fmtDate(a.scheduled_at),
      fmtTime(a.scheduled_at),
      patMap.get(a.patient_id) ?? "—",
      docMap.get(a.doctor_id)  ?? "—",
      a.service_name ?? "General consultation",
      a.service_price != null ? fmtCurrency(a.service_price) : "—",
      capStatus(a.status),
    ]),
    totalRows: apts.length,
    summary: [
      { label: "Total",     value: String(apts.length) },
      { label: "Completed", value: String(counts["completed"]  ?? 0) },
      { label: "Scheduled", value: String((counts["scheduled"] ?? 0) + (counts["confirmed"] ?? 0)) },
      { label: "Cancelled", value: String(counts["cancelled"]  ?? 0) },
      { label: "No-show",   value: String(counts["no_show"]    ?? 0) },
    ],
  };
}

// ─── Dropdown data ────────────────────────────────────────────────────────────

export type DoctorOption  = { id: string; name: string };
export type PatientOption = { id: string; name: string };

export async function getReportDoctors(): Promise<DoctorOption[]> {
  const { data } = await supabase.from("doctors").select("id, first_name, last_name").eq("status", "active").order("last_name");
  type Row = { id: string; first_name: string; last_name: string };
  return ((data ?? []) as Row[]).map((d) => ({ id: d.id, name: `Dr. ${d.first_name} ${d.last_name}` }));
}

export async function getReportPatients(): Promise<PatientOption[]> {
  const { data } = await supabase.from("patients").select("id, first_name, last_name").eq("status", "active").order("last_name").limit(500);
  type Row = { id: string; first_name: string; last_name: string };
  return ((data ?? []) as Row[]).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }));
}
