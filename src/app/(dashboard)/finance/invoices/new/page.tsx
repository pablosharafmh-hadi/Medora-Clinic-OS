"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { createInvoice } from "@/lib/supabase/invoices";
import { getActiveServices } from "@/lib/supabase/services";
import { logTransaction } from "@/lib/supabase/financial-transactions";
import { formatCurrency } from "@/components/finance/invoice-status-badge";
import type { Patient, Service, InvoiceInsert, InvoiceItemInsert, InvoiceStatus } from "@/lib/types";

// ─── Patient Combobox ─────────────────────────────────────────────────────────

function PatientCombobox({
  value,
  onChange,
}: {
  value: Patient | null;
  onChange: (p: Patient | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const q = query.toLowerCase();
      const { data } = await supabase
        .from("patients")
        .select("*")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,patient_number.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8);
      setResults((data ?? []) as unknown as Patient[]);
      setSearching(false);
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const select = (p: Patient) => {
    onChange(p);
    setQuery(`${p.first_name} ${p.last_name}`);
    setOpen(false);
  };

  const clear = () => { onChange(null); setQuery(""); setResults([]); };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search patient by name, phone, or ID…"
          value={value ? `${value.first_name} ${value.last_name}` : query}
          onChange={(e) => { if (value) clear(); setQuery(e.target.value); }}
          onFocus={() => { if (results.length) setOpen(true); }}
          className={cn(
            "w-full h-9 pl-8 pr-8 text-[13px] text-slate-800 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-50 placeholder:text-slate-400 transition-colors",
            value ? "border-blue-400 bg-blue-50/30" : "border-slate-200 focus:border-blue-400"
          )}
        />
        {value && (
          <button onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            ×
          </button>
        )}
      </div>
      {open && results.length > 0 && !value && (
        <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 max-h-52 overflow-y-auto">
          {searching && <p className="px-3 py-2 text-[12px] text-slate-400">Searching…</p>}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-800">{p.first_name} {p.last_name}</p>
                <p className="text-[11px] text-slate-400">{p.patient_number} · {p.phone}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Line Item Row ────────────────────────────────────────────────────────────

type LineItem = {
  localId: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

function LineItemRow({
  item,
  services,
  onChange,
  onRemove,
  showRemove,
}: {
  item: LineItem;
  services: Service[];
  onChange: (updated: LineItem) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const total = item.quantity * item.unit_price;

  const onServiceChange = (serviceId: string) => {
    if (!serviceId) {
      onChange({ ...item, service_id: null });
      return;
    }
    const svc = services.find((s) => s.id === serviceId);
    onChange({
      ...item,
      service_id: serviceId,
      description: svc ? svc.service_name : item.description,
      unit_price: svc ? svc.price : item.unit_price,
    });
  };

  return (
    <div className="grid grid-cols-[2fr_2fr_1fr_1.5fr_auto] gap-3 items-start">
      <div>
        <div className="relative">
          <select
            value={item.service_id ?? ""}
            onChange={(e) => onServiceChange(e.target.value)}
            className="w-full h-9 pl-3 pr-7 text-[12px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 appearance-none cursor-pointer"
          >
            <option value="">Custom / no service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.service_name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>
      <input
        type="text"
        placeholder="Description"
        value={item.description}
        onChange={(e) => onChange({ ...item, description: e.target.value })}
        className="h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-400"
      />
      <input
        type="number"
        min={1}
        value={item.quantity}
        onChange={(e) => onChange({ ...item, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
        className="h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 text-center"
      />
      <input
        type="number"
        min={0}
        step={0.01}
        value={item.unit_price}
        onChange={(e) => onChange({ ...item, unit_price: parseFloat(e.target.value) || 0 })}
        className="h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
      />
      <div className="flex items-center gap-2 h-9">
        <span className="text-[13px] font-semibold text-slate-800 min-w-[64px] text-right">
          {formatCurrency(total)}
        </span>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewInvoicePage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saveAs, setSaveAs] = useState<"draft" | "pending">("draft");
  const [items, setItems] = useState<LineItem[]>([
    { localId: crypto.randomUUID(), service_id: null, description: "", quantity: 1, unit_price: 0 },
  ]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!patient) { setError("Please select a patient."); return; }
    if (items.some((i) => !i.description.trim())) { setError("All line items must have a description."); return; }
    if (items.length === 0) { setError("Add at least one item."); return; }

    setSaving(true);
    try {
      const invoiceInput: InvoiceInsert = {
        patient_id: patient.id,
        appointment_id: null,
        medical_record_id: null,
        issue_date: issueDate,
        due_date: dueDate || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        amount_paid: 0,
        balance_due: totalAmount,
        status: saveAs as InvoiceStatus,
        notes: notes.trim() || null,
      };

      const itemInputs: Omit<InvoiceItemInsert, "invoice_id">[] = items.map((i) => ({
        service_id: i.service_id,
        description: i.description.trim(),
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.quantity * i.unit_price,
      }));

      const invoice = await createInvoice(invoiceInput, itemInputs);

      await logTransaction({
        type: "invoice_created",
        invoice_id: invoice.id,
        patient_id: patient.id,
        payment_id: null,
        amount: totalAmount,
        description: `Invoice ${invoice.invoice_number} created for ${patient.first_name} ${patient.last_name}`,
        metadata: {},
      });

      router.push(`/finance/invoices/${invoice.id}`);
    } catch (err) {
      console.error(err);
      setError("Failed to create invoice. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-[18px] font-bold text-slate-900">New invoice</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Create a patient billing invoice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Patient & dates */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Patient & Dates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
                Patient <span className="text-red-500">*</span>
              </label>
              <PatientCombobox value={patient} onChange={setPatient} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
                Issue Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
                Due Date <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Items</h2>

          {/* Column headers */}
          <div className="grid grid-cols-[2fr_2fr_1fr_1.5fr_auto] gap-3 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em] px-0">
            <span>Service</span>
            <span>Description</span>
            <span className="text-center">Qty</span>
            <span>Unit Price</span>
            <span className="text-right min-w-[64px]">Total</span>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <LineItemRow
                key={item.localId}
                item={item}
                services={services}
                onChange={(updated) => updateItem(item.localId, updated)}
                onRemove={() => removeItem(item.localId)}
                showRemove={items.length > 1}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-2 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus size={14} />
            Add item
          </button>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-4">Totals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
                Discount ($)
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="space-y-1.5 text-right">
                <div className="flex justify-between text-[13px] text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-[13px] text-slate-600">
                    <span>Tax ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[13px] text-emerald-600">
                    <span>Discount</span>
                    <span>−{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[15px] font-bold text-slate-900 pt-1.5 border-t border-slate-100">
                  <span>Total</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
              Notes <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes or instructions for this invoice…"
              className="w-full px-3 py-2.5 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 px-5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={() => setSaveAs("draft")}
            className="h-9 px-5 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {saving && saveAs === "draft" ? "Saving…" : "Save as draft"}
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={() => setSaveAs("pending")}
            className="h-9 px-5 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {saving && saveAs === "pending" ? "Sending…" : "Send invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
