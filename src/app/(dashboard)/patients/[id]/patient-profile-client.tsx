"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  User,
  Phone,
  Mail,
  MapPin,
  Droplets,
  AlertCircle,
  FileText,
  UserCheck,
  Calendar,
  Stethoscope,
  Pill,
  CalendarCheck,
  Clock,
  Plus,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deletePatient } from "@/lib/supabase/patients";
import { getPatientMedicalRecords } from "@/lib/supabase/medical-records";
import { getPatientAppointments } from "@/lib/supabase/appointments";
import { getPatientInvoices } from "@/lib/supabase/invoices";
import { RecordStatusBadge } from "@/components/medical-records/record-status-badge";
import { InvoiceStatusBadge, formatCurrency } from "@/components/finance/invoice-status-badge";
import type {
  Patient,
  MedicalRecordWithRelations,
  AppointmentWithRelations,
  Prescription,
  InvoiceWithRelations,
} from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-amber-50 text-amber-700 border-amber-200",
  deceased: "bg-slate-100 text-slate-600 border-slate-200",
};

const APT_STATUS_COLORS: Record<string, string> = {
  scheduled:   "bg-slate-100 text-slate-600",
  confirmed:   "bg-blue-50 text-blue-700",
  checked_in:  "bg-violet-50 text-violet-700",
  in_progress: "bg-amber-50 text-amber-700",
  completed:   "bg-emerald-50 text-emerald-700",
  cancelled:   "bg-red-50 text-red-600",
  no_show:     "bg-slate-100 text-slate-500",
};

const APT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled", confirmed: "Confirmed", checked_in: "Checked In",
  in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled", no_show: "No Show",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDOB(dob: string | null): string | null {
  if (!dob) return null;
  const date = new Date(dob);
  const now = new Date();
  const age =
    now.getFullYear() - date.getFullYear() -
    (now < new Date(now.getFullYear(), date.getMonth(), date.getDate()) ? 1 : 0);
  return `${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · ${age} years old`;
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 font-medium uppercase tracking-[0.06em]">{label}</p>
        <p className="text-[13px] text-slate-800 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

// ─── Timeline builder ─────────────────────────────────────────────────────────

type TimelineEvent = {
  id: string;
  title: string;
  subtitle?: string;
  date: string;
  dotColor: string;
  href?: string;
};

function buildTimeline(
  patient: Patient,
  records: MedicalRecordWithRelations[],
  appointments: AppointmentWithRelations[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id: "registered",
    title: "Patient registered",
    subtitle: formatDate(patient.created_at),
    date: patient.created_at,
    dotColor: "bg-blue-500",
  });

  if (new Date(patient.updated_at).getTime() - new Date(patient.created_at).getTime() > 5000) {
    events.push({
      id: "updated",
      title: "Patient record updated",
      subtitle: formatDate(patient.updated_at),
      date: patient.updated_at,
      dotColor: "bg-slate-400",
    });
  }

  for (const apt of appointments) {
    events.push({
      id: `apt-${apt.id}`,
      title: `${apt.type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} appointment`,
      subtitle: `${APT_STATUS_LABELS[apt.status]} · ${new Date(apt.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      date: apt.scheduled_at,
      dotColor:
        apt.status === "completed"
          ? "bg-emerald-500"
          : apt.status === "cancelled"
          ? "bg-red-400"
          : "bg-violet-500",
      href: `/appointments/${apt.id}`,
    });
  }

  for (const rec of records) {
    events.push({
      id: `rec-${rec.id}`,
      title: "Medical record created",
      subtitle: rec.diagnosis ?? rec.chief_complaint,
      date: rec.visit_date,
      dotColor: "bg-teal-500",
      href: `/medical-records/${rec.id}`,
    });

    if (rec.prescriptions.length > 0) {
      events.push({
        id: `rx-${rec.id}`,
        title: `${rec.prescriptions.length} prescription${rec.prescriptions.length > 1 ? "s" : ""} added`,
        subtitle: rec.prescriptions.map((p) => p.medication_name).join(", "),
        date: rec.visit_date,
        dotColor: "bg-violet-500",
        href: `/medical-records/${rec.id}`,
      });
    }
  }

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "overview" | "records" | "prescriptions" | "appointments" | "timeline" | "billing";

interface Props {
  patient: Patient;
}

export function PatientProfileClient({ patient }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [records, setRecords] = useState<MedicalRecordWithRelations[]>([]);
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const fullName = `${patient.first_name} ${patient.last_name}`;

  useEffect(() => {
    Promise.all([
      getPatientMedicalRecords(patient.id),
      getPatientAppointments(patient.id),
      getPatientInvoices(patient.id),
    ]).then(([recs, apts, invs]) => {
      setRecords(recs);
      setAppointments(apts);
      setInvoices(invs);
      setDataLoaded(true);
    });
  }, [patient.id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePatient(patient.id);
      router.push("/patients");
    } catch {
      setDeleting(false);
    }
  };

  type PrescriptionRow = Prescription & { visit_date: string; record_id: string; diagnosis: string | null };

  const allPrescriptions: PrescriptionRow[] = records.flatMap((r) =>
    (r.prescriptions ?? []).map((p) => ({
      ...p,
      visit_date: r.visit_date,
      record_id: r.id,
      diagnosis: r.diagnosis,
    }))
  );

  const totalInvoiced = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.amount_paid, 0);
  const totalBalance = invoices.reduce((s, i) => s + i.balance_due, 0);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "records", label: "Medical records", count: records.length },
    { id: "prescriptions", label: "Prescriptions", count: allPrescriptions.length },
    { id: "appointments", label: "Appointments", count: appointments.length },
    { id: "billing", label: "Billing", count: invoices.length },
    { id: "timeline", label: "Timeline" },
  ];

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/patients"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all mt-0.5 flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </Link>

        <div className="flex-1 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <User size={24} className="text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[18px] font-bold text-slate-900">{fullName}</h1>
                {patient.patient_number && (
                  <span className="text-[12px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {patient.patient_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize border",
                    STATUS_COLORS[patient.status]
                  )}
                >
                  {patient.status}
                </span>
                <span className="text-[12px] text-slate-400">
                  Registered {formatDate(patient.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/patients/${patient.id}/edit`}
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

      {/* Tab navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold",
                    activeTab === id ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-1">
                Personal information
              </h2>
              <div className="mt-1">
                <DetailRow icon={Calendar} label="Date of birth" value={formatDOB(patient.date_of_birth)} />
                <DetailRow
                  icon={User}
                  label="Gender"
                  value={
                    patient.gender
                      ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
                      : null
                  }
                />
                <DetailRow icon={Droplets} label="Blood type" value={patient.blood_type} />
                <DetailRow icon={AlertCircle} label="Allergies" value={patient.allergies} />
                <DetailRow icon={FileText} label="Notes" value={patient.notes} />
              </div>
              {!patient.date_of_birth && !patient.blood_type && !patient.allergies && !patient.notes && (
                <p className="text-[12px] text-slate-400 py-3">No additional medical details on file.</p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-1">
                Contact information
              </h2>
              <div className="mt-1">
                <DetailRow icon={Phone} label="Phone" value={patient.phone} />
                <DetailRow icon={Mail} label="Email" value={patient.email} />
                <DetailRow icon={MapPin} label="Address" value={patient.address} />
              </div>
            </div>

            {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-1">
                  Emergency contact
                </h2>
                <div className="mt-1">
                  <DetailRow icon={UserCheck} label="Name" value={patient.emergency_contact_name} />
                  <DetailRow icon={Phone} label="Phone" value={patient.emergency_contact_phone} />
                </div>
              </div>
            )}
          </div>

          <div className="col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">
                Clinical summary
              </h2>
              <div className="space-y-3">
                {[
                  { icon: FileText, label: "Medical records", value: dataLoaded ? records.length : "—", color: "text-teal-600", bg: "bg-teal-50" },
                  { icon: Pill, label: "Prescriptions", value: dataLoaded ? allPrescriptions.length : "—", color: "text-violet-600", bg: "bg-violet-50" },
                  { icon: CalendarCheck, label: "Appointments", value: dataLoaded ? appointments.length : "—", color: "text-blue-600", bg: "bg-blue-50" },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={14} className={color} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] text-slate-400">{label}</p>
                      <p className="text-[15px] font-bold text-slate-800">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href={`/medical-records/new?patientId=${patient.id}`}
              className="w-full flex items-center justify-center gap-2 h-9 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              <Plus size={13} />
              New medical record
            </Link>
          </div>
        </div>
      )}

      {/* Medical Records tab */}
      {activeTab === "records" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-slate-900">Medical records</h2>
            <Link
              href={`/medical-records/new?patientId=${patient.id}`}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Plus size={12} />
              New record
            </Link>
          </div>

          {!dataLoaded ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">Loading…</div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <FileText size={20} className="text-slate-400" />
              </div>
              <p className="text-[13px] font-semibold text-slate-700">No medical records</p>
              <p className="text-[12px] text-slate-400">Clinical documentation will appear here after a visit.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {records.map((r) => (
                <Link
                  key={r.id}
                  href={`/medical-records/${r.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={15} className="text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">
                        {r.chief_complaint}
                      </p>
                      <RecordStatusBadge status={r.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(r.visit_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {r.doctor && (
                        <span className="text-[11px] text-slate-400">Dr. {r.doctor.last_name}</span>
                      )}
                      {r.diagnosis && (
                        <span className="text-[11px] text-slate-500 truncate">{r.diagnosis}</span>
                      )}
                    </div>
                  </div>
                  {r.prescriptions.length > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-violet-600 bg-violet-50 px-2 py-1 rounded-lg flex-shrink-0">
                      <Pill size={11} />
                      {r.prescriptions.length} Rx
                    </span>
                  )}
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prescriptions tab */}
      {activeTab === "prescriptions" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-[14px] font-bold text-slate-900">Prescriptions</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">All medications prescribed across visits</p>
          </div>

          {!dataLoaded ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">Loading…</div>
          ) : allPrescriptions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Pill size={20} className="text-slate-400" />
              </div>
              <p className="text-[13px] font-semibold text-slate-700">No prescriptions</p>
              <p className="text-[12px] text-slate-400">
                Medications will appear here after a medical record is created.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {allPrescriptions.map((p) => (
                <Link
                  key={p.id}
                  href={`/medical-records/${p.record_id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Pill size={15} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">{p.medication_name}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      {p.dosage} · {p.frequency} · {p.duration}
                    </p>
                    {p.instructions && (
                      <p className="text-[11px] text-slate-400 italic mt-0.5">{p.instructions}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-mono text-slate-400">
                      {new Date(p.visit_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    {p.diagnosis && (
                      <p className="text-[11px] text-slate-400 mt-0.5 max-w-[160px] truncate">
                        {p.diagnosis}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Appointments tab */}
      {activeTab === "appointments" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-slate-900">Appointments</h2>
            <Link
              href={`/appointments/new`}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Plus size={12} />
              Schedule
            </Link>
          </div>

          {!dataLoaded ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">Loading…</div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <CalendarCheck size={20} className="text-slate-400" />
              </div>
              <p className="text-[13px] font-semibold text-slate-700">No appointments</p>
              <p className="text-[12px] text-slate-400">Scheduled visits will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {appointments.map((apt) => {
                const d = new Date(apt.scheduled_at);
                return (
                  <Link
                    key={apt.id}
                    href={`/appointments/${apt.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <CalendarCheck size={15} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-slate-800 capitalize">
                          {apt.type.replace("_", " ")}
                        </p>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                            APT_STATUS_COLORS[apt.status]
                          )}
                        >
                          {APT_STATUS_LABELS[apt.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar size={10} />
                          {d.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={10} />
                          {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        {apt.doctor && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Stethoscope size={10} />
                            Dr. {apt.doctor.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      size={14}
                      className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0"
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Billing tab */}
      {activeTab === "billing" && (
        <div className="space-y-4">
          {/* Balance summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total invoiced", value: dataLoaded ? formatCurrency(totalInvoiced) : "—", color: "text-slate-900" },
              { label: "Total paid", value: dataLoaded ? formatCurrency(totalPaid) : "—", color: "text-emerald-600" },
              { label: "Outstanding balance", value: dataLoaded ? formatCurrency(totalBalance) : "—", color: totalBalance > 0 ? "text-red-600" : "text-slate-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-[11px] text-slate-400 font-medium">{label}</p>
                <p className={`text-[18px] font-bold mt-0.5 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Invoice list */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-slate-900">Invoices</h2>
              <Link
                href={`/finance/invoices/new`}
                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Plus size={12} />
                New invoice
              </Link>
            </div>
            {!dataLoaded ? (
              <div className="px-5 py-8 text-center text-[13px] text-slate-400">Loading…</div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FileText size={20} className="text-slate-400" />
                </div>
                <p className="text-[13px] font-semibold text-slate-700">No invoices</p>
                <p className="text-[12px] text-slate-400">Invoices for this patient will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-50 bg-slate-50/50">
                      {["Invoice #", "Date", "Total", "Paid", "Balance", "Status"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-[0.06em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/finance/invoices/${inv.id}`}
                      >
                        <td className="px-4 py-3">
                          <span className="text-[12px] font-mono font-semibold text-slate-700">{inv.invoice_number ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-slate-500">
                          {new Date(inv.issue_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-semibold text-slate-800">{formatCurrency(inv.total_amount)}</td>
                        <td className="px-4 py-3 text-[13px] text-emerald-600 font-medium">{formatCurrency(inv.amount_paid)}</td>
                        <td className={`px-4 py-3 text-[13px] font-medium ${inv.balance_due > 0 ? "text-red-600" : "text-slate-400"}`}>
                          {formatCurrency(inv.balance_due)}
                        </td>
                        <td className="px-4 py-3">
                          <InvoiceStatusBadge status={inv.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline tab */}
      {activeTab === "timeline" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-5">
            Activity timeline
          </h2>

          {!dataLoaded ? (
            <div className="text-center text-[13px] text-slate-400 py-6">Loading…</div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[7px] top-0 bottom-0 w-[2px] bg-slate-100" />
              {buildTimeline(patient, records, appointments).map((event) => (
                <div key={event.id} className="relative mb-6 last:mb-0">
                  <div
                    className={`absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${event.dotColor}`}
                  />
                  {event.href ? (
                    <Link href={event.href} className="group">
                      <p className="text-[13px] font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                        {event.title}
                      </p>
                      {event.subtitle && (
                        <p className="text-[12px] text-slate-400 mt-0.5 truncate max-w-sm">
                          {event.subtitle}
                        </p>
                      )}
                    </Link>
                  ) : (
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800">{event.title}</p>
                      {event.subtitle && (
                        <p className="text-[12px] text-slate-400 mt-0.5">{event.subtitle}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowDelete(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <p className="text-[14px] font-semibold text-slate-900">Delete patient</p>
            </div>
            <p className="text-[13px] text-slate-600 mb-5">
              This will permanently delete{" "}
              <span className="font-semibold">{fullName}</span> and all their medical records,
              appointments, and prescriptions. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(false)}
                disabled={deleting}
                className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Keep
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-9 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete patient"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
