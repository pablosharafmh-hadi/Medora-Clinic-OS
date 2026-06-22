import { notFound } from "next/navigation";
import { getAppointment } from "@/lib/supabase/appointments";
import { AppointmentDetailClient } from "./appointment-detail-client";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appointment = await getAppointment(id);
  if (!appointment) notFound();
  return <AppointmentDetailClient appointment={appointment} />;
}
