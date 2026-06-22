"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateInvoice } from "@/lib/supabase/invoices";
import { getActiveServices } from "@/lib/supabase/services";
import { logTransaction } from "@/lib/supabase/financial-transactions";
import { formatCurrency } from "@/components/finance/invoice-status-badge";
import type { Service, InvoiceWithRelations, InvoiceUpdate, InvoiceItemInsert } from "@/lib/types";

type LineItem = {
  localId: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

interface Props {
  invoice: InvoiceWithRelations;
}

export function EditInvoiceClient({ invoice }: Props) {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [issueDate, setIssueDate] = useState(invoice.issue_date);
  const [dueDate, setDueDate] = useState(invoice.due_date ?? "");
  const [taxRate, setTaxRate] = useState(invoice.tax_rate);
  const [discountAmount, setDiscountAmount] = useState(invoice.discount_amount);
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [items, setItems] = useState<LineItem[]>(
    invoice.invoice_items.length > 0
      ? invoice.invoice_items.map((i) => ({
          localId: i.id,
          service_id: i.service_id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }))
      : [{ localId: crypto.randomUUID(), service_id: null, description: "", quantity: 1, unit_price: 0 }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActiveServices().then(setServices).catch(() => {});
  }, []);

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), service_id: null, description: "", quantity: 1, unit_price: 0 },
    ]);

  const updateItem = useCallback((localId: string, updated: LineItem) => {
    setItems((prev) => prev.map((i) => (i.localId === localId ? updated : i)));
  }, []);

  const removeItem = useCallback((localId: string) => {
    setItems((prev) => prev.filter((i) => i.localId !== localId));
  }, []);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);
  const balanceDue = Math.max(0, totalAmount - invoice.amount_paid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (items.some((i) => !i.description.trim())) { setError("All items need a description."); return; }

    setSaving(true);
    try {
      const invoiceUpdate: InvoiceUpdate = {
        issue_date: issueDate,
        due_date: dueDate || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        balance_due: balanceDue,
        notes: notes.trim() || null,
      };

      const itemInputs: Omit<InvoiceItemInsert, "invoice_id">[] = items.map((i) => ({
        service_id: i.service_id,
        description: i.description.trim(),
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.quantity * i.unit_price,
      }));

      await updateInvoice(invoice.id, invoiceUpdate, itemInputs);

      await logTransaction({
        type: "invoice_updated",
        invoice_id: invoice.id,
        payment_id: null,
        patient_id: invoice.patient_id,
        amount: totalAmount,
        description: `Invoice ${invoice.invoice_number} updated`,
        metadata: {},
      });

      router.push(`/finance/invoices/${invoice.id}`);
    } catch (err) {
      console.error(err);
      setError("Failed to update invoice.");
    } finally {
      setSaving(false);
    }
  };

  const onServiceChange = (localId: string, serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    updateItem(localId, {
      ...items.find((i) => i.localId === localId)!,
      service_id: serviceId || null,
      description: svc ? svc.service_name : items.find((i) => i.localId === localId)!.description,
      unit_price: svc ? svc.price : items.find((i) => i.localId === localId)!.unit_price,
    });
  };

  const patientName = invoice.patient
    ? `${invoice.patient.first_name} ${invoice.patient.last_name}`
    : "Unknown patient";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-slate-900">
            Edit {invoice.invoice_number ?? "invoice"}
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Patient: {patientName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Dates */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Dates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Issue Date</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Due Date <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Items</h2>
          <div className="grid grid-cols-[2fr_2fr_1fr_1.5fr_auto] gap-3 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em]">
            <span>Service</span><span>Description</span><span className="text-center">Qty</span><span>Unit Price</span><span className="text-right min-w-[64px]">Total</span>
          </div>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.localId} className="grid grid-cols-[2fr_2fr_1fr_1.5fr_auto] gap-3 items-start">
                <div className="relative">
                  <select
                    value={item.service_id ?? ""}
                    onChange={(e) => onServiceChange(item.localId, e.target.value)}
                    className="w-full h-9 pl-3 pr-7 text-[12px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 appearance-none cursor-pointer"
                  >
                    <option value="">Custom</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.service_name}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <input type="text" placeholder="Description" value={item.description} onChange={(e) => updateItem(item.localId, { ...item, description: e.target.value })} className="h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-400" />
                <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(item.localId, { ...item, quantity: Math.max(1, parseInt(e.target.value) || 1) })} className="h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 text-center" />
                <input type="number" min={0} step={0.01} value={item.unit_price} onChange={(e) => updateItem(item.localId, { ...item, unit_price: parseFloat(e.target.value) || 0 })} className="h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                <div className="flex items-center gap-2 h-9">
                  <span className="text-[13px] font-semibold text-slate-800 min-w-[64px] text-right">{formatCurrency(item.quantity * item.unit_price)}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(item.localId)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="flex items-center gap-2 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            <Plus size={14} />
            Add item
          </button>
        </div>

        {/* Totals + notes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-4">Totals</h2>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Tax Rate (%)</label>
              <input type="number" min={0} max={100} step={0.5} value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Discount ($)</label>
              <input type="number" min={0} step={0.01} value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
            </div>
            <div className="flex flex-col justify-end text-right space-y-1.5">
              <div className="flex justify-between text-[13px] text-slate-600"><span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
              {taxRate > 0 && <div className="flex justify-between text-[13px] text-slate-600"><span>Tax</span><span>{formatCurrency(taxAmount)}</span></div>}
              {discountAmount > 0 && <div className="flex justify-between text-[13px] text-emerald-600"><span>Discount</span><span>−{formatCurrency(discountAmount)}</span></div>}
              <div className="flex justify-between text-[15px] font-bold text-slate-900 pt-1.5 border-t border-slate-100"><span>Total</span><span>{formatCurrency(totalAmount)}</span></div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Notes <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2.5 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-none placeholder:text-slate-400" />
          </div>
        </div>

        {error && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">{error}</div>}

        <div className="flex items-center gap-3 justify-end">
          <button type="button" onClick={() => router.back()} className="h-9 px-5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="h-9 px-5 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
