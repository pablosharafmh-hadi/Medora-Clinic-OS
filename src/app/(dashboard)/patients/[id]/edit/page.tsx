import { notFound } from "next/navigation";
import { getPatient } from "@/lib/supabase/patients";
import { EditPatientClient } from "./edit-patient-client";

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();
  return <EditPatientClient patient={patient} />;
}
