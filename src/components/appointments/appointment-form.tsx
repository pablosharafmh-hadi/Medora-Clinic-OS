"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ChevronDown,
  Clock,
  AlertCircle,
  Check,
  Receipt,
  User,
  Phone,
  Mail,
  Stethoscope,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveDoctors } from "@/lib/supabase/doctors";
import { getPatient, getPatients } from "@/lib/supabase/patients";
import { getDoctorSchedule, getPatientAppointments } from "@/lib/supabase/appointments";
import { getActiveServices } from "@/lib/supabase/services";
import type {
  Doctor,
  Patient,
  Service,
  Appointment,
  AppointmentInsert,
  AppointmentUpdate,
  AppointmentType,
  AppointmentStatus,
  AppointmentWithRelations,
} from "@/lib/types";

// ─── Time slots ───────────────────────────────────────────────────────────────

const TIME_SLOTS: string[] = [];
for (let h = 8; h < 18; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_SLOTS.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
}

function formatSlot(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function isSlotConflict(
  slot: string,
  date: string,
  durationMins: number,
  existingApts: Pick<Appointment, "id" | "scheduled_at" | "duration_minutes" | "status">[],
  excludeId?: string
): boolean {
  const newStart = new Date(`${date}T${slot}`).getTime();
  const newEnd = newStart + durationMins * 60000;
  return existingApts.some((apt) => {
    if (excludeId && apt.id === excludeId) return false;
    const existStart = new Date(apt.scheduled_at).getTime();
    const existEnd = existStart + apt.duration_minutes * 60000;
    return newStart < existEnd && newEnd > existStart;
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TYPE_LABELS: Record<AppointmentType, string> = {
  consultation: "Consultation",
  follow_up: "Follow-Up",
  procedure: "Procedure",
  check_up: "Check-Up",
  emergency: "Emergency Visit",
  custom: "Custom",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  durationMinutes: number;
  type: AppointmentType | "";
  customTypeLabel: string;
  status: AppointmentStatus;
  notes: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

function toFormData(apt?: AppointmentWithRelations): FormData {
  if (!apt) {
    return {
      patientId: "",
      doctorId: "",
      date: new Date().toISOString().slice(0, 10),
      time: "",
      durationMinutes: 30,
      type: "",
      customTypeLabel: "",
      status: "scheduled",
      notes: "",
      serviceId: "",
      serviceName: "",
      servicePrice: 0,
    };
  }
  const d = new Date(apt.scheduled_at);
  return {
    patientId: apt.patient_id,
    doctorId: apt.doctor_id,
    date: d.toISOString().slice(0, 10),
    time: `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`,
    durationMinutes: apt.duration_minutes,
    type: apt.type,
    customTypeLabel: apt.custom_type_label ?? "",
    status: apt.status,
    notes: apt.notes ?? "",
    serviceId: apt.service_id ?? "",
    serviceName: apt.service_name ?? "",
    servicePrice: apt.service_price ?? 0,
  };
}

function validate(form: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.patientId) errors.patientId = "Please select a patient";
  if (!form.doctorId) errors.doctorId = "Please select a doctor";
  if (!form.date) errors.date = "Please choose a date";
  if (!form.time) errors.time = "Please choose a time slot";
  if (!form.type) errors.type = "Please select an appointment type";
  if (form.type === "custom" && !form.customTypeLabel.trim()) {
    errors.customTypeLabel = "Please enter a custom type label";
  }
  if (!form.serviceId) errors.serviceId = "Please select a billable service";
  return errors;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputClass = (error?: string) =>
  cn(
    "w-full h-9 px-3 text-[13px] text-slate-800 bg-white border rounded-lg outline-none transition-colors",
    "placeholder:text-slate-400",
    error
      ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
      : "border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
  );

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">
      {children}
    </h3>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] text-slate-400 flex-shrink-0">{label}</span>
      <span
        className={cn(
          "text-[12px] font-medium text-right ml-2 truncate max-w-[58%]",
          value ? "text-slate-700" : "text-slate-300"
        )}
        title={value ?? undefined}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

// Patient combobox
function PatientCombobox({
  value,
  displayName,
  onChange,
  error,
}: {
  value: string;
  displayName: string;
  onChange: (id: string, name: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState(displayName);
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(displayName); }, [displayName]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.length < 1) { setResults([]); return; }
      setLoading(true);
      try {
        const res = await getPatients({ search: query, pageSize: 8 });
        setResults(res.data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          className={cn(inputClass(error), "pl-8")}
          placeholder="Search patients by name or number…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange("", "");
          }}
        />
        {value && (
          <Check size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
        )}
      </div>
      {open && query.length > 0 && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/60 max-h-48 overflow-y-auto py-1">
          {loading ? (
            <div className="px-3 py-2 text-[12px] text-slate-400">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-slate-400">No patients found</div>
          ) : results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-blue-50 transition-colors"
              onClick={() => {
                const name = `${p.first_name} ${p.last_name}`;
                onChange(p.id, name);
                setQuery(name);
                setOpen(false);
              }}
            >
              <span className="font-medium text-slate-800">{p.first_name} {p.last_name}</span>
              {p.patient_number && (
                <span className="ml-2 text-[11px] text-slate-400 font-mono">{p.patient_number}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Time slot picker
function TimeSlotPicker({
  date,
  doctorId,
  duration,
  value,
  onChange,
  excludeId,
  error,
}: {
  date: string;
  doctorId: string;
  duration: number;
  value: string;
  onChange: (slot: string) => void;
  excludeId?: string;
  error?: string;
}) {
  const [existingApts, setExistingApts] = useState<Pick<Appointment, "id" | "scheduled_at" | "duration_minutes" | "status">[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doctorId || !date) { setExistingApts([]); return; }
    setLoading(true);
    getDoctorSchedule(doctorId, date)
      .then(setExistingApts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [doctorId, date]);

  if (!doctorId || !date) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center text-[12px] text-slate-400">
        Select a doctor and date to see available slots
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {TIME_SLOTS.map((slot) => {
          const conflict = isSlotConflict(slot, date, duration, existingApts, excludeId);
          const selected = value === slot;
          return (
            <button
              key={slot}
              type="button"
              disabled={conflict}
              onClick={() => !conflict && onChange(slot)}
              className={cn(
                "h-8 rounded-lg text-[11px] font-medium transition-all",
                selected
                  ? "bg-blue-600 text-white shadow-sm"
                  : conflict
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed line-through"
                    : "bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600"
              )}
            >
              {formatSlot(slot)}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[11px] text-red-500">{error}</p>}
      {existingApts.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <AlertCircle size={11} />
          {existingApts.length} appointment{existingApts.length !== 1 ? "s" : ""} already booked for this doctor today.
        </p>
      )}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface AppointmentFormProps {
  appointment?: AppointmentWithRelations;
  onSubmit: (data: AppointmentInsert | AppointmentUpdate) => Promise<void>;
  onCancel?: () => void;
}

export function AppointmentForm({ appointment, onSubmit, onCancel }: AppointmentFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState<FormData>(() => {
    const base = toFormData(appointment);
    if (!appointment) {
      const date = searchParams.get("date");
      const time = searchParams.get("time");
      const doctorId = searchParams.get("doctorId");
      if (date) base.date = date;
      if (time) base.time = time;
      if (doctorId) base.doctorId = doctorId;
    }
    return base;
  });

  const [patientDisplayName, setPatientDisplayName] = useState(
    appointment?.patient
      ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
      : ""
  );
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Right panel state
  const [patientDetails, setPatientDetails] = useState<Patient | null>(null);
  const [patientAptCount, setPatientAptCount] = useState<number | null>(null);
  const [patientLastVisit, setPatientLastVisit] = useState<string | null>(null);
  const [doctorTodayCount, setDoctorTodayCount] = useState<number | null>(null);

  useEffect(() => {
    getActiveDoctors().then(setDoctors).catch(console.error);
    getActiveServices().then(setServices).catch(console.error);
  }, []);

  useEffect(() => {
    if (!form.patientId) {
      setPatientDetails(null);
      setPatientAptCount(null);
      setPatientLastVisit(null);
      return;
    }
    Promise.all([
      getPatient(form.patientId),
      getPatientAppointments(form.patientId),
    ]).then(([patient, apts]) => {
      setPatientDetails(patient);
      setPatientAptCount(apts.length);
      const completed = apts.filter((a) => a.status === "completed");
      setPatientLastVisit(completed.length > 0 ? completed[0].scheduled_at : null);
    }).catch(console.error);
  }, [form.patientId]);

  useEffect(() => {
    if (!form.doctorId) {
      setDoctorTodayCount(null);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    getDoctorSchedule(form.doctorId, today)
      .then((apts) => setDoctorTodayCount(apts.length))
      .catch(console.error);
  }, [form.doctorId]);

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const v = field === "durationMinutes" ? Number(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [field]: v }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleServiceChange = (serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (svc) {
      setForm((p) => ({ ...p, serviceId: svc.id, serviceName: svc.service_name, servicePrice: svc.price }));
    } else {
      setForm((p) => ({ ...p, serviceId: "", serviceName: "", servicePrice: 0 }));
    }
    if (errors.serviceId) setErrors((p) => ({ ...p, serviceId: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    setServerError(null);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
      const payload: AppointmentInsert = {
        patient_id: form.patientId,
        doctor_id: form.doctorId,
        scheduled_at: scheduledAt,
        duration_minutes: form.durationMinutes,
        type: form.type as AppointmentType,
        custom_type_label: form.type === "custom" ? form.customTypeLabel.trim() : null,
        status: form.status,
        notes: form.notes.trim() || null,
        service_id: form.serviceId || null,
        service_name: form.serviceName || null,
        service_price: form.servicePrice || null,
      };
      await onSubmit(payload);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else router.back();
  };

  // Derived values for the right panel
  const selectedDoctor = doctors.find((d) => d.id === form.doctorId);
  const selectedService = services.find((s) => s.id === form.serviceId);
  const availableSlots =
    doctorTodayCount !== null ? Math.max(0, TIME_SLOTS.length - doctorTodayCount) : null;
  const typeLabel = form.type
    ? form.type === "custom"
      ? form.customTypeLabel || "Custom"
      : TYPE_LABELS[form.type as AppointmentType]
    : null;
  const durationLabel =
    form.durationMinutes < 60
      ? `${form.durationMinutes} min`
      : form.durationMinutes === 60
      ? "1 hr"
      : `${form.durationMinutes / 60} hrs`;

  // ─── Form field sections (shared between new and edit layouts) ───────────────

  const formFields = (
    <>
      {serverError && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          {serverError}
        </div>
      )}

      {/* Participants */}
      <div>
        <SectionLabel>Participants</SectionLabel>
        <div className="space-y-4">
          <Field label="Patient" required error={errors.patientId}>
            <PatientCombobox
              value={form.patientId}
              displayName={patientDisplayName}
              onChange={(id, name) => {
                setForm((p) => ({ ...p, patientId: id }));
                setPatientDisplayName(name);
                if (errors.patientId) setErrors((p) => ({ ...p, patientId: undefined }));
              }}
              error={errors.patientId}
            />
          </Field>

          <Field label="Doctor" required error={errors.doctorId}>
            <div className="relative">
              <select
                className={cn(inputClass(errors.doctorId), "appearance-none cursor-pointer")}
                value={form.doctorId}
                onChange={(e) => {
                  setForm((p) => ({ ...p, doctorId: e.target.value, time: "" }));
                  if (errors.doctorId) setErrors((p) => ({ ...p, doctorId: undefined }));
                }}
              >
                <option value="">Select a doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name} — {d.specialty}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {doctors.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-600">
                No active doctors found. <a href="/doctors" className="underline">Add a doctor first.</a>
              </p>
            )}
          </Field>
        </div>
      </div>

      {/* Appointment details */}
      <div>
        <SectionLabel>Appointment details</SectionLabel>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Field label="Date" required error={errors.date}>
            <input
              type="date"
              className={inputClass(errors.date)}
              value={form.date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setForm((p) => ({ ...p, date: e.target.value, time: "" }));
                if (errors.date) setErrors((p) => ({ ...p, date: undefined }));
              }}
            />
          </Field>

          <Field label="Duration" required>
            <div className="relative">
              <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                className={cn(inputClass(), "pl-8 appearance-none cursor-pointer")}
                value={form.durationMinutes}
                onChange={(e) => {
                  setForm((p) => ({ ...p, durationMinutes: Number(e.target.value), time: "" }));
                }}
              >
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}`}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </Field>

          <Field label="Type" required error={errors.type}>
            <div className="relative">
              <select
                className={cn(inputClass(errors.type), "appearance-none cursor-pointer")}
                value={form.type}
                onChange={set("type")}
              >
                <option value="">Select type…</option>
                <option value="consultation">Consultation</option>
                <option value="follow_up">Follow-Up</option>
                <option value="procedure">Procedure</option>
                <option value="check_up">Check-Up</option>
                <option value="emergency">Emergency Visit</option>
                <option value="custom">Custom</option>
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </Field>
        </div>

        {form.type === "custom" && (
          <div className="mb-4">
            <Field label="Custom type label" required error={errors.customTypeLabel}>
              <input
                type="text"
                className={inputClass(errors.customTypeLabel)}
                value={form.customTypeLabel}
                onChange={set("customTypeLabel")}
                placeholder="e.g. Allergy testing, Vaccination, Pre-op assessment"
              />
            </Field>
          </div>
        )}

        <Field label="Available time slots" required error={errors.time}>
          <TimeSlotPicker
            date={form.date}
            doctorId={form.doctorId}
            duration={form.durationMinutes}
            value={form.time}
            onChange={(slot) => {
              setForm((p) => ({ ...p, time: slot }));
              if (errors.time) setErrors((p) => ({ ...p, time: undefined }));
            }}
            excludeId={appointment?.id}
            error={errors.time}
          />
        </Field>
      </div>

      {/* Billing */}
      <div>
        <SectionLabel>Billing</SectionLabel>
        <Field label="Billable service" required error={errors.serviceId}>
          <div className="relative">
            <select
              className={cn(inputClass(errors.serviceId), "appearance-none cursor-pointer")}
              value={form.serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
            >
              <option value="">Select a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.service_name} — ${s.price.toFixed(2)}
                  {s.category ? ` · ${s.category}` : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {services.length === 0 && (
            <p className="mt-1 text-[11px] text-amber-600">
              No active services found. <a href="/finance/services" className="underline">Add services first.</a>
            </p>
          )}
          {form.servicePrice > 0 && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
              <Receipt size={13} className="text-emerald-600 flex-shrink-0" />
              <p className="text-[12px] text-emerald-700">
                <span className="font-semibold">${form.servicePrice.toFixed(2)}</span> will be invoiced automatically when this visit is completed.
              </p>
            </div>
          )}
        </Field>
      </div>

      {/* Additional information */}
      <div>
        <SectionLabel>Additional information</SectionLabel>
        <div className="space-y-4">
          {appointment && (
            <Field label="Status">
              <div className="relative">
                <select
                  className={cn(inputClass(), "appearance-none cursor-pointer")}
                  value={form.status}
                  onChange={set("status")}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked In</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </Field>
          )}

          <Field label="Notes">
            <textarea
              className={cn(inputClass(), "h-auto py-2 resize-none")}
              rows={3}
              value={form.notes}
              onChange={set("notes")}
              placeholder="Any special instructions, symptoms, or context for this visit…"
            />
          </Field>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={handleCancel}
          disabled={submitting}
          className="h-9 px-4 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="h-9 px-5 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting
            ? appointment ? "Saving…" : "Scheduling…"
            : appointment ? "Save changes" : "Schedule appointment"
          }
        </button>
      </div>
    </>
  );

  // ─── Edit mode: single column (edit page provides its own card wrapper) ───────

  if (appointment) {
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {formFields}
      </form>
    );
  }

  // ─── New appointment mode: two-column layout with contextual info panel ───────

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-6 items-start">

      {/* Left column: form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {formFields}
        </form>
      </div>

      {/* Right column: contextual info panel */}
      <div className="space-y-3 lg:sticky lg:top-6">

        {/* Patient Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <User size={12} className="text-blue-600" />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Patient</span>
          </div>
          {form.patientId ? (
            <div>
              <div className="mb-3 pb-3 border-b border-slate-50">
                <p className="text-[14px] font-semibold text-slate-900 leading-tight">{patientDisplayName}</p>
                {patientDetails?.patient_number && (
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">{patientDetails.patient_number}</p>
                )}
              </div>
              <div className="space-y-0">
                <InfoRow label="Phone" value={patientDetails?.phone ?? null} />
                <InfoRow label="Email" value={patientDetails?.email ?? null} />
                <InfoRow
                  label="Last visit"
                  value={patientLastVisit ? formatDate(patientLastVisit) : patientAptCount !== null ? "No completed visits" : null}
                />
                <InfoRow
                  label="Total visits"
                  value={patientAptCount !== null ? String(patientAptCount) : null}
                />
                <InfoRow label="Balance" value="—" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2">
              <Phone size={12} className="text-slate-300" />
              <Mail size={12} className="text-slate-300" />
              <p className="text-[12px] text-slate-300">Select a patient to view details</p>
            </div>
          )}
        </div>

        {/* Doctor Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Stethoscope size={12} className="text-emerald-600" />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Doctor</span>
          </div>
          {selectedDoctor ? (
            <div>
              <div className="mb-3 pb-3 border-b border-slate-50">
                <p className="text-[14px] font-semibold text-slate-900 leading-tight">
                  Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}
                </p>
                <p className="text-[12px] text-slate-500 mt-0.5">{selectedDoctor.specialty}</p>
              </div>
              <InfoRow
                label="Status"
                value={
                  selectedDoctor.status === "active"
                    ? "Active"
                    : selectedDoctor.status === "on_leave"
                    ? "On Leave"
                    : "Inactive"
                }
              />
              <InfoRow
                label="Today's appointments"
                value={doctorTodayCount !== null ? String(doctorTodayCount) : null}
              />
              <InfoRow
                label="Available slots today"
                value={availableSlots !== null ? String(availableSlots) : null}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2">
              <Stethoscope size={12} className="text-slate-300" />
              <p className="text-[12px] text-slate-300">Select a doctor to view details</p>
            </div>
          )}
        </div>

        {/* Appointment Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
              <CalendarDays size={12} className="text-violet-600" />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Appointment Summary</span>
          </div>
          <InfoRow label="Patient" value={patientDisplayName || null} />
          <InfoRow
            label="Doctor"
            value={
              selectedDoctor
                ? `Dr. ${selectedDoctor.first_name} ${selectedDoctor.last_name}`
                : null
            }
          />
          <InfoRow label="Type" value={typeLabel} />
          <InfoRow
            label="Date"
            value={
              form.date
                ? new Date(form.date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                : null
            }
          />
          <InfoRow label="Time" value={form.time ? formatSlot(form.time) : null} />
          <InfoRow label="Duration" value={durationLabel} />
        </div>

        {/* Billing Preview */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Receipt size={12} className="text-amber-600" />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Billing</span>
          </div>
          {form.serviceId ? (
            <div>
              <div className="mb-3 pb-3 border-b border-slate-50">
                <p className="text-[13px] font-semibold text-slate-900 leading-tight">{form.serviceName}</p>
                {selectedService?.category && (
                  <p className="text-[11px] text-slate-400 mt-0.5">{selectedService.category}</p>
                )}
              </div>
              <InfoRow
                label="Amount"
                value={form.servicePrice > 0 ? `$${form.servicePrice.toFixed(2)}` : null}
              />
              <InfoRow label="Invoice" value="Auto on completion" />
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2">
              <Receipt size={12} className="text-slate-300" />
              <p className="text-[12px] text-slate-300">Select a service to preview billing</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
