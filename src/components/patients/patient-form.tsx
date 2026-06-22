"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Patient, PatientInsert, PatientUpdate, Gender, BloodType, PatientStatus } from "@/lib/types";

interface PatientFormProps {
  patient?: Patient;
  onSubmit: (data: PatientInsert | PatientUpdate) => Promise<void>;
  onCancel?: () => void;
}

type FormData = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: Gender | "";
  phone: string;
  email: string;
  address: string;
  blood_type: BloodType | "";
  emergency_contact_name: string;
  emergency_contact_phone: string;
  allergies: string;
  notes: string;
  status: PatientStatus;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

function toFormData(patient?: Patient): FormData {
  return {
    first_name: patient?.first_name ?? "",
    last_name: patient?.last_name ?? "",
    date_of_birth: patient?.date_of_birth ?? "",
    gender: patient?.gender ?? "",
    phone: patient?.phone ?? "",
    email: patient?.email ?? "",
    address: patient?.address ?? "",
    blood_type: patient?.blood_type ?? "",
    emergency_contact_name: patient?.emergency_contact_name ?? "",
    emergency_contact_phone: patient?.emergency_contact_phone ?? "",
    allergies: patient?.allergies ?? "",
    notes: patient?.notes ?? "",
    status: patient?.status ?? "active",
  };
}

function validate(form: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.first_name.trim()) errors.first_name = "First name is required";
  if (!form.last_name.trim()) errors.last_name = "Last name is required";
  if (!form.gender) errors.gender = "Gender is required";
  if (!form.phone.trim()) errors.phone = "Phone number is required";
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = "Enter a valid email address";
  }
  return errors;
}

function toPayload(form: FormData): PatientInsert {
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    date_of_birth: form.date_of_birth || null,
    gender: form.gender as Gender,
    phone: form.phone.trim(),
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    blood_type: (form.blood_type as BloodType) || null,
    emergency_contact_name: form.emergency_contact_name.trim() || null,
    emergency_contact_phone: form.emergency_contact_phone.trim() || null,
    allergies: form.allergies.trim() || null,
    notes: form.notes.trim() || null,
    status: form.status,
  };
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, required, error, children }: FieldProps) {
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

const inputClass = (error?: string) =>
  cn(
    "w-full h-9 px-3 text-[13px] text-slate-800 bg-white border rounded-lg outline-none transition-colors",
    "placeholder:text-slate-400",
    error
      ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
      : "border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
  );

const selectClass = (error?: string) =>
  cn(inputClass(error), "appearance-none cursor-pointer");

export function PatientForm({ patient, onSubmit, onCancel }: PatientFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(toFormData(patient));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(toPayload(form));
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
          {serverError}
        </div>
      )}

      {/* Personal Information */}
      <div>
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">
          Personal information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" required error={errors.first_name}>
            <input
              type="text"
              className={inputClass(errors.first_name)}
              value={form.first_name}
              onChange={set("first_name")}
              placeholder="John"
              autoComplete="given-name"
            />
          </Field>

          <Field label="Last name" required error={errors.last_name}>
            <input
              type="text"
              className={inputClass(errors.last_name)}
              value={form.last_name}
              onChange={set("last_name")}
              placeholder="Smith"
              autoComplete="family-name"
            />
          </Field>

          <Field label="Date of birth" error={errors.date_of_birth}>
            <input
              type="date"
              className={inputClass(errors.date_of_birth)}
              value={form.date_of_birth}
              onChange={set("date_of_birth")}
            />
          </Field>

          <Field label="Gender" required error={errors.gender}>
            <select
              className={selectClass(errors.gender)}
              value={form.gender}
              onChange={set("gender")}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Blood type" error={errors.blood_type}>
            <select
              className={selectClass(errors.blood_type)}
              value={form.blood_type}
              onChange={set("blood_type")}
            >
              <option value="">Unknown</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field label="Status" required error={errors.status}>
            <select
              className={selectClass(errors.status)}
              value={form.status}
              onChange={set("status")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deceased">Deceased</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Contact Information */}
      <div>
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">
          Contact information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone number" required error={errors.phone}>
            <input
              type="tel"
              className={inputClass(errors.phone)}
              value={form.phone}
              onChange={set("phone")}
              placeholder="+1 (555) 000-0000"
              autoComplete="tel"
            />
          </Field>

          <Field label="Email address" error={errors.email}>
            <input
              type="email"
              className={inputClass(errors.email)}
              value={form.email}
              onChange={set("email")}
              placeholder="john@example.com"
              autoComplete="email"
            />
          </Field>

          <div className="col-span-2">
            <Field label="Address" error={errors.address}>
              <input
                type="text"
                className={inputClass(errors.address)}
                value={form.address}
                onChange={set("address")}
                placeholder="123 Main St, City, State 12345"
                autoComplete="street-address"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div>
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">
          Emergency contact
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact name" error={errors.emergency_contact_name}>
            <input
              type="text"
              className={inputClass(errors.emergency_contact_name)}
              value={form.emergency_contact_name}
              onChange={set("emergency_contact_name")}
              placeholder="Jane Smith"
            />
          </Field>

          <Field label="Contact phone" error={errors.emergency_contact_phone}>
            <input
              type="tel"
              className={inputClass(errors.emergency_contact_phone)}
              value={form.emergency_contact_phone}
              onChange={set("emergency_contact_phone")}
              placeholder="+1 (555) 000-0000"
            />
          </Field>
        </div>
      </div>

      {/* Medical Notes */}
      <div>
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">
          Medical notes
        </h3>
        <div className="space-y-4">
          <Field label="Allergies" error={errors.allergies}>
            <input
              type="text"
              className={inputClass(errors.allergies)}
              value={form.allergies}
              onChange={set("allergies")}
              placeholder="e.g. Penicillin, Latex, Peanuts"
            />
          </Field>

          <Field label="Notes" error={errors.notes}>
            <textarea
              className={cn(
                inputClass(errors.notes),
                "h-auto py-2 resize-none"
              )}
              rows={3}
              value={form.notes}
              onChange={set("notes")}
              placeholder="Any additional medical notes or context..."
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
            ? patient ? "Saving…" : "Adding patient…"
            : patient ? "Save changes" : "Add patient"
          }
        </button>
      </div>
    </form>
  );
}
