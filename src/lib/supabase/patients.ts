import { supabase } from "./client";
import type { Patient, PatientInsert, PatientUpdate, PatientMetrics } from "../types";

export type SortField = "first_name" | "last_name" | "created_at" | "patient_number" | "status";
export type SortOrder = "asc" | "desc";
export type StatusFilter = "all" | "active" | "inactive" | "deceased";

export interface GetPatientsOptions {
  search?: string;
  status?: StatusFilter;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface PaginatedPatients {
  data: Patient[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getPatients(options: GetPatientsOptions = {}): Promise<PaginatedPatients> {
  const {
    search = "",
    status = "all",
    sortBy = "created_at",
    sortOrder = "desc",
    page = 1,
    pageSize = 20,
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("patients")
    .select("*", { count: "exact" });

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},email.ilike.${term},patient_number.ilike.${term}`
    );
  }

  if (status !== "all") {
    query = query.eq("status", status);
  }

  query = query.order(sortBy, { ascending: sortOrder === "asc" });
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: data ?? [],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getPatient(id: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data;
}

export async function createPatient(input: PatientInsert): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePatient(id: string, input: PatientUpdate): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePatient(id: string): Promise<void> {
  const { error } = await supabase
    .from("patients")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getPatientMetrics(): Promise<PatientMetrics> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [totalResult, activeResult, inactiveResult, thisMonthResult] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("status", "inactive"),
    supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", firstOfMonth),
  ]);

  return {
    total: totalResult.count ?? 0,
    active: activeResult.count ?? 0,
    inactive: inactiveResult.count ?? 0,
    thisMonth: thisMonthResult.count ?? 0,
  };
}
