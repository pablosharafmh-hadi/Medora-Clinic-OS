"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ChevronDown, CalendarClock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { getAppointment } from "@/lib/supabase/appointments";
import { getAllDoctors } from "@/lib/supabase/doctors";
import type {
  MedicalRecordInsert,
  MedicalRecordUpdate,
  MedicalRecordWithRelations,
  Doctor,
  Patient,
  AppointmentWithRelations,
} from "@/lib/types";

// ─── Patient combobox ─────────────────────────────────────────────────────────

function PatientCombobox({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string, name: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const term = `%${q.trim()}%`;
    supabase
      .from("patients")
      .select("id, first_name, last_name, patient_number, status")
      .or(`first_name.ilike.${term},last_name.ilike.${term},patient_number.ilike.${term}`)
      .eq("status", "active")
      .limit(8)
      .then(({ data }) => setResults((data ?? []) as unknown as Patient[]));
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    setDisplayName(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 300);
    setOpen(true);
  };

  const select = (p: Patient) => {
    const name = `${p.first_name} ${p.last_name}`;
    setDisplayName(name);
    setQuery(name);
    setOpen(false);
    setResults([]);
    onChange(p.id, name);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={displayName || query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (query) setOpen(true); }}
          placeholder="Search patient by name or ID…"
          disabled={disabled}
          className="w-full pl-9 pr-4 h-9 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-800">
                  {p.first_name} {p.last_name}
                </p>
                {p.patient_number && (
                  <p className="text-[11px] font-mono text-slate-400">{p.patient_number}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface Props {
  record?: MedicalRecordWithRelations;
  onSubmit: (data: MedicalRecordInsert | MedicalRecordUpdate) => Promise<void>;
  onCancel: () => void;
}

const today = new Date().toISOString().split("T")[0];

export function MedicalRecordForm({ record, onSubmit, onCancel }: Props) {
  const searchParams = useSearchParams();
  const appointmentIdParam = searchParams.get("appointmentId");
  const patientIdParam = searchParams.get("patientId");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field state
  const [patientId, setPatientId] = useState(record?.patient_id ?? "");
  const [patientName, setPatientName] = useState(
    record?.patient ? `${record.patient.first_name} ${record.patient.last_name}` : ""
  );
  const [doctorId, setDoctorId] = useState(record?.doctor_id ?? "");
  const [appointmentId, setAppointmentId] = useState(record?.appointment_id ?? "");
  const [visitDate, setVisitDate] = useState(record?.visit_date ?? today);
  const [chiefComplaint, setChiefComplaint] = useState(record?.chief_complaint ?? "");
  const [symptoms, setSymptoms] = useState(record?.symptoms ?? "");
  const [assessment, setAssessment] = useState(record?.assessment ?? "");
  const [diagnosis, setDiagnosis] = useState(record?.diagnosis ?? "");
  const [treatmentPlan, setTreatmentPlan] = useState(record?.treatment_plan ?? "");
  const [doctorNotes, setDoctorNotes] = useState(record?.doctor_notes ?? "");
  const [followUpRequired, setFollowUpRequired] = useState(record?.follow_up_required ?? false);
  const [followUpDate, setFollowUpDate] = useState(record?.follow_up_date ?? "");
  const [status, setStatus] = useState<"draft" | "final" | "amended">(record?.status ?? "draft");

  // When linked to an appointment via URL param, lock patient + doctor + date
  const [lockedFromAppointment, setLockedFromAppointment] = useState(false);

  useEffect(() => {
    getAllDoctors().then(setDoctors).finally(() => setLoadingDoctors(false));
  }, []);

  // Pre-fill from appointmentId URL param
  useEffect(() => {
    if (!appointmentIdParam || record) return;
    getAppointment(appointmentIdParam).then((apt) => {
      if (!apt) return;
      setAppointmentId(apt.id);
      setPatientId(apt.patient_id);
      setDoctorId(apt.doctor_id);
      setVisitDate(apt.scheduled_at.split("T")[0]);
      if (apt.patient) {
        setPatientName(`${apt.patient.first_name} ${apt.patient.last_name}`);
      }
      setLockedFromAppointment(true);
    });
  }, [appointmentIdParam, record]);

  // Pre-fill patient from URL param (without appointment)
  useEffect(() => {
    if (!patientIdParam || appointmentIdParam || record) return;
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("id", patientIdParam)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const p = data as unknown as Patient;
        setPatientId(p.id);
        setPatientName(`${p.first_name} ${p.last_name}`);
      });
  }, [patientIdParam, appointmentIdParam, record]);

  // When patient changes, load their appointments for the appointment selector
  useEffect(() => {
    if (!patientId) { setPatientAppointments([]); return; }
    supabase
      .from("appointments")
      .select("*, patient:patients(first_name, last_name, patient_number), doctor:doctors(first_name, last_name, specialty)")
      .eq("patient_id", patientId)
      .order("scheduled_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setPatientAppointments((data ?? []) as unknown as AppointmentWithRelations[]);
      });
  }, [patientId]);

  const handlePatientSelect = (id: string, name: string) => {
    setPatientId(id);
    setPatientName(name);
    setAppointmentId(""); // reset appointment when patient changes
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) { setError("Please select a patient."); return; }
    if (!doctorId) { setError("Please select a doctor."); return; }
    if (!visitDate) { setError("Visit date is required."); return; }
    if (!chiefComplaint.trim()) { setError("Chief complaint is required."); return; }

    setSubmitting(true);
    setError(null);

    const data: MedicalRecordInsert = {
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_id: appointmentId || null,
      visit_date: visitDate,
      chief_complaint: chiefComplaint.trim(),
      symptoms: symptoms.trim() || null,
      assessment: assessment.trim() || null,
      diagnosis: diagnosis.trim() || null,
      treatment_plan: treatmentPlan.trim() || null,
      doctor_notes: doctorNotes.trim() || null,
      follow_up_required: followUpRequired,
      follow_up_date: followUpRequired && followUpDate ? followUpDate : null,
      status,
    };

    try {
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full h-9 px-3 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors disabled:bg-slate-50 disabled:text-slate-500";
  const textareaClass =
    "w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors resize-none";
  const labelClass = "block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em] mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Visit information */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-3">
          Visit information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>Patient *</label>
            <PatientCombobox
              value={patientId}
              onChange={handlePatientSelect}
              disabled={lockedFromAppointment || !!record}
            />
            {patientName && !lockedFromAppointment && !record && (
              <p className="text-[11px] text-emerald-600 mt-1">Selected: {patientName}</p>
            )}
            {lockedFromAppointment && patientName && (
              <p className="text-[11px] text-slate-500 mt-1">Linked from appointment · {patientName}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Doctor *</label>
            <div className="relative">
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                disabled={loadingDoctors || lockedFromAppointment}
                className={`${inputClass} pr-8 appearance-none`}
              >
                <option value="">Select doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name} — {d.specialty}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Visit date *</label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              disabled={lockedFromAppointment}
              className={inputClass}
            />
          </div>

          {patientId && (
            <div className="col-span-2">
              <label className={labelClass}>Linked appointment (optional)</label>
              <div className="relative">
                <select
                  value={appointmentId}
                  onChange={(e) => setAppointmentId(e.target.value)}
                  disabled={lockedFromAppointment}
                  className={`${inputClass} pr-8 appearance-none`}
                >
                  <option value="">No linked appointment</option>
                  {patientAppointments.map((apt) => {
                    const d = new Date(apt.scheduled_at);
                    const label = `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${apt.type.replace("_", " ")} · ${apt.status}`;
                    return (
                      <option key={apt.id} value={apt.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* Clinical documentation */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-3">
          Clinical documentation
        </h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Chief complaint *</label>
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Primary reason for today's visit…"
              rows={2}
              className={textareaClass}
            />
          </div>

          <div>
            <label className={labelClass}>Symptoms</label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Describe symptoms reported by the patient…"
              rows={3}
              className={textareaClass}
            />
          </div>

          <div>
            <label className={labelClass}>Assessment</label>
            <textarea
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              placeholder="Clinical assessment and physical examination findings…"
              rows={3}
              className={textareaClass}
            />
          </div>

          <div>
            <label className={labelClass}>Diagnosis</label>
            <textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Confirmed or working diagnosis (ICD codes recommended)…"
              rows={2}
              className={textareaClass}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* Treatment */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-3">
          Treatment & notes
        </h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Treatment plan</label>
            <textarea
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
              placeholder="Prescribed treatment, procedures, referrals…"
              rows={3}
              className={textareaClass}
            />
          </div>

          <div>
            <label className={labelClass}>Doctor notes</label>
            <textarea
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              placeholder="Internal clinical notes (not shared with patient)…"
              rows={3}
              className={textareaClass}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* Follow-up & status */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-3">
          Follow-up & status
        </h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setFollowUpRequired((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                followUpRequired ? "bg-blue-600" : "bg-slate-200"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  followUpRequired ? "translate-x-5" : ""
                }`}
              />
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock size={14} className="text-slate-500" />
              <span className="text-[13px] font-medium text-slate-700">Follow-up required</span>
            </div>
          </label>

          {followUpRequired && (
            <div>
              <label className={labelClass}>Follow-up date</label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={today}
                className={`${inputClass} max-w-[200px]`}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Record status</label>
            <div className="flex items-center gap-2">
              {(["draft", "final", "amended"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 h-8 text-[12px] font-semibold rounded-lg border transition-colors ${
                    status === s
                      ? s === "draft"
                        ? "bg-amber-50 text-amber-700 border-amber-300"
                        : s === "final"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-blue-50 text-blue-700 border-blue-300"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {status === "draft"
                ? "Draft records can be edited freely."
                : status === "final"
                ? "Final records are locked. Use 'Amended' to make corrections."
                : "Amended records indicate a correction was made to a final record."}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-9 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60"
        >
          {submitting
            ? record
              ? "Saving…"
              : "Creating record…"
            : record
            ? "Save changes"
            : "Create medical record"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 h-9 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
