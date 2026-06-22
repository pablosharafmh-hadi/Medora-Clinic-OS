import { supabase } from "./client";
import type { Prescription, PrescriptionInsert, PrescriptionUpdate } from "../types";

export async function getPrescriptions(
  medicalRecordId: string
): Promise<Prescription[]> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("medical_record_id", medicalRecordId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Prescription[];
}

export async function createPrescription(
  input: PrescriptionInsert
): Promise<Prescription> {
  const { data, error } = await supabase
    .from("prescriptions")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Prescription;
}

export async function updatePrescription(
  id: string,
  input: PrescriptionUpdate
): Promise<Prescription> {
  const { data, error } = await supabase
    .from("prescriptions")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Prescription;
}

export async function deletePrescription(id: string): Promise<void> {
  const { error } = await supabase
    .from("prescriptions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
