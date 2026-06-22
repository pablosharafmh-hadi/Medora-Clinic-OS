import { notFound } from "next/navigation";
import { getMedicalRecord } from "@/lib/supabase/medical-records";
import { RecordDetailClient } from "./record-detail-client";

export default async function MedicalRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getMedicalRecord(id);
  if (!record) notFound();
  return <RecordDetailClient record={record} />;
}
