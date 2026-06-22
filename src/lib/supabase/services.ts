import { supabase } from "./client";
import type { Service, ServiceInsert, ServiceUpdate } from "../types";

export async function getAllServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("service_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Service[];
}

export async function getActiveServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("status", "active")
    .order("service_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Service[];
}

export async function getService(id: string): Promise<Service | null> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as unknown as Service;
}

export async function createService(input: ServiceInsert): Promise<Service> {
  const { data, error } = await supabase
    .from("services")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Service;
}

export async function updateService(id: string, input: ServiceUpdate): Promise<Service> {
  const { data, error } = await supabase
    .from("services")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Service;
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}
