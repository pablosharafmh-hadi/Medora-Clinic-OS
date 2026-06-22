import { notFound } from "next/navigation";
import { getMedicalRecord } from "@/lib/supabase/medical-records";
import { EditRecordClient } from "./edit-record-client";

export default async function EditMedicalRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getMedicalRecord(id);
  if (!record) notFound();
  return <EditRecordClient record={record} />;
}
