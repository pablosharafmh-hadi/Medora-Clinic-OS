import { supabase } from "./client";
import type { Doctor } from "../types";

export type DoctorInsert = Omit<Doctor, "id" | "created_at" | "updated_at">;
export type DoctorUpdate = Partial<Omit<Doctor, "id" | "created_at" | "updated_at">>;

export async function generateLicenseNumber(): Promise<string> {
  const { data } = await supabase
    .from("doctors")
    .select("license_number")
    .like("license_number", "DOC-%")
    .order("license_number", { ascending: false })
    .limit(1);

  type Row = { license_number: string };
  const last = ((data ?? []) as unknown as Row[])[0]?.license_number;
  const lastNum = last ? parseInt(last.replace("DOC-", ""), 10) : 0;
  const next = isNaN(lastNum) ? 1 : lastNum + 1;
  return `DOC-${String(next).padStart(4, "0")}`;
}

export async function getActiveDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .eq("status", "active")
    .order("last_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Doctor[];
}

export async function getAllDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .order("last_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Doctor[];
}

export async function createDoctor(input: DoctorInsert): Promise<Doctor> {
  const { data, error } = await supabase
    .from("doctors")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Doctor;
}

export async function updateDoctor(id: string, input: DoctorUpdate): Promise<Doctor> {
  const { data, error } = await supabase
    .from("doctors")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Doctor;
}

export async function deleteDoctor(id: string): Promise<void> {
  const { error } = await supabase.from("doctors").delete().eq("id", id);
  if (error) throw error;
}
