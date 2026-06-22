"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  DollarSign,
  User,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { updateInvoiceStatus, deleteInvoice } from "@/lib/supabase/invoices";
import { recordPayment } from "@/lib/supabase/payments";
import { logTransaction } from "@/lib/supabase/financial-transactions";
import { InvoiceStatusBadge, PaymentMethodBadge, formatCurrency } from "@/components/finance/invoice-status-badge";
import type { InvoiceWithRelations, InvoiceStatus, Payment, PaymentMethod } from "@/lib/types";

const METHOD_OPTIONS: { label: string; value: PaymentMethod }[] = [
  { label: "Cash", value: "cash" },
  { label: "Credit Card", value: "credit_card" },
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Insurance", value: "insurance" },
  { label: "Other", value: "other" },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">{title}</h2>
      {children}
    </div>
  );
}

interface Props {
  invoice: InvoiceWithRelations;
}

export function InvoiceDetailClient({ invoice: initial }: Props) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initial);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Payment form state
  const [payAmount, setPayAmount] = useState(invoice.balance_due);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const handleRecordPayment = async () => {
    setPayError(null);
    if (!payAmount || payAmount <= 0) { setPayError("Enter a valid amount."); return; }
    if (payAmount > invoice.balance_due) { setPayError(`Amount exceeds balance due (${formatCurrency(invoice.balance_due)}).`); return; }
    setPaying(true);
    try {
      const payment = await recordPayment({
        invoice_id: invoice.id,
        patient_id: invoice.patient_id,
        payment_date: payDate,
        amount: payAmount,
        payment_method: payMethod,
        reference_number: payRef.trim() || null,
        notes: payNotes.trim() || null,
        status: "completed",
      });

      await logTransaction({
        type: "payment_recorded",
        invoice_id: invoice.id,
        payment_id: payment.id,
        patient_id: invoice.patient_id,
        amount: payAmount,
        description: `Payment of ${formatCurrency(payAmount)} recorded for invoice ${invoice.invoice_number}`,
        metadata: {},
      });

      // Refresh from server (reload page)
      router.refresh();
      setShowPaymentModal(false);
      // Optimistically update state
      const newPaid = invoice.amount_paid + payAmount;
      const newBalance = Math.max(0, invoice.total_amount - newPaid);
      const newStatus: InvoiceStatus = newBalance <= 0 ? "paid" : "partially_paid";
      const newPayment: Payment = payment;
      setInvoice((prev) => ({
        ...prev,
        amount_paid: newPaid,
        balance_due: newBalance,
        status: newStatus,
        payments: [newPayment, ...(prev.payments ?? [])],
      }));
      setPayAmount(newBalance);
    } catch (err) {
      console.error(err);
      setPayError("Failed to record payment. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    setUpdating(true);
    try {
      await updateInvoiceStatus(invoice.id, "cancelled");
      await logTransaction({
        type: "invoice_cancelled",
        invoice_id: invoice.id,
        payment_id: null,
        patient_id: invoice.patient_id,
        amount: invoice.total_amount,
        description: `Invoice ${invoice.invoice_number} cancelled`,
        metadata: {},
      });
      setInvoice((prev) => ({ ...prev, status: "cancelled" }));
      setShowCancelConfirm(false);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteInvoice(invoice.id);
      router.push("/finance/invoices");
    } catch {
      setDeleting(false);
    }
  };

  const patientName = invoice.patient
    ? `${invoice.patient.first_name} ${invoice.patient.last_name}`
    : "Unknown patient";

  const canEdit = invoice.status === "draft" || invoice.status === "pending";
  const canDelete = invoice.status === "draft" || invoice.status === "cancelled";
  const canRecord = invoice.balance_due > 0 && !["cancelled", "refunded"].includes(invoice.status);
  const canCancel = !["cancelled", "refunded", "paid"].includes(invoice.status);

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/finance/invoices" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all mt-0.5 flex-shrink-0">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[18px] font-bold text-slate-900 font-mono">
                {invoice.invoice_number ?? "Invoice"}
              </h1>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <p className="text-[13px] text-slate-500 mt-1">
              {patientName} · Issued {new Date(invoice.issue_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && (
              <Link href={`/finance/invoices/${invoice.id}/edit`} className="flex items-center gap-2 h-8 px-3 text-[12px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <Edit2 size={13} />
                Edit
              </Link>
            )}
            {canDelete && (
              <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 h-8 px-3 text-[12px] font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={13} />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main content */}
        <div className="col-span-2 space-y-5">
          {/* Line items */}
          <SectionCard title="Invoice items">
            {invoice.invoice_items.length === 0 ? (
              <p className="text-[13px] text-slate-400">No items recorded.</p>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em]">Description</th>
                      <th className="pb-2 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em]">Qty</th>
                      <th className="pb-2 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em]">Unit</th>
                      <th className="pb-2 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoice.invoice_items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 text-[13px] text-slate-800">{item.description}</td>
                        <td className="py-3 text-[13px] text-slate-600 text-center">{item.quantity}</td>
                        <td className="py-3 text-[13px] text-slate-600 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="py-3 text-[13px] font-semibold text-slate-800 text-right">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Payment history */}
          <SectionCard title="Payment history">
            {(invoice.payments ?? []).length === 0 ? (
              <p className="text-[13px] text-slate-400">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {(invoice.payments ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                        <DollarSign size={13} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-slate-800">{formatCurrency(p.amount)}</p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(p.payment_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {p.reference_number ? ` · Ref: ${p.reference_number}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <PaymentMethodBadge method={p.payment_method} />
                      <span className={cn(
                        "text-[11px] font-medium px-2 py-0.5 rounded-md",
                        p.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {invoice.notes && (
            <SectionCard title="Notes">
              <p className="text-[13px] text-slate-700 leading-relaxed">{invoice.notes}</p>
            </SectionCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="col-span-1 space-y-4">
          {/* Financial summary */}
          <SectionCard title="Summary">
            <div className="space-y-2">
              {[
                { label: "Subtotal", value: formatCurrency(invoice.subtotal), color: "text-slate-700" },
                ...(invoice.tax_rate > 0 ? [{ label: `Tax (${invoice.tax_rate}%)`, value: formatCurrency(invoice.tax_amount), color: "text-slate-700" }] : []),
                ...(invoice.discount_amount > 0 ? [{ label: "Discount", value: `−${formatCurrency(invoice.discount_amount)}`, color: "text-emerald-600" }] : []),
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-500">{label}</span>
                  <span className={cn("font-medium", color)}>{value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[14px] font-bold text-slate-900">Total</span>
                <span className="text-[15px] font-bold text-slate-900">{formatCurrency(invoice.total_amount)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-500">Paid</span>
                <span className="font-medium text-emerald-600">{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className={cn("pt-2 border-t border-slate-100 flex items-center justify-between text-[14px] font-bold", invoice.balance_due > 0 ? "text-red-600" : "text-slate-400")}>
                <span>Balance due</span>
                <span>{formatCurrency(invoice.balance_due)}</span>
              </div>
            </div>
          </SectionCard>

          {/* Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2">
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Actions</h2>
            {canRecord && (
              <button
                onClick={() => { setPayAmount(invoice.balance_due); setShowPaymentModal(true); }}
                className="w-full flex items-center gap-2.5 h-9 px-3 text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                <DollarSign size={14} />
                Record payment
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={updating}
                className="w-full flex items-center gap-2.5 h-9 px-3 text-[12px] font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <XCircle size={14} />
                Cancel invoice
              </button>
            )}
            {invoice.status === "paid" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg">
                <CheckCircle size={14} className="text-emerald-600" />
                <span className="text-[12px] font-semibold text-emerald-700">Fully paid</span>
              </div>
            )}
          </div>

          {/* Patient */}
          <SectionCard title="Patient">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <User size={15} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-800">{patientName}</p>
                {invoice.patient?.patient_number && (
                  <p className="text-[11px] font-mono text-slate-400">{invoice.patient.patient_number}</p>
                )}
              </div>
            </div>
            <Link
              href={`/patients/${invoice.patient_id}`}
              className="mt-3 block text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              View patient profile →
            </Link>
          </SectionCard>

          {/* Dates */}
          <SectionCard title="Dates">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-[0.06em]">Issued</p>
                  <p className="text-[12px] text-slate-700">{new Date(invoice.issue_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              </div>
              {invoice.due_date && (
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-slate-400" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.06em]">Due</p>
                    <p className="text-[12px] text-slate-700">{new Date(invoice.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-[0.06em]">Created</p>
                  <p className="text-[12px] text-slate-700">{new Date(invoice.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Record payment modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !paying && setShowPaymentModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold text-slate-900">Record payment</h2>
              <p className="text-[12px] text-slate-500">Balance: <span className="font-semibold text-red-600">{formatCurrency(invoice.balance_due)}</span></p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Amount *</label>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={payAmount}
                    onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Date *</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Payment method *</label>
                <div className="relative">
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full h-9 pl-3 pr-7 text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 appearance-none cursor-pointer"
                  >
                    {METHOD_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Reference # <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Check #, transaction ID…"
                  className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Notes <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
                <textarea
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-none placeholder:text-slate-400"
                />
              </div>
              {payError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{payError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPaymentModal(false)} disabled={paying} className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleRecordPayment} disabled={paying} className="flex-1 h-9 text-[13px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60">
                {paying ? "Recording…" : "Record payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !updating && setShowCancelConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <p className="text-[14px] font-semibold text-slate-900">Cancel invoice?</p>
            </div>
            <p className="text-[13px] text-slate-600 mb-5">
              Invoice <span className="font-mono font-semibold">{invoice.invoice_number}</span> will be marked as cancelled. Existing payments are not affected.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelConfirm(false)} disabled={updating} className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                Keep
              </button>
              <button onClick={handleCancel} disabled={updating} className="flex-1 h-9 text-[13px] font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-60">
                {updating ? "Cancelling…" : "Cancel invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <p className="text-[14px] font-semibold text-slate-900">Delete invoice?</p>
            </div>
            <p className="text-[13px] text-slate-600 mb-5">
              Invoice <span className="font-mono font-semibold">{invoice.invoice_number}</span> will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                Keep
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 h-9 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
