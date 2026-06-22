import { supabase } from "./client";
import type { Staff, StaffInsert, StaffUpdate } from "../types";

export async function getStaff(): Promise<Staff[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .order("last_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Staff[];
}

export async function createStaff(input: StaffInsert): Promise<Staff> {
  const { data, error } = await supabase
    .from("staff")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Staff;
}

export async function updateStaff(id: string, input: StaffUpdate): Promise<Staff> {
  const { data, error } = await supabase
    .from("staff")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Staff;
}

export async function deleteStaff(id: string): Promise<void> {
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) throw error;
}
