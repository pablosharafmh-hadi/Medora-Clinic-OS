"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  User,
  Stethoscope,
  Calendar,
  CalendarClock,
  FileText,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteMedicalRecord, updateMedicalRecord } from "@/lib/supabase/medical-records";
import { RecordStatusBadge } from "@/components/medical-records/record-status-badge";
import { PrescriptionList } from "@/components/medical-records/prescription-list";
import type { MedicalRecordWithRelations, MedicalRecordStatus } from "@/lib/types";

function ClinicalSection({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon: React.ElementType;
}) {
  if (!value) return null;
  return (
    <div className="py-4 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className="text-slate-400" />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em]">{label}</p>
      </div>
      <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

interface Props {
  record: MedicalRecordWithRelations;
}

export function RecordDetailClient({ record: initial }: Props) {
  const router = useRouter();
  const [record, setRecord] = useState(initial);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMedicalRecord(record.id);
      router.push("/medical-records");
    } catch {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (status: MedicalRecordStatus) => {
    setUpdatingStatus(true);
    try {
      const updated = await updateMedicalRecord(record.id, { status });
      setRecord((prev) => ({ ...prev, ...updated }));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const patientName = record.patient
    ? `${record.patient.first_name} ${record.patient.last_name}`
    : "Unknown patient";
  const doctorName = record.doctor
    ? `Dr. ${record.doctor.first_name} ${record.doctor.last_name}`
    : "Unknown doctor";
  const visitDate = new Date(record.visit_date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const STATUS_FLOW: { from: MedicalRecordStatus; to: MedicalRecordStatus; label: string; color: string }[] = [
    { from: "draft", to: "final", label: "Finalise record", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    { from: "final", to: "amended", label: "Mark as amended", color: "bg-blue-600 hover:bg-blue-700 text-white" },
    { from: "draft", to: "amended", label: "Mark as amended", color: "bg-blue-600 hover:bg-blue-700 text-white" },
  ];

  const availableActions = STATUS_FLOW.filter((f) => f.from === record.status);

  const hasClinicalContent =
    record.chief_complaint ||
    record.symptoms ||
    record.assessment ||
    record.diagnosis ||
    record.treatment_plan ||
    record.doctor_notes;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/medical-records"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all mt-0.5 flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </Link>

        <div className="flex-1 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[18px] font-bold text-slate-900">{patientName}</h1>
              <RecordStatusBadge status={record.status} />
            </div>
            <p className="text-[13px] text-slate-500 mt-1">{visitDate}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/medical-records/${record.id}/edit`}
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
        {/* Main clinical content — col-span-2 */}
        <div className="col-span-2 space-y-4">
          {/* Clinical documentation */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2">
              Clinical documentation
            </h2>
            {hasClinicalContent ? (
              <div>
                <ClinicalSection icon={FileText} label="Chief complaint" value={record.chief_complaint} />
                <ClinicalSection icon={ClipboardList} label="Symptoms" value={record.symptoms} />
                <ClinicalSection icon={ClipboardList} label="Assessment" value={record.assessment} />
                <ClinicalSection icon={CheckCircle} label="Diagnosis" value={record.diagnosis} />
                <ClinicalSection icon={ClipboardList} label="Treatment plan" value={record.treatment_plan} />
                <ClinicalSection icon={FileText} label="Doctor notes" value={record.doctor_notes} />
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 py-4">No clinical notes documented.</p>
            )}
          </div>

          {/* Prescriptions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-4">
              Prescriptions
            </h2>
            <PrescriptionList
              medicalRecordId={record.id}
              initialPrescriptions={record.prescriptions ?? []}
            />
          </div>
        </div>

        {/* Sidebar — col-span-1 */}
        <div className="col-span-1 space-y-4">
          {/* Status workflow */}
          {availableActions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-3">
                Actions
              </h2>
              <div className="space-y-2">
                {availableActions.map(({ to, label, color }) => (
                  <button
                    key={to}
                    onClick={() => handleStatusChange(to)}
                    disabled={updatingStatus}
                    className={cn(
                      "w-full h-9 text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50",
                      color
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-3">
              Participants
            </h2>
            <div className="space-y-3">
              {record.patient && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-800 truncate">{patientName}</p>
                    {record.patient.patient_number && (
                      <p className="text-[11px] font-mono text-slate-500">{record.patient.patient_number}</p>
                    )}
                  </div>
                  <Link
                    href={`/patients/${record.patient_id}`}
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex-shrink-0"
                  >
                    →
                  </Link>
                </div>
              )}
              {record.doctor && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Stethoscope size={16} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-800 truncate">{doctorName}</p>
                    <p className="text-[11px] text-slate-500">{record.doctor.specialty}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Linked appointment */}
          {record.appointment && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-3">
                Linked appointment
              </h2>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <Link2 size={13} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-slate-700 capitalize">{record.appointment.type.replace("_", " ")}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {new Date(record.appointment.scheduled_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {record.appointment_id && (
                  <Link
                    href={`/appointments/${record.appointment_id}`}
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
                  >
                    →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Follow-up */}
          {record.follow_up_required && (
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock size={14} className="text-amber-600" />
                <h2 className="text-[11px] font-bold text-amber-700 uppercase tracking-[0.08em]">
                  Follow-up required
                </h2>
              </div>
              {record.follow_up_date && (
                <p className="text-[13px] font-semibold text-amber-800">
                  {new Date(record.follow_up_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          )}

          {/* Record timestamps */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-3">Record</h2>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.06em]">Created</p>
                <p className="text-[12px] text-slate-700 mt-0.5">
                  {new Date(record.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.06em]">Last updated</p>
                <p className="text-[12px] text-slate-700 mt-0.5">
                  {new Date(record.updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              <p className="text-[14px] font-semibold text-slate-900">Delete medical record</p>
            </div>
            <p className="text-[13px] text-slate-600 mb-5">
              This will permanently delete the record for{" "}
              <span className="font-semibold">{patientName}</span> on {visitDate}, including all
              linked prescriptions. This action cannot be undone.
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
                {deleting ? "Deleting…" : "Delete record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
