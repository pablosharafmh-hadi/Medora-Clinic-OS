import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/supabase/invoices";
import { InvoiceDetailClient } from "./invoice-detail-client";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  return <InvoiceDetailClient invoice={invoice} />;
}
