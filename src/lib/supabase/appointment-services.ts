import { supabase } from "./client";
import type { AppointmentService, SelectedService } from "../types";

export async function getAppointmentServices(
  appointmentId: string
): Promise<AppointmentService[]> {
  const { data, error } = await supabase
    .from("appointment_services")
    .select("*, service:services(service_name, category, description, price)")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as AppointmentService[];
}

export async function setAppointmentServices(
  appointmentId: string,
  services: SelectedService[]
): Promise<void> {
  const { error: delErr } = await supabase
    .from("appointment_services")
    .delete()
    .eq("appointment_id", appointmentId);

  if (delErr) throw delErr;

  if (services.length === 0) return;

  const rows = services.map((s) => ({
    appointment_id: appointmentId,
    service_id: s.service_id,
    quantity: s.quantity,
    unit_price: s.unit_price,
  }));

  const { error: insErr } = await supabase
    .from("appointment_services")
    .insert(rows);

  if (insErr) throw insErr;
}
