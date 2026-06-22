import { notFound } from "next/navigation";
import { getAppointment } from "@/lib/supabase/appointments";
import { EditAppointmentClient } from "./edit-appointment-client";

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appointment = await getAppointment(id);
  if (!appointment) notFound();
  return <EditAppointmentClient appointment={appointment} />;
}
