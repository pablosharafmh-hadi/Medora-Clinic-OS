import { supabase } from "./client";
import type {
  Appointment,
  AppointmentWithRelations,
  AppointmentInsert,
  AppointmentUpdate,
  AppointmentStatus,
  AppointmentMetrics,
} from "../types";

const RELATIONS = `
  *,
  patient:patients(first_name, last_name, patient_number),
  doctor:doctors(first_name, last_name, specialty)
` as const;

export type StatusFilter = AppointmentStatus | "all";
export type TypeFilter = Appointment["type"] | "all";

export interface GetAppointmentsOptions {
  status?: StatusFilter;
  type?: TypeFilter;
  doctorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedAppointments {
  data: AppointmentWithRelations[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getAppointments(
  options: GetAppointmentsOptions = {}
): Promise<PaginatedAppointments> {
  const {
    status = "all",
    type = "all",
    doctorId,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 25,
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("appointments")
    .select(RELATIONS, { count: "exact" });

  if (status !== "all") query = query.eq("status", status);
  if (type !== "all") query = query.eq("type", type);
  if (doctorId) query = query.eq("doctor_id", doctorId);
  if (dateFrom) query = query.gte("scheduled_at", dateFrom);
  if (dateTo) query = query.lte("scheduled_at", dateTo);

  query = query.order("scheduled_at", { ascending: true }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: (data ?? []) as unknown as AppointmentWithRelations[],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getAppointment(
  id: string
): Promise<AppointmentWithRelations | null> {
  const { data, error } = await supabase
    .from("appointments")
    .select(RELATIONS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as unknown as AppointmentWithRelations;
}

export async function getPatientAppointments(
  patientId: string
): Promise<AppointmentWithRelations[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(RELATIONS)
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as AppointmentWithRelations[];
}

export async function getAppointmentsForDateRange(
  start: Date,
  end: Date
): Promise<AppointmentWithRelations[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(RELATIONS)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString())
    .not("status", "in", "(cancelled,no_show)")
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as AppointmentWithRelations[];
}

export async function getTodayAppointments(): Promise<AppointmentWithRelations[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const { data, error } = await supabase
    .from("appointments")
    .select(RELATIONS)
    .gte("scheduled_at", startOfDay.toISOString())
    .lte("scheduled_at", endOfDay.toISOString())
    .not("status", "in", "(cancelled,no_show)")
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as AppointmentWithRelations[];
}

export async function getDoctorSchedule(
  doctorId: string,
  date: string
): Promise<Appointment[]> {
  const dayStart = new Date(`${date}T00:00:00`).toISOString();
  const dayEnd = new Date(`${date}T23:59:59`).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, scheduled_at, duration_minutes, status")
    .eq("doctor_id", doctorId)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd)
    .not("status", "in", "(cancelled,no_show)");

  if (error) throw error;
  return (data ?? []) as unknown as Appointment[];
}

export async function checkConflict(
  doctorId: string,
  scheduledAt: string,
  durationMinutes: number,
  excludeId?: string
): Promise<boolean> {
  const newStart = new Date(scheduledAt).getTime();
  const newEnd = newStart + durationMinutes * 60000;

  // Fetch a short window around the new appointment
  const windowStart = new Date(newStart - 4 * 3600000).toISOString();
  const windowEnd = new Date(newEnd + 4 * 3600000).toISOString();

  let query = supabase
    .from("appointments")
    .select("id, scheduled_at, duration_minutes")
    .eq("doctor_id", doctorId)
    .not("status", "in", "(cancelled,no_show)")
    .gte("scheduled_at", windowStart)
    .lte("scheduled_at", windowEnd);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).some((apt) => {
    if (excludeId && apt.id === excludeId) return false;
    const existStart = new Date(apt.scheduled_at).getTime();
    const existEnd = existStart + apt.duration_minutes * 60000;
    return newStart < existEnd && newEnd > existStart;
  });
}

export async function createAppointment(
  input: AppointmentInsert
): Promise<Appointment> {
  const conflict = await checkConflict(
    input.doctor_id,
    input.scheduled_at,
    input.duration_minutes
  );
  if (conflict) {
    throw new Error(
      "This time slot is already booked for the selected doctor. Please choose a different time."
    );
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Appointment;
}

export async function updateAppointment(
  id: string,
  input: AppointmentUpdate
): Promise<Appointment> {
  if (input.doctor_id && input.scheduled_at && input.duration_minutes) {
    const conflict = await checkConflict(
      input.doctor_id,
      input.scheduled_at,
      input.duration_minutes,
      id
    );
    if (conflict) {
      throw new Error(
        "This time slot is already booked for the selected doctor. Please choose a different time."
      );
    }
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Appointment;
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<Appointment> {
  const { data, error } = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Appointment;
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw error;
}

export async function getAppointmentMetrics(): Promise<AppointmentMetrics> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const day = now.getDay(); // 0 = Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [todayResult, weekResult, completedResult, cancelledResult, noShowResult] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_at", todayStart)
        .lt("scheduled_at", todayEnd),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString()),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "cancelled"),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "no_show"),
    ]);

  return {
    today: todayResult.count ?? 0,
    thisWeek: weekResult.count ?? 0,
    completed: completedResult.count ?? 0,
    cancelled: cancelledResult.count ?? 0,
    noShow: noShowResult.count ?? 0,
  };
}

export async function getAppointmentDailySnapshot(): Promise<{
  completedToday: number;
  pendingToday: number;
}> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const todayStart = `${y}-${pad(m + 1)}-${pad(d)}T00:00:00`;
  const tomorrowStart = (() => {
    const t = new Date(y, m, d + 1);
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T00:00:00`;
  })();

  const [completedResult, pendingResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("scheduled_at", todayStart)
      .lt("scheduled_at", tomorrowStart),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .in("status", ["scheduled", "confirmed", "checked_in", "in_progress"])
      .gte("scheduled_at", todayStart)
      .lt("scheduled_at", tomorrowStart),
  ]);

  return {
    completedToday: completedResult.count ?? 0,
    pendingToday:   pendingResult.count ?? 0,
  };
}
