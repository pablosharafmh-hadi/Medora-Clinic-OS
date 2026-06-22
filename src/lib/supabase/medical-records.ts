import { supabase } from "./client";
import type {
  MedicalRecord,
  MedicalRecordWithRelations,
  MedicalRecordInsert,
  MedicalRecordUpdate,
  MedicalRecordMetrics,
} from "../types";

const RELATIONS = `
  *,
  patient:patients(first_name, last_name, patient_number),
  doctor:doctors(first_name, last_name, specialty),
  appointment:appointments(scheduled_at, type),
  prescriptions(*)
` as const;

export interface GetMedicalRecordsOptions {
  search?: string;
  status?: "draft" | "final" | "amended" | "all";
  doctorId?: string;
  patientId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedMedicalRecords {
  data: MedicalRecordWithRelations[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getMedicalRecords(
  options: GetMedicalRecordsOptions = {}
): Promise<PaginatedMedicalRecords> {
  const {
    search = "",
    status = "all",
    doctorId,
    patientId,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 20,
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("medical_records")
    .select(RELATIONS, { count: "exact" });

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`chief_complaint.ilike.${term},diagnosis.ilike.${term}`);
  }

  if (status !== "all") query = query.eq("status", status);
  if (doctorId) query = query.eq("doctor_id", doctorId);
  if (patientId) query = query.eq("patient_id", patientId);
  if (dateFrom) query = query.gte("visit_date", dateFrom);
  if (dateTo) query = query.lte("visit_date", dateTo);

  query = query.order("visit_date", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: (data ?? []) as unknown as MedicalRecordWithRelations[],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getMedicalRecord(
  id: string
): Promise<MedicalRecordWithRelations | null> {
  const { data, error } = await supabase
    .from("medical_records")
    .select(RELATIONS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as unknown as MedicalRecordWithRelations;
}

export async function getPatientMedicalRecords(
  patientId: string
): Promise<MedicalRecordWithRelations[]> {
  const { data, error } = await supabase
    .from("medical_records")
    .select(RELATIONS)
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as MedicalRecordWithRelations[];
}

export async function createMedicalRecord(
  input: MedicalRecordInsert
): Promise<MedicalRecord> {
  const { data, error } = await supabase
    .from("medical_records")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MedicalRecord;
}

export async function updateMedicalRecord(
  id: string,
  input: MedicalRecordUpdate
): Promise<MedicalRecord> {
  const { data, error } = await supabase
    .from("medical_records")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MedicalRecord;
}

export async function deleteMedicalRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from("medical_records")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function getMedicalRecordMetrics(): Promise<MedicalRecordMetrics> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [totalRes, thisMonthRes, draftRes, finalRes, followUpRes] =
    await Promise.all([
      supabase
        .from("medical_records")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("medical_records")
        .select("id", { count: "exact", head: true })
        .gte("visit_date", firstOfMonth),
      supabase
        .from("medical_records")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
      supabase
        .from("medical_records")
        .select("id", { count: "exact", head: true })
        .eq("status", "final"),
      supabase
        .from("medical_records")
        .select("id", { count: "exact", head: true })
        .eq("follow_up_required", true),
    ]);

  return {
    total: totalRes.count ?? 0,
    thisMonth: thisMonthRes.count ?? 0,
    draft: draftRes.count ?? 0,
    final: finalRes.count ?? 0,
    withFollowUp: followUpRes.count ?? 0,
  };
}
