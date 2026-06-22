import { supabase } from "./client";
import type { Payment, PaymentInsert } from "../types";

export async function getInvoicePayments(invoiceId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("payment_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Payment[];
}

export async function getPatientPayments(patientId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("patient_id", patientId)
    .order("payment_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Payment[];
}

export async function recordPayment(input: PaymentInsert): Promise<Payment> {
  const { data, error } = await supabase
    .from("payments")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  const payment = data as unknown as Payment;

  // Recalculate invoice amounts and update status
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("total_amount, amount_paid")
    .eq("id", input.invoice_id)
    .single();

  if (!invErr && invoice) {
    const inv = invoice as unknown as { total_amount: number; amount_paid: number };
    const newAmountPaid = inv.amount_paid + input.amount;
    const newBalanceDue = Math.max(0, inv.total_amount - newAmountPaid);

    let newStatus: string;
    if (newBalanceDue <= 0) {
      newStatus = "paid";
    } else if (newAmountPaid > 0) {
      newStatus = "partially_paid";
    } else {
      newStatus = "pending";
    }

    await supabase
      .from("invoices")
      .update({
        amount_paid: newAmountPaid,
        balance_due: newBalanceDue,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.invoice_id);
  }

  return payment;
}

export async function refundPayment(paymentId: string): Promise<Payment> {
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();

  if (payErr) throw payErr;
  const p = payment as unknown as Payment;

  // Mark payment as refunded
  const { data: updated, error: updErr } = await supabase
    .from("payments")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .select()
    .single();

  if (updErr) throw updErr;

  // Recalculate invoice
  const { data: allPayments } = await supabase
    .from("payments")
    .select("amount, status")
    .eq("invoice_id", p.invoice_id)
    .eq("status", "completed");

  const totalPaid = ((allPayments ?? []) as unknown as { amount: number }[])
    .reduce((s, r) => s + r.amount, 0);

  const { data: invoice } = await supabase
    .from("invoices")
    .select("total_amount")
    .eq("id", p.invoice_id)
    .single();

  if (invoice) {
    const total = (invoice as unknown as { total_amount: number }).total_amount;
    const balanceDue = Math.max(0, total - totalPaid);
    const status = totalPaid <= 0 ? "pending" : balanceDue <= 0 ? "paid" : "partially_paid";

    await supabase
      .from("invoices")
      .update({
        amount_paid: totalPaid,
        balance_due: balanceDue,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.invoice_id);
  }

  return updated as unknown as Payment;
}
