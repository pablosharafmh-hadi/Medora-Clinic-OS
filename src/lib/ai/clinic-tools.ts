import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase/client";
import {
  getAnalyticsSummary,
  getDoctorPerformance,
  getServicePerformance,
  getPaymentMethodBreakdown,
  getDateBounds,
} from "@/lib/supabase/analytics";

export type ClinicRole = "admin" | "manager" | "doctor" | "receptionist" | "nurse";

// ─── Tool definitions ─────────────────────────────────────────────────────────

const T_PATIENT_STATS: Anthropic.Tool = {
  name: "get_patient_stats",
  description: "Get patient statistics: total patients, active patients, new patients today/this week/this month.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
};

const T_APPOINTMENT_STATS: Anthropic.Tool = {
  name: "get_appointment_stats",
  description:
    "Get appointment statistics for a period: totals by status (completed, cancelled, no_show, scheduled, confirmed) and completion rate.",
  input_schema: {
    type: "object" as const,
    properties: {
      period: {
        type: "string",
        enum: ["today", "this_week", "this_month", "this_year", "all_time"],
        description: "Time period. Defaults to this_month.",
      },
    },
    required: [],
  },
};

const T_TODAY_SCHEDULE: Anthropic.Tool = {
  name: "get_today_schedule",
  description: "Get today's full appointment schedule with patient names, doctor names, time, service, and status.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
};

const T_DOCTOR_LIST: Anthropic.Tool = {
  name: "get_doctor_list",
  description: "List all doctors with their specialty, status, and appointment counts for a period.",
  input_schema: {
    type: "object" as const,
    properties: {
      period: {
        type: "string",
        enum: ["this_week", "this_month", "this_year", "all_time"],
        description: "Period for appointment counts. Defaults to this_month.",
      },
    },
    required: [],
  },
};

const T_SERVICE_STATS: Anthropic.Tool = {
  name: "get_service_stats",
  description: "Get top services by bookings: service name, booking count, and average price per service.",
  input_schema: {
    type: "object" as const,
    properties: {
      period: {
        type: "string",
        enum: ["this_week", "this_month", "this_year", "all_time"],
        description: "Period for service stats. Defaults to this_month.",
      },
    },
    required: [],
  },
};

const T_NOTIFICATION_SUMMARY: Anthropic.Tool = {
  name: "get_notification_summary",
  description: "Get a summary of system notifications: unread count and the 5 most recent unread alerts.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
};

const T_REVENUE_STATS: Anthropic.Tool = {
  name: "get_revenue_stats",
  description:
    "Get revenue statistics for a period: total revenue collected, outstanding balance, and payment method breakdown. FINANCIAL — admin/manager only.",
  input_schema: {
    type: "object" as const,
    properties: {
      period: {
        type: "string",
        enum: ["today", "this_week", "this_month", "this_year", "all_time"],
        description: "Time period. Defaults to this_month.",
      },
    },
    required: [],
  },
};

const T_FINANCIAL_SUMMARY: Anthropic.Tool = {
  name: "get_financial_summary",
  description:
    "Get detailed financial summary: invoice status breakdown, total invoiced, total collected, outstanding amounts. FINANCIAL — admin/manager only.",
  input_schema: {
    type: "object" as const,
    properties: {
      period: {
        type: "string",
        enum: ["this_week", "this_month", "this_year", "all_time"],
        description: "Period. Defaults to this_month.",
      },
    },
    required: [],
  },
};

const T_DOCTOR_PERFORMANCE: Anthropic.Tool = {
  name: "get_doctor_performance",
  description:
    "Get doctor performance metrics: appointments, completion rate, patients seen, and revenue per doctor. FINANCIAL — admin/manager only.",
  input_schema: {
    type: "object" as const,
    properties: {
      period: {
        type: "string",
        enum: ["this_week", "this_month", "this_year", "all_time"],
        description: "Period. Defaults to this_month.",
      },
    },
    required: [],
  },
};

const T_STAFF_SUMMARY: Anthropic.Tool = {
  name: "get_staff_summary",
  description:
    "Get staff summary: total personnel (staff + doctors), breakdown by role, active vs inactive counts. Admin/manager only.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
};

// ─── Role-based tool sets ─────────────────────────────────────────────────────

const PUBLIC_TOOLS: Anthropic.Tool[] = [
  T_PATIENT_STATS,
  T_APPOINTMENT_STATS,
  T_TODAY_SCHEDULE,
  T_DOCTOR_LIST,
  T_SERVICE_STATS,
  T_NOTIFICATION_SUMMARY,
];

const FINANCIAL_TOOLS: Anthropic.Tool[] = [
  T_REVENUE_STATS,
  T_FINANCIAL_SUMMARY,
  T_DOCTOR_PERFORMANCE,
];

const MANAGEMENT_TOOLS: Anthropic.Tool[] = [T_STAFF_SUMMARY];

export function getToolsForRole(role: ClinicRole): Anthropic.Tool[] {
  if (role === "admin" || role === "manager") {
    return [...PUBLIC_TOOLS, ...FINANCIAL_TOOLS, ...MANAGEMENT_TOOLS];
  }
  return PUBLIC_TOOLS;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function periodBounds(period?: string): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (period) {
    case "today": {
      const t = ymd(now);
      return { from: t, to: t };
    }
    case "this_week": {
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      return { from: ymd(mon), to: ymd(now) };
    }
    case "this_year":
      return { from: `${now.getFullYear()}-01-01`, to: ymd(now) };
    case "all_time":
      return getDateBounds("allTime");
    default:
      return getDateBounds("thisMonth");
  }
}

// ─── Individual executors ─────────────────────────────────────────────────────

async function execPatientStats(): Promise<object> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [total, active, newMonth, newWeek, newToday] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", weekAgo + "T00:00:00"),
    supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", today + "T00:00:00"),
  ]);

  return {
    total_patients: total.count ?? 0,
    active_patients: active.count ?? 0,
    inactive_patients: (total.count ?? 0) - (active.count ?? 0),
    new_this_month: newMonth.count ?? 0,
    new_this_week: newWeek.count ?? 0,
    new_today: newToday.count ?? 0,
  };
}

async function execAppointmentStats(input: Record<string, unknown>): Promise<object> {
  const period = (input.period as string) || "this_month";
  const { from, to } = periodBounds(period);

  const { data } = await supabase
    .from("appointments")
    .select("status")
    .gte("scheduled_at", from + "T00:00:00")
    .lte("scheduled_at", to + "T23:59:59");

  const rows = (data ?? []) as { status: string }[];
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const total = rows.length;
  const completed = counts["completed"] ?? 0;

  return {
    period,
    from,
    to,
    total_appointments: total,
    completed: completed,
    scheduled: counts["scheduled"] ?? 0,
    confirmed: counts["confirmed"] ?? 0,
    cancelled: counts["cancelled"] ?? 0,
    no_show: counts["no_show"] ?? 0,
    completion_rate_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

async function execTodaySchedule(): Promise<object> {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const { data } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, service_name, doctors(first_name, last_name), patients(first_name, last_name)"
    )
    .gte("scheduled_at", today + "T00:00:00")
    .lt("scheduled_at", tomorrow + "T00:00:00")
    .order("scheduled_at");

  if (!data || data.length === 0) {
    return { date: today, message: "No appointments scheduled for today.", total: 0, appointments: [] };
  }

  const appointments = (data as Record<string, unknown>[]).map((a) => {
    const doc = a.doctors as Record<string, string> | null;
    const pat = a.patients as Record<string, string> | null;
    const dt = new Date(a.scheduled_at as string);
    return {
      time: dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      patient: pat ? `${pat.first_name} ${pat.last_name}` : "Unknown patient",
      doctor: doc ? `Dr. ${doc.first_name} ${doc.last_name}` : "No doctor assigned",
      service: (a.service_name as string) || "General consultation",
      status: a.status,
    };
  });

  return { date: today, total: appointments.length, appointments };
}

async function execDoctorList(input: Record<string, unknown>): Promise<object> {
  const period = (input.period as string) || "this_month";
  const { from, to } = periodBounds(period);

  const [doctorsRes, aptsRes] = await Promise.all([
    supabase.from("doctors").select("id, first_name, last_name, specialty, status"),
    supabase
      .from("appointments")
      .select("doctor_id, status")
      .gte("scheduled_at", from + "T00:00:00")
      .lte("scheduled_at", to + "T23:59:59"),
  ]);

  type DoctorRow = { id: string; first_name: string; last_name: string; specialty: string; status: string };
  type AptRow = { doctor_id: string; status: string };

  const doctors = (doctorsRes.data ?? []) as DoctorRow[];
  const apts = (aptsRes.data ?? []) as AptRow[];

  return {
    period,
    total_doctors: doctors.length,
    doctors: doctors.map((d) => {
      const mine = apts.filter((a) => a.doctor_id === d.id);
      return {
        name: `Dr. ${d.first_name} ${d.last_name}`,
        specialty: d.specialty,
        status: d.status,
        appointments_in_period: mine.length,
        completed_in_period: mine.filter((a) => a.status === "completed").length,
        cancelled_in_period: mine.filter((a) => a.status === "cancelled").length,
      };
    }),
  };
}

async function execServiceStats(input: Record<string, unknown>): Promise<object> {
  const period = (input.period as string) || "this_month";
  const { from, to } = periodBounds(period);
  const services = await getServicePerformance(from, to);

  if (services.length === 0) {
    return { period, message: "No service booking data for this period.", services: [] };
  }

  return {
    period,
    most_popular: services[0]?.name ?? "N/A",
    top_services: services.map((s) => ({
      name: s.name,
      bookings: s.bookings,
      avg_price_usd: Number(s.avg_price.toFixed(2)),
      total_revenue_usd: Number(s.revenue.toFixed(2)),
    })),
  };
}

async function execNotificationSummary(): Promise<object> {
  const [countRes, recentRes] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("status", "unread"),
    supabase
      .from("notifications")
      .select("title, category, priority, created_at")
      .eq("status", "unread")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  type NRow = { title: string; category: string; priority: string; created_at: string };

  return {
    unread_notifications: countRes.count ?? 0,
    recent_unread: ((recentRes.data ?? []) as NRow[]).map((n) => ({
      title: n.title,
      category: n.category,
      priority: n.priority,
      received: new Date(n.created_at).toLocaleString(),
    })),
  };
}

async function execRevenueStats(input: Record<string, unknown>): Promise<object> {
  const period = (input.period as string) || "this_month";
  const { from, to } = periodBounds(period);

  const [summary, paymentMethods] = await Promise.all([
    getAnalyticsSummary(from, to),
    getPaymentMethodBreakdown(from, to),
  ]);

  return {
    period,
    from,
    to,
    total_revenue_collected_usd: Number(summary.total_revenue.toFixed(2)),
    outstanding_balance_usd: Number(summary.outstanding_balance.toFixed(2)),
    total_appointments: summary.total_appointments,
    completed_appointments: summary.completed_appointments,
    avg_revenue_per_appointment_usd:
      summary.completed_appointments > 0
        ? Number((summary.total_revenue / summary.completed_appointments).toFixed(2))
        : 0,
    payment_breakdown: paymentMethods.map((p) => ({
      method: p.method,
      total_usd: Number(p.amount.toFixed(2)),
      transaction_count: p.count,
    })),
  };
}

async function execFinancialSummary(input: Record<string, unknown>): Promise<object> {
  const period = (input.period as string) || "this_month";
  const { from, to } = periodBounds(period);

  const { data: invData } = await supabase
    .from("invoices")
    .select("status, total_amount, amount_paid")
    .gte("created_at", from + "T00:00:00")
    .lte("created_at", to + "T23:59:59");

  type InvRow = { status: string; total_amount: number; amount_paid: number };
  const invoices = (invData ?? []) as InvRow[];

  const byStatus: Record<string, { count: number; total: number }> = {};
  for (const inv of invoices) {
    if (!byStatus[inv.status]) byStatus[inv.status] = { count: 0, total: 0 };
    byStatus[inv.status].count++;
    byStatus[inv.status].total += inv.total_amount;
  }

  const totalInvoiced = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.amount_paid, 0);

  return {
    period,
    total_invoices: invoices.length,
    total_invoiced_usd: Number(totalInvoiced.toFixed(2)),
    total_collected_usd: Number(totalCollected.toFixed(2)),
    total_outstanding_usd: Number((totalInvoiced - totalCollected).toFixed(2)),
    by_status: Object.entries(byStatus).map(([status, { count, total }]) => ({
      status,
      count,
      total_usd: Number(total.toFixed(2)),
    })),
  };
}

async function execDoctorPerformance(input: Record<string, unknown>): Promise<object> {
  const period = (input.period as string) || "this_month";
  const { from, to } = periodBounds(period);
  const stats = await getDoctorPerformance(from, to);

  if (stats.length === 0) {
    return { period, message: "No appointment data for this period.", doctors: [] };
  }

  const byRevenue = [...stats].sort((a, b) => b.revenue - a.revenue);
  const byApts    = [...stats].sort((a, b) => b.total - a.total);

  return {
    period,
    top_doctor_by_revenue: byRevenue[0]?.name ?? "N/A",
    top_doctor_by_appointments: byApts[0]?.name ?? "N/A",
    doctors: stats.map((d) => ({
      name: d.name,
      specialty: d.specialty,
      total_appointments: d.total,
      completed: d.completed,
      cancelled: d.cancelled,
      no_show: d.no_show,
      patients_seen: d.patients_seen,
      completion_rate_pct: d.completion_rate,
      revenue_usd: Number(d.revenue.toFixed(2)),
    })),
  };
}

async function execStaffSummary(): Promise<object> {
  const [staffRes, doctorsRes] = await Promise.all([
    supabase.from("staff").select("role, status"),
    supabase.from("doctors").select("id, status"),
  ]);

  type SRow = { role: string; status: string };
  type DRow = { id: string; status: string };

  const staff   = (staffRes.data   ?? []) as SRow[];
  const doctors = (doctorsRes.data ?? []) as DRow[];

  const byRole: Record<string, number> = {};
  for (const s of staff) byRole[s.role] = (byRole[s.role] ?? 0) + 1;

  return {
    total_personnel: staff.length + doctors.length,
    total_staff_members: staff.length,
    total_doctors: doctors.length,
    active_staff: staff.filter((s) => s.status === "active").length,
    active_doctors: doctors.filter((d) => d.status === "active").length,
    staff_by_role: byRole,
  };
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    let result: object;
    switch (name) {
      case "get_patient_stats":        result = await execPatientStats();           break;
      case "get_appointment_stats":    result = await execAppointmentStats(input);  break;
      case "get_today_schedule":       result = await execTodaySchedule();          break;
      case "get_doctor_list":          result = await execDoctorList(input);        break;
      case "get_service_stats":        result = await execServiceStats(input);      break;
      case "get_notification_summary": result = await execNotificationSummary();    break;
      case "get_revenue_stats":        result = await execRevenueStats(input);      break;
      case "get_financial_summary":    result = await execFinancialSummary(input);  break;
      case "get_doctor_performance":   result = await execDoctorPerformance(input); break;
      case "get_staff_summary":        result = await execStaffSummary();           break;
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({
      error: "Tool execution failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
