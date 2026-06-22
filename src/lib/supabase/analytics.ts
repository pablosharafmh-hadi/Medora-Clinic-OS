import { supabase } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DateRangeOption = "7d" | "30d" | "90d" | "thisMonth" | "thisYear" | "allTime";

export type RevenueTrendPoint = { date: string; revenue: number };
export type MonthlyRevenuePoint = { month: string; revenue: number };
export type AppointmentTrendPoint = { date: string; total: number; completed: number };
export type PatientGrowthPoint = { month: string; new_patients: number };

export type StatusPoint = {
  name: string;
  value: number;
  color: string;
};

export type DoctorStat = {
  id: string;
  name: string;
  specialty: string;
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
  patients_seen: number;
  completion_rate: number;
  revenue: number;
};

export type ServiceStat = {
  name: string;
  bookings: number;
  revenue: number;
  avg_price: number;
};

export type AnalyticsSummary = {
  total_appointments: number;
  completed_appointments: number;
  completion_rate: number;
  total_revenue: number;
  new_patients: number;
  outstanding_balance: number;
};

export type PaymentMethodPoint = {
  method: string;
  amount: number;
  count: number;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getDateBounds(range: DateRangeOption): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];

  const sub = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };

  switch (range) {
    case "7d":        return { from: sub(7),   to };
    case "30d":       return { from: sub(30),  to };
    case "90d":       return { from: sub(90),  to };
    case "thisMonth": return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0], to };
    case "thisYear":  return { from: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0], to };
    case "allTime":   return { from: "2020-01-01", to };
  }
}

export function getPreviousPeriodBounds(range: DateRangeOption): { from: string; to: string } {
  const { from, to } = getDateBounds(range);
  if (range === "allTime") return { from: "2015-01-01", to: from };

  const fromMs  = new Date(from).getTime();
  const toMs    = new Date(to).getTime();
  const diffMs  = toMs - fromMs;
  const prevTo  = new Date(fromMs - 86400000);
  const prevFrom = new Date(fromMs - diffMs - 86400000);

  return {
    from: prevFrom.toISOString().split("T")[0],
    to:   prevTo.toISOString().split("T")[0],
  };
}

// ─── Fill helpers ─────────────────────────────────────────────────────────────

function fillDailyRange(
  byDate: Map<string, Record<string, number>>,
  from: string,
  to: string,
  defaults: Record<string, number>
): Array<Record<string, string | number>> {
  const result: Array<Record<string, string | number>> = [];
  const cur = new Date(from + "T12:00:00Z");
  const end = new Date(to   + "T12:00:00Z");

  while (cur <= end) {
    const key   = cur.toISOString().split("T")[0];
    const label = cur.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    result.push({ date: label, ...(byDate.get(key) ?? defaults) });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

function fillMonthlyRange(
  byMonth: Map<string, Record<string, number>>,
  months: number,
  defaults: Record<string, number>
): Array<Record<string, string | number>> {
  const result: Array<Record<string, string | number>> = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    result.push({ month: label, ...(byMonth.get(key) ?? defaults) });
  }
  return result;
}

// ─── Analytics functions ──────────────────────────────────────────────────────

export async function getAnalyticsSummary(from: string, to: string): Promise<AnalyticsSummary> {
  const fromTs = from + "T00:00:00.000Z";
  const toTs   = to   + "T23:59:59.999Z";

  const [aptsRes, pmtsRes, newPtsRes, outstandingRes] = await Promise.all([
    supabase.from("appointments").select("status").gte("scheduled_at", fromTs).lte("scheduled_at", toTs),
    supabase.from("payments").select("amount").eq("status", "completed").gte("payment_date", from).lte("payment_date", to),
    supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", fromTs).lte("created_at", toTs),
    supabase.from("invoices").select("balance_due").in("status", ["pending", "partially_paid", "overdue"]),
  ]);

  type AptRow = { status: string };
  type PmtRow = { amount: number };
  type InvRow = { balance_due: number };

  const apts     = (aptsRes.data ?? []) as unknown as AptRow[];
  const pmts     = (pmtsRes.data ?? []) as unknown as PmtRow[];
  const invoices = (outstandingRes.data ?? []) as unknown as InvRow[];

  const total     = apts.length;
  const completed = apts.filter((a) => a.status === "completed").length;
  const revenue   = pmts.reduce((s, p) => s + (p.amount ?? 0), 0);
  const outstanding = invoices.reduce((s, i) => s + (i.balance_due ?? 0), 0);

  return {
    total_appointments: total,
    completed_appointments: completed,
    completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    total_revenue: revenue,
    new_patients: newPtsRes.count ?? 0,
    outstanding_balance: outstanding,
  };
}

export async function getRevenueTrend(from: string, to: string): Promise<RevenueTrendPoint[]> {
  const diffDays = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
  const useMonthly = diffDays > 90;

  if (useMonthly) {
    const months = Math.ceil(diffDays / 30);
    return (await getMonthlyRevenue(Math.min(months, 24))).map((p) => ({
      date: p.month,
      revenue: p.revenue,
    }));
  }

  const { data } = await supabase
    .from("payments")
    .select("payment_date, amount")
    .eq("status", "completed")
    .gte("payment_date", from)
    .lte("payment_date", to);

  const byDate = new Map<string, Record<string, number>>();
  for (const row of (data ?? []) as unknown as Array<{ payment_date: string; amount: number }>) {
    const key = row.payment_date.split("T")[0];
    const cur = byDate.get(key) ?? { revenue: 0 };
    cur.revenue += row.amount ?? 0;
    byDate.set(key, cur);
  }

  return fillDailyRange(byDate, from, to, { revenue: 0 }) as RevenueTrendPoint[];
}

export async function getMonthlyRevenue(months = 12): Promise<MonthlyRevenuePoint[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - months + 1);
  from.setDate(1);
  const fromStr = from.toISOString().split("T")[0];

  const { data } = await supabase
    .from("payments")
    .select("payment_date, amount")
    .eq("status", "completed")
    .gte("payment_date", fromStr);

  const byMonth = new Map<string, Record<string, number>>();
  for (const row of (data ?? []) as unknown as Array<{ payment_date: string; amount: number }>) {
    const d   = new Date(row.payment_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = byMonth.get(key) ?? { revenue: 0 };
    cur.revenue += row.amount ?? 0;
    byMonth.set(key, cur);
  }

  return fillMonthlyRange(byMonth, months, { revenue: 0 }) as MonthlyRevenuePoint[];
}

export async function getAppointmentStatusBreakdown(from: string, to: string): Promise<StatusPoint[]> {
  const { data } = await supabase
    .from("appointments")
    .select("status")
    .gte("scheduled_at", from + "T00:00:00.000Z")
    .lte("scheduled_at", to + "T23:59:59.999Z");

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as unknown as Array<{ status: string }>) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const CONFIG: Record<string, { label: string; color: string }> = {
    completed:   { label: "Completed",   color: "#10b981" },
    cancelled:   { label: "Cancelled",   color: "#ef4444" },
    no_show:     { label: "No Show",     color: "#f59e0b" },
    scheduled:   { label: "Scheduled",   color: "#3b82f6" },
    confirmed:   { label: "Confirmed",   color: "#8b5cf6" },
    checked_in:  { label: "Checked In",  color: "#06b6d4" },
    in_progress: { label: "In Progress", color: "#f97316" },
  };

  return Array.from(counts.entries())
    .filter(([, c]) => c > 0)
    .map(([status, value]) => ({
      name:  CONFIG[status]?.label ?? status,
      value,
      color: CONFIG[status]?.color ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);
}

export async function getAppointmentTrend(from: string, to: string): Promise<AppointmentTrendPoint[]> {
  const diffDays = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
  const { data } = await supabase
    .from("appointments")
    .select("scheduled_at, status")
    .gte("scheduled_at", from + "T00:00:00.000Z")
    .lte("scheduled_at", to + "T23:59:59.999Z");

  type Row = { scheduled_at: string; status: string };

  if (diffDays > 90) {
    // Group by month
    const byMonth = new Map<string, Record<string, number>>();
    for (const row of (data ?? []) as unknown as Row[]) {
      const d   = new Date(row.scheduled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = byMonth.get(key) ?? { total: 0, completed: 0 };
      cur.total++;
      if (row.status === "completed") cur.completed++;
      byMonth.set(key, cur);
    }
    const months = Math.min(Math.ceil(diffDays / 30), 24);
    return fillMonthlyRange(byMonth, months, { total: 0, completed: 0 }).map((p) => ({
      date:      p.month as string,
      total:     p.total as number,
      completed: p.completed as number,
    }));
  }

  const byDate = new Map<string, Record<string, number>>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const key = row.scheduled_at.split("T")[0];
    const cur = byDate.get(key) ?? { total: 0, completed: 0 };
    cur.total++;
    if (row.status === "completed") cur.completed++;
    byDate.set(key, cur);
  }

  return fillDailyRange(byDate, from, to, { total: 0, completed: 0 }) as AppointmentTrendPoint[];
}

export async function getPatientGrowth(months = 12): Promise<PatientGrowthPoint[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - months + 1);
  from.setDate(1);

  const { data } = await supabase
    .from("patients")
    .select("created_at")
    .gte("created_at", from.toISOString());

  const byMonth = new Map<string, Record<string, number>>();
  for (const row of (data ?? []) as unknown as Array<{ created_at: string }>) {
    const d   = new Date(row.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = byMonth.get(key) ?? { new_patients: 0 };
    cur.new_patients++;
    byMonth.set(key, cur);
  }

  return fillMonthlyRange(byMonth, months, { new_patients: 0 }) as PatientGrowthPoint[];
}

export async function getDoctorPerformance(from: string, to: string): Promise<DoctorStat[]> {
  const fromTs = from + "T00:00:00.000Z";
  const toTs   = to   + "T23:59:59.999Z";

  const [{ data: doctors }, { data: appointments }] = await Promise.all([
    supabase.from("doctors").select("id, first_name, last_name, specialty"),
    supabase.from("appointments")
      .select("doctor_id, patient_id, status, service_price")
      .gte("scheduled_at", fromTs)
      .lte("scheduled_at", toTs),
  ]);

  type DocRow = { id: string; first_name: string; last_name: string; specialty: string };
  type AptRow = { doctor_id: string; patient_id: string; status: string; service_price: number | null };

  const apts = (appointments ?? []) as unknown as AptRow[];

  return ((doctors ?? []) as unknown as DocRow[])
    .map((doc) => {
      const docApts   = apts.filter((a) => a.doctor_id === doc.id);
      const completed = docApts.filter((a) => a.status === "completed");
      const cancelled = docApts.filter((a) => a.status === "cancelled");
      const noShow    = docApts.filter((a) => a.status === "no_show");
      const revenue   = completed.reduce((s, a) => s + (a.service_price ?? 0), 0);
      const patients  = new Set(docApts.map((a) => a.patient_id)).size;

      return {
        id:              doc.id,
        name:            `Dr. ${doc.first_name} ${doc.last_name}`,
        specialty:       doc.specialty,
        total:           docApts.length,
        completed:       completed.length,
        cancelled:       cancelled.length,
        no_show:         noShow.length,
        patients_seen:   patients,
        completion_rate: docApts.length > 0 ? Math.round((completed.length / docApts.length) * 100) : 0,
        revenue,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export async function getServicePerformance(from: string, to: string): Promise<ServiceStat[]> {
  const fromTs = from + "T00:00:00.000Z";
  const toTs   = to   + "T23:59:59.999Z";

  const { data } = await supabase
    .from("appointments")
    .select("service_name, service_price, status")
    .not("service_name", "is", null)
    .gte("scheduled_at", fromTs)
    .lte("scheduled_at", toTs);

  type Row = { service_name: string | null; service_price: number | null; status: string };

  const map = new Map<string, { bookings: number; revenue: number }>();
  for (const r of (data ?? []) as unknown as Row[]) {
    if (!r.service_name) continue;
    const cur = map.get(r.service_name) ?? { bookings: 0, revenue: 0 };
    cur.bookings++;
    if (r.status === "completed" && r.service_price != null) cur.revenue += r.service_price;
    map.set(r.service_name, cur);
  }

  return Array.from(map.entries())
    .map(([name, { bookings, revenue }]) => ({
      name,
      bookings,
      revenue,
      avg_price: bookings > 0 ? Math.round(revenue / bookings) : 0,
    }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10);
}

export async function getPaymentMethodBreakdown(from: string, to: string): Promise<PaymentMethodPoint[]> {
  const { data } = await supabase
    .from("payments")
    .select("payment_method, amount")
    .eq("status", "completed")
    .gte("payment_date", from)
    .lte("payment_date", to);

  type Row = { payment_method: string; amount: number };

  const map = new Map<string, { amount: number; count: number }>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const cur = map.get(r.payment_method) ?? { amount: 0, count: 0 };
    cur.amount += r.amount ?? 0;
    cur.count++;
    map.set(r.payment_method, cur);
  }

  return Array.from(map.entries())
    .map(([method, { amount, count }]) => ({ method, amount, count }))
    .sort((a, b) => b.amount - a.amount);
}
