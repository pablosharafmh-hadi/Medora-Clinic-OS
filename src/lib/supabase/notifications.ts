import { supabase } from "./client";
import type { Notification, NotificationCategory, NotificationInsert } from "../types";

export type NotificationFilters = {
  status?: "unread" | "read" | "dismissed" | "all";
  category?: NotificationCategory | "all";
  limit?: number;
  offset?: number;
};

export async function getNotifications(
  filters: NotificationFilters = {}
): Promise<{ data: Notification[]; count: number }> {
  const { status = "all", category = "all", limit = 25, offset = 0 } = filters;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") query = query.eq("status", status);
  if (category && category !== "all") query = query.eq("category", category);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: (data ?? []) as unknown as Notification[], count: count ?? 0 };
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "unread");

  if (error) return 0;
  return count ?? 0;
}

export async function getRecentNotifications(limit = 8): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as unknown as Notification[];
}

export async function getRecentUnread(limit = 5): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("status", "unread")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as unknown as Notification[];
}

export async function markAsRead(id: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function markAllAsRead(): Promise<void> {
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("status", "unread");
}

export async function dismissNotification(id: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function createNotification(input: NotificationInsert): Promise<Notification | null> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({ ...input, expires_at: input.expires_at ?? null })
    .select()
    .single();

  if (error) return null;
  return data as unknown as Notification;
}

/**
 * Generates scheduled alerts for overdue invoices, pending-past-due invoices,
 * upcoming appointments, and missed appointments. Idempotent: checks before inserting.
 */
export async function generateScheduledAlerts(): Promise<void> {
  const now      = new Date();
  const today    = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];
  const todayStart = today + "T00:00:00.000Z";

  await Promise.allSettled([
    generateOverdueAlerts(today, todayStart),
    generatePendingPastDueAlerts(today, todayStart),
    generateTomorrowAppointmentAlert(tomorrow, today, todayStart),
    generateMissedAppointmentAlerts(now.toISOString()),
  ]);
}

async function generateOverdueAlerts(today: string, todayStart: string) {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, balance_due, due_date, patient_id")
    .eq("status", "overdue");

  for (const inv of invoices ?? []) {
    const typedInv = inv as unknown as { id: string; invoice_number: string | null; balance_due: number; due_date: string; patient_id: string };
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("type", "overdue_invoice_alert")
      .eq("related_id", typedInv.id)
      .gte("created_at", todayStart);

    if ((count ?? 0) > 0) continue;

    await supabase.from("notifications").insert({
      title: "Invoice overdue",
      body: `Invoice${typedInv.invoice_number ? " " + typedInv.invoice_number : ""} is overdue. Balance: $${Number(typedInv.balance_due).toFixed(2)}.`,
      category: "billing",
      type: "overdue_invoice_alert",
      priority: "urgent",
      status: "unread",
      related_id: typedInv.id,
      related_type: "invoice",
      role_target: "manager",
      metadata: { invoice_number: typedInv.invoice_number, balance_due: typedInv.balance_due, due_date: typedInv.due_date },
      expires_at: null,
    });
  }
}

async function generatePendingPastDueAlerts(today: string, todayStart: string) {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, balance_due, due_date, patient_id")
    .eq("status", "pending")
    .lt("due_date", today);

  for (const inv of invoices ?? []) {
    const typedInv = inv as unknown as { id: string; invoice_number: string | null; balance_due: number; due_date: string };
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("type", "pending_invoice_overdue")
      .eq("related_id", typedInv.id)
      .gte("created_at", todayStart);

    if ((count ?? 0) > 0) continue;

    await supabase.from("notifications").insert({
      title: "Payment overdue",
      body: `Invoice${typedInv.invoice_number ? " " + typedInv.invoice_number : ""} was due ${typedInv.due_date}. Balance: $${Number(typedInv.balance_due).toFixed(2)}.`,
      category: "billing",
      type: "pending_invoice_overdue",
      priority: "high",
      status: "unread",
      related_id: typedInv.id,
      related_type: "invoice",
      role_target: "manager",
      metadata: { invoice_number: typedInv.invoice_number, due_date: typedInv.due_date, balance_due: typedInv.balance_due },
      expires_at: null,
    });
  }
}

async function generateTomorrowAppointmentAlert(tomorrow: string, today: string, todayStart: string) {
  const { data: apts } = await supabase
    .from("appointments")
    .select("id")
    .gte("scheduled_at", tomorrow + "T00:00:00.000Z")
    .lt("scheduled_at", tomorrow + "T23:59:59.999Z")
    .in("status", ["scheduled", "confirmed"]);

  const total = apts?.length ?? 0;
  if (total === 0) return;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", "tomorrow_appointments")
    .gte("created_at", todayStart);

  if ((count ?? 0) > 0) return;

  await supabase.from("notifications").insert({
    title: `${total} appointment${total !== 1 ? "s" : ""} scheduled tomorrow`,
    body: `There ${total === 1 ? "is" : "are"} ${total} appointment${total !== 1 ? "s" : ""} scheduled for ${tomorrow}.`,
    category: "appointment",
    type: "tomorrow_appointments",
    priority: "normal",
    status: "unread",
    related_id: null,
    related_type: null,
    role_target: "receptionist",
    metadata: { count: total, date: tomorrow },
    expires_at: tomorrow + "T23:59:59.999Z",
  });
}

async function generateMissedAppointmentAlerts(nowIso: string) {
  const { data: apts } = await supabase
    .from("appointments")
    .select("id, patient_id, scheduled_at")
    .in("status", ["scheduled", "confirmed"])
    .lt("scheduled_at", nowIso);

  for (const apt of apts ?? []) {
    const typedApt = apt as unknown as { id: string; patient_id: string; scheduled_at: string };
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("type", "missed_appointment")
      .eq("related_id", typedApt.id);

    if ((count ?? 0) > 0) continue;

    await supabase.from("notifications").insert({
      title: "Potential missed appointment",
      body: `An appointment scheduled for ${new Date(typedApt.scheduled_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} was never checked in.`,
      category: "appointment",
      type: "missed_appointment",
      priority: "high",
      status: "unread",
      related_id: typedApt.id,
      related_type: "appointment",
      role_target: "receptionist",
      metadata: { scheduled_at: typedApt.scheduled_at, patient_id: typedApt.patient_id },
      expires_at: null,
    });
  }
}
