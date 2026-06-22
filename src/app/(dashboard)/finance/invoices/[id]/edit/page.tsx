import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/supabase/invoices";
import { EditInvoiceClient } from "./edit-invoice-client";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  if (!["draft", "pending"].includes(invoice.status)) {
    // Only draft/pending invoices can be edited — redirect to detail
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-3">
        <p className="text-[15px] font-semibold text-slate-900">Invoice cannot be edited</p>
        <p className="text-[13px] text-slate-500">Only draft or pending invoices can be modified.</p>
        <a href={`/finance/invoices/${id}`} className="inline-block text-[13px] font-semibold text-blue-600 hover:text-blue-700">
          ← Back to invoice
        </a>
      </div>
    );
  }
  return <EditInvoiceClient invoice={invoice} />;
}
