import { supabase } from "./client";
import type {
  Invoice,
  InvoiceWithRelations,
  InvoiceInsert,
  InvoiceUpdate,
  InvoiceItemInsert,
} from "../types";

const RELATIONS = "*, patient:patients(first_name,last_name,patient_number), invoice_items(*), payments(*)";

export type InvoiceFilters = {
  search?: string;
  status?: string;
  patientId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedInvoices = {
  data: InvoiceWithRelations[];
  count: number;
  totalPages: number;
};

export async function getInvoices(filters: InvoiceFilters = {}): Promise<PaginatedInvoices> {
  const { search, status, patientId, dateFrom, dateTo, page = 1, pageSize = 20 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("invoices")
    .select(RELATIONS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") query = query.eq("status", status);
  if (patientId) query = query.eq("patient_id", patientId);
  if (dateFrom) query = query.gte("issue_date", dateFrom);
  if (dateTo) query = query.lte("issue_date", dateTo);

  const { data, error, count } = await query;
  if (error) throw error;

  let results = (data ?? []) as unknown as InvoiceWithRelations[];

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.patient?.first_name?.toLowerCase().includes(q) ||
        inv.patient?.last_name?.toLowerCase().includes(q) ||
        inv.patient?.patient_number?.toLowerCase().includes(q)
    );
  }

  return {
    data: results,
    count: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getInvoice(id: string): Promise<InvoiceWithRelations | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(RELATIONS)
    .eq("id", id)
    .single();

  if (error) return null;
  return data as unknown as InvoiceWithRelations;
}

export async function getPatientInvoices(patientId: string): Promise<InvoiceWithRelations[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(RELATIONS)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as InvoiceWithRelations[];
}

export async function createInvoice(
  input: InvoiceInsert,
  items: Omit<InvoiceItemInsert, "invoice_id">[]
): Promise<InvoiceWithRelations> {
  // Insert invoice
  const { data: invoice, error: invoiceErr } = await supabase
    .from("invoices")
    .insert(input)
    .select()
    .single();

  if (invoiceErr) throw invoiceErr;
  const inv = invoice as unknown as Invoice;

  // Insert items
  if (items.length > 0) {
    const { error: itemsErr } = await supabase.from("invoice_items").insert(
      items.map((item) => ({ ...item, invoice_id: inv.id }))
    );
    if (itemsErr) throw itemsErr;
  }

  const full = await getInvoice(inv.id);
  if (!full) throw new Error("Failed to fetch created invoice");
  return full;
}

export async function updateInvoice(
  id: string,
  input: InvoiceUpdate,
  items?: Omit<InvoiceItemInsert, "invoice_id">[]
): Promise<InvoiceWithRelations> {
  const { error: invErr } = await supabase
    .from("invoices")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (invErr) throw invErr;

  if (items !== undefined) {
    // Replace all items
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from("invoice_items").insert(
        items.map((item) => ({ ...item, invoice_id: id }))
      );
      if (itemsErr) throw itemsErr;
    }
  }

  const full = await getInvoice(id);
  if (!full) throw new Error("Failed to fetch updated invoice");
  return full;
}

export async function updateInvoiceStatus(id: string, status: Invoice["status"]): Promise<Invoice> {
  const { data, error } = await supabase
    .from("invoices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Invoice;
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

export async function getFinancialMetrics() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  // Build date strings from LOCAL components — avoids UTC-offset shift from toISOString()
  const y  = now.getFullYear();
  const m  = now.getMonth();
  const d  = now.getDate();

  const todayStr    = `${y}-${pad(m + 1)}-${pad(d)}`;
  const tomorrowStr = (() => {
    const t = new Date(y, m, d + 1);
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  })();
  const weekStartStr = (() => {
    const ws = new Date(y, m, d - now.getDay()); // Sunday of current week
    return `${ws.getFullYear()}-${pad(ws.getMonth() + 1)}-${pad(ws.getDate())}`;
  })();
  const monthStartStr = `${y}-${pad(m + 1)}-01`;
  const yearStartStr  = `${y}-01-01`;

  // Each period uses strict lower AND upper bounds — no overlapping ranges
  const [todayPayments, weekPayments, monthPayments, yearPayments, paidCount, outstandingResult] = await Promise.all([
    supabase.from("payments").select("amount").eq("status", "completed")
      .gte("payment_date", todayStr).lt("payment_date", tomorrowStr),
    supabase.from("payments").select("amount").eq("status", "completed")
      .gte("payment_date", weekStartStr).lt("payment_date", tomorrowStr),
    supabase.from("payments").select("amount").eq("status", "completed")
      .gte("payment_date", monthStartStr).lt("payment_date", tomorrowStr),
    supabase.from("payments").select("amount").eq("status", "completed")
      .gte("payment_date", yearStartStr).lt("payment_date", tomorrowStr),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("invoices").select("balance_due,status").in("status", ["pending", "partially_paid", "overdue"]),
  ]);

  const sum = (rows: { amount: number }[] | null) =>
    (rows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

  const outstandingRows = (outstandingResult.data ?? []) as unknown as { balance_due: number; status: string }[];

  return {
    revenueToday:             sum((todayPayments.data  ?? []) as unknown as { amount: number }[]),
    revenueThisWeek:          sum((weekPayments.data   ?? []) as unknown as { amount: number }[]),
    revenueThisMonth:         sum((monthPayments.data  ?? []) as unknown as { amount: number }[]),
    revenueThisYear:          sum((yearPayments.data   ?? []) as unknown as { amount: number }[]),
    paidInvoicesCount:        paidCount.count ?? 0,
    outstandingInvoicesCount: outstandingRows.length,
    outstandingBalance:       outstandingRows.reduce((s, r) => s + (r.balance_due ?? 0), 0),
    totalInvoicesCount:       (paidCount.count ?? 0) + outstandingRows.length,
  };
}

export async function getInvoiceByAppointmentId(appointmentId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (error) return null;
  return data as unknown as Invoice | null;
}

export async function createInvoiceFromAppointment(appointmentId: string): Promise<Invoice> {
  const existing = await getInvoiceByAppointmentId(appointmentId);
  if (existing) return existing;

  const { data: apt, error: aptErr } = await supabase
    .from("appointments")
    .select("patient_id, service_id, service_name, service_price")
    .eq("id", appointmentId)
    .single();

  if (aptErr || !apt) throw new Error("Appointment not found.");

  type AptRow = { patient_id: string; service_id: string | null; service_name: string | null; service_price: number | null };
  const a = apt as unknown as AptRow;

  if (!a.service_id || !a.service_name || a.service_price === null) {
    throw new Error("Appointment has no linked billable service. Please edit the appointment and select a service before completing it.");
  }

  const subtotal = a.service_price;
  const today = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      patient_id: a.patient_id,
      appointment_id: appointmentId,
      issue_date: today,
      due_date: dueDate,
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: subtotal,
      amount_paid: 0,
      balance_due: subtotal,
      status: "pending",
      notes: null,
    })
    .select()
    .single();

  if (invErr) throw invErr;

  const invoiceId = (invoice as unknown as { id: string }).id;

  const { error: itemErr } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    service_id: a.service_id,
    description: a.service_name,
    quantity: 1,
    unit_price: a.service_price,
    total_price: a.service_price,
  });
  if (itemErr) throw itemErr;

  await supabase.from("financial_transactions").insert({
    type: "invoice_created",
    invoice_id: invoiceId,
    payment_id: null,
    patient_id: a.patient_id,
    amount: subtotal,
    description: `Auto-generated invoice for completed appointment`,
    metadata: { source: "appointment_completed", appointment_id: appointmentId },
  });

  return invoice as unknown as Invoice;
}
