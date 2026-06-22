import { supabase } from "./client";
import type { FinancialTransaction, FinancialTransactionInsert } from "../types";

export async function logTransaction(input: FinancialTransactionInsert): Promise<void> {
  await supabase.from("financial_transactions").insert(input);
}

export async function getTransactions(limit = 50): Promise<FinancialTransaction[]> {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as FinancialTransaction[];
}

export async function getInvoiceTransactions(invoiceId: string): Promise<FinancialTransaction[]> {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FinancialTransaction[];
}
