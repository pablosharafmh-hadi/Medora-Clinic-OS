import { notFound } from "next/navigation";
import { getPatient } from "@/lib/supabase/patients";
import { PatientProfileClient } from "./patient-profile-client";

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();
  return <PatientProfileClient patient={patient} />;
}
