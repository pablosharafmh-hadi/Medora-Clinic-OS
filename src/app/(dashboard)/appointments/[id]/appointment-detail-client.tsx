"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  User,
  Stethoscope,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  UserCheck,
  Play,
  XCircle,
  UserMinus,
  AlertTriangle,
  ClipboardList,
  Receipt,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteAppointment, updateAppointmentStatus } from "@/lib/supabase/appointments";
import { createInvoiceFromAppointment, getInvoiceByAppointmentId } from "@/lib/supabase/invoices";
import { StatusBadge, TypeBadge } from "@/components/appointments/status-badge";
import { formatCurrency } from "@/components/finance/invoice-status-badge";
import type { AppointmentWithRelations, AppointmentStatus, Invoice } from "@/lib/types";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-slate-400" />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em]">{label}</p>
        <p className="text-[13px] text-slate-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

const WORKFLOW: Partial<Record<AppointmentStatus, { next: AppointmentStatus; label: string; icon: React.ElementType; color: string }[]>> = {
  scheduled: [
    { next: "confirmed",  label: "Confirm",      icon: CheckCircle, color: "bg-blue-600 hover:bg-blue-700 text-white" },
    { next: "checked_in", label: "Check in",     icon: UserCheck,   color: "bg-violet-600 hover:bg-violet-700 text-white" },
    { next: "cancelled",  label: "Cancel",       icon: XCircle,     color: "bg-white hover:bg-red-50 text-red-600 border border-red-200" },
    { next: "no_show",    label: "No show",      icon: UserMinus,   color: "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200" },
  ],
  confirmed: [
    { next: "checked_in", label: "Check in",     icon: UserCheck,   color: "bg-violet-600 hover:bg-violet-700 text-white" },
    { next: "cancelled",  label: "Cancel",       icon: XCircle,     color: "bg-white hover:bg-red-50 text-red-600 border border-red-200" },
    { next: "no_show",    label: "No show",      icon: UserMinus,   color: "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200" },
  ],
  checked_in: [
    { next: "in_progress", label: "Start visit", icon: Play,        color: "bg-amber-500 hover:bg-amber-600 text-white" },
    { next: "cancelled",   label: "Cancel",      icon: XCircle,     color: "bg-white hover:bg-red-50 text-red-600 border border-red-200" },
  ],
  in_progress: [
    { next: "completed",  label: "Complete visit", icon: CheckCircle, color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    { next: "cancelled",  label: "Cancel",         icon: XCircle,     color: "bg-white hover:bg-red-50 text-red-600 border border-red-200" },
  ],
};

interface Props {
  appointment: AppointmentWithRelations;
}

export function AppointmentDetailClient({ appointment: initial }: Props) {
  const router = useRouter();
  const [apt, setApt] = useState(initial);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [invoiceMsg, setInvoiceMsg] = useState<{ type: "error" | "warn"; text: string } | null>(null);

  useEffect(() => {
    getInvoiceByAppointmentId(initial.id).then(setInvoice).catch(console.error);
  }, [initial.id]);

  const handleStatusChange = async (status: AppointmentStatus) => {
    setUpdating(true);
    setInvoiceMsg(null);
    try {
      const updated = await updateAppointmentStatus(apt.id, status);
      setApt((prev) => ({ ...prev, ...updated }));

      if (status === "completed") {
        try {
          const inv = await createInvoiceFromAppointment(apt.id);
          setInvoice(inv);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Invoice could not be generated.";
          // If it already existed, fetch it silently
          const existing = await getInvoiceByAppointmentId(apt.id);
          if (existing) {
            setInvoice(existing);
          } else {
            setInvoiceMsg({ type: "error", text: msg });
          }
        }
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAppointment(apt.id);
      router.push("/appointments");
    } catch {
      setDeleting(false);
    }
  };

  const { date, time } = formatDateTime(apt.scheduled_at);
  const patientName = apt.patient ? `${apt.patient.first_name} ${apt.patient.last_name}` : "Unknown patient";
  const doctorName  = apt.doctor  ? `Dr. ${apt.doctor.first_name} ${apt.doctor.last_name}` : "Unknown doctor";
  const actions = WORKFLOW[apt.status] ?? [];
  const hasService = Boolean(apt.service_id && apt.service_name && apt.service_price !== null);

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/appointments"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all mt-0.5 flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </Link>

        <div className="flex-1 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[18px] font-bold text-slate-900">{patientName}</h1>
              <StatusBadge status={apt.status} />
            </div>
            <p className="text-[13px] text-slate-500 mt-1">{time} · {date}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/appointments/${apt.id}/edit`}
              className="flex items-center gap-2 h-8 px-3 text-[12px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Edit2 size={13} />
              Edit
            </Link>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 h-8 px-3 text-[12px] font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main details */}
        <div className="col-span-2 space-y-4">
          {/* Appointment info */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-1">
              Appointment details
            </h2>
            <div className="mt-1">
              <DetailRow icon={Calendar} label="Date" value={date} />
              <DetailRow icon={Clock}    label="Time" value={`${time} · ${apt.duration_minutes} minutes`} />
              <div className="py-3 border-b border-slate-50">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Calendar size={13} className="text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em]">Type</p>
                    <div className="mt-1">
                      <TypeBadge type={apt.type} customLabel={apt.custom_type_label} />
                    </div>
                  </div>
                </div>
              </div>
              {apt.notes && <DetailRow icon={FileText} label="Notes" value={apt.notes} />}
            </div>
          </div>

          {/* Participants */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">
              Participants
            </h2>
            <div className="space-y-3">
              {apt.patient && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <User size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">{patientName}</p>
                    {apt.patient.patient_number && (
                      <p className="text-[11px] font-mono text-slate-500">{apt.patient.patient_number}</p>
                    )}
                  </div>
                  <Link href={`/patients/${apt.patient_id}`} className="ml-auto text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
                    View profile →
                  </Link>
                </div>
              )}
              {apt.doctor && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Stethoscope size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">{doctorName}</p>
                    <p className="text-[11px] text-slate-500">{apt.doctor.specialty}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Billable service */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">
                Billable service
              </h2>
              {hasService && apt.service_price !== null && (
                <span className="text-[13px] font-bold text-slate-900">{formatCurrency(apt.service_price)}</span>
              )}
            </div>

            {hasService ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Receipt size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{apt.service_name}</p>
                  {apt.service_price !== null && (
                    <p className="text-[11px] text-emerald-700 font-medium">{formatCurrency(apt.service_price)} — invoice auto-generated on completion</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-5 text-center">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-2">
                  <Package size={16} className="text-amber-400" />
                </div>
                <p className="text-[12px] font-medium text-amber-700">No billable service selected</p>
                <p className="text-[11px] text-slate-400 mt-1">Completing this appointment will not generate an invoice.</p>
                <Link href={`/appointments/${apt.id}/edit`} className="mt-2 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
                  Edit appointment to add a service →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Workflow sidebar */}
        <div className="col-span-1 space-y-4">
          {/* Actions */}
          {actions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">
                Actions
              </h2>
              <div className="space-y-2">
                {actions.map(({ next, label, icon: Icon, color }) => (
                  <button
                    key={next}
                    onClick={() => handleStatusChange(next)}
                    disabled={updating}
                    className={cn(
                      "w-full flex items-center gap-2.5 h-9 px-3 text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50",
                      color
                    )}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
              {invoiceMsg && (
                <div className={cn(
                  "mt-3 px-3 py-2 rounded-lg text-[11px] leading-relaxed",
                  invoiceMsg.type === "error"
                    ? "bg-red-50 text-red-700 border border-red-100"
                    : "bg-amber-50 text-amber-700 border border-amber-100"
                )}>
                  {invoiceMsg.text}
                </div>
              )}
            </div>
          )}

          {/* Invoice panel */}
          {(invoice || apt.status === "completed") && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">
                Invoice
              </h2>
              {invoice ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-mono font-semibold text-slate-700">
                      {invoice.invoice_number ?? "Generating…"}
                    </span>
                    <span className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize",
                      invoice.status === "paid"         ? "bg-emerald-50 text-emerald-700" :
                      invoice.status === "pending"      ? "bg-amber-50 text-amber-700" :
                      invoice.status === "partially_paid" ? "bg-blue-50 text-blue-700" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {invoice.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[20px] font-bold text-slate-900">{formatCurrency(invoice.total_amount)}</p>
                  {invoice.balance_due > 0 && (
                    <p className="text-[11px] text-red-500">{formatCurrency(invoice.balance_due)} outstanding</p>
                  )}
                  <Link
                    href={`/finance/invoices/${invoice.id}`}
                    className="flex items-center gap-2 w-full h-8 px-3 text-[12px] font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors mt-1"
                  >
                    <Receipt size={13} />
                    View invoice
                  </Link>
                </div>
              ) : (
                <p className="text-[12px] text-slate-400">No invoice generated.</p>
              )}
            </div>
          )}

          {/* Clinical documentation */}
          {!["cancelled", "no_show"].includes(apt.status) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">
                Clinical documentation
              </h2>
              <p className="text-[12px] text-slate-500 mb-3 leading-relaxed">
                Document the clinical findings and treatment plan for this visit.
              </p>
              <a
                href={`/medical-records/new?appointmentId=${apt.id}`}
                className="w-full flex items-center justify-center gap-2 h-9 text-[12px] font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
              >
                <ClipboardList size={14} />
                Create medical record
              </a>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Record</h2>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.06em]">Created</p>
                <p className="text-[12px] text-slate-700 mt-0.5">
                  {new Date(apt.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.06em]">Last updated</p>
                <p className="text-[12px] text-slate-700 mt-0.5">
                  {new Date(apt.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDelete(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <p className="text-[14px] font-semibold text-slate-900">Delete appointment</p>
            </div>
            <p className="text-[13px] text-slate-600 mb-5">
              This will permanently delete the appointment for <span className="font-semibold">{patientName}</span> on {date}. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)} disabled={deleting} className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Keep</button>
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
