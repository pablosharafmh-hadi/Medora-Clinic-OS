"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Plus,
  Stethoscope,
  UserCheck,
  UserX,
  Clock,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAllDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  generateLicenseNumber,
} from "@/lib/supabase/doctors";
import type { Doctor } from "@/lib/types";
import type { DoctorInsert } from "@/lib/supabase/doctors";

const STATUS_COLORS: Record<Doctor["status"], string> = {
  active: "bg-emerald-50 text-emerald-700",
  on_leave: "bg-amber-50 text-amber-700",
  inactive: "bg-slate-100 text-slate-500",
};

const STATUS_LABELS: Record<Doctor["status"], string> = {
  active: "Active",
  on_leave: "On leave",
  inactive: "Inactive",
};

function StatusBadge({ status }: { status: Doctor["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium",
        STATUS_COLORS[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${40 + i * 7}%` }} />
        </td>
      ))}
    </tr>
  );
}

const EMPTY_FORM: DoctorInsert = {
  first_name: "",
  last_name: "",
  specialty: "",
  phone: "",
  email: "",
  license_number: "",
  status: "active",
};

interface DoctorFormProps {
  initial?: Doctor | null;
  defaultLicense?: string;
  saving: boolean;
  onSubmit: (data: DoctorInsert) => void;
  onCancel: () => void;
}

function DoctorForm({ initial, defaultLicense, saving, onSubmit, onCancel }: DoctorFormProps) {
  const [form, setForm] = useState<DoctorInsert>(
    initial
      ? {
          first_name: initial.first_name,
          last_name: initial.last_name,
          specialty: initial.specialty,
          phone: initial.phone,
          email: initial.email,
          license_number: initial.license_number,
          status: initial.status,
        }
      : { ...EMPTY_FORM, license_number: defaultLicense ?? "" }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof DoctorInsert, string>>>({});

  const set = (field: keyof DoctorInsert, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const errs: Partial<Record<keyof DoctorInsert, string>> = {};
    if (!form.first_name.trim()) errs.first_name = "Required";
    if (!form.last_name.trim()) errs.last_name = "Required";
    if (!form.specialty.trim()) errs.specialty = "Required";
    if (!form.phone.trim()) errs.phone = "Required";
    if (!form.license_number.trim()) errs.license_number = "Required";
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSubmit(form);
  };

  const field = (label: string, key: keyof DoctorInsert, props?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
        {label} {!props?.required && <span className="text-slate-400 normal-case font-normal">(optional)</span>}
      </label>
      <input
        {...props}
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value)}
        className={cn(
          "w-full h-9 px-3 text-[13px] text-slate-800 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-50 transition-colors placeholder:text-slate-400",
          errors[key] ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-blue-400"
        )}
      />
      {errors[key] && <p className="text-[11px] text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {field("First name", "first_name", { placeholder: "Jane", required: true })}
        {field("Last name", "last_name", { placeholder: "Smith", required: true })}
      </div>
      {field("Specialty", "specialty", { placeholder: "e.g. Cardiology", required: true })}
      <div className="grid grid-cols-2 gap-4">
        {field("Phone", "phone", { placeholder: "+1 (555) 000-0000", required: true })}
        {field("Email", "email", { placeholder: "doctor@clinic.com", type: "email" })}
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
          License number
        </label>
        <div className="flex gap-2">
          <input
            value={form.license_number}
            onChange={(e) => set("license_number", e.target.value)}
            placeholder="DOC-0001"
            required
            className={cn(
              "flex-1 h-9 px-3 text-[13px] text-slate-800 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-50 transition-colors placeholder:text-slate-400",
              errors.license_number ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-blue-400"
            )}
          />
          {!initial && (
            <button
              type="button"
              onClick={async () => { const n = await generateLicenseNumber(); set("license_number", n); }}
              className="flex-shrink-0 h-9 px-3 text-[12px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              Re-generate
            </button>
          )}
        </div>
        {errors.license_number && <p className="text-[11px] text-red-500 mt-1">{errors.license_number}</p>}
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
          Status
        </label>
        <select
          value={form.status}
          onChange={(e) => set("status", e.target.value)}
          className="w-full h-9 px-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-colors cursor-pointer"
        >
          <option value="active">Active</option>
          <option value="on_leave">On leave</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 h-9 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Add doctor"}
        </button>
      </div>
    </form>
  );
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Doctor["status"]>("all");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Doctor | null>(null);
  const [newLicense, setNewLicense] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllDoctors();
      setDoctors(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load doctors. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const filtered = doctors.filter((d) => {
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      d.first_name.toLowerCase().includes(q) ||
      d.last_name.toLowerCase().includes(q) ||
      d.specialty.toLowerCase().includes(q) ||
      d.license_number.toLowerCase().includes(q) ||
      d.phone.includes(q) ||
      d.email.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const active = doctors.filter((d) => d.status === "active").length;
  const onLeave = doctors.filter((d) => d.status === "on_leave").length;
  const inactive = doctors.filter((d) => d.status === "inactive").length;

  const openCreate = async () => {
    setEditTarget(null);
    setError(null);
    const license = await generateLicenseNumber();
    setNewLicense(license);
    setShowModal(true);
  };

  const handleCreate = async (data: DoctorInsert) => {
    setSaving(true);
    try {
      await createDoctor(data);
      setShowModal(false);
      await fetchDoctors();
    } catch (err) {
      console.error(err);
      setError("Failed to create doctor.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: DoctorInsert) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateDoctor(editTarget.id, data);
      setEditTarget(null);
      await fetchDoctors();
    } catch (err) {
      console.error(err);
      setError("Failed to update doctor.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoctor(deleteTarget.id);
      setDeleteTarget(null);
      await fetchDoctors();
    } catch (err) {
      console.error(err);
      setError("Failed to delete doctor.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active", value: loading ? "—" : active, icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "On leave", value: loading ? "—" : onLeave, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Inactive", value: loading ? "—" : inactive, icon: UserX, color: "text-slate-500", bg: "bg-slate-100" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={15} className={color} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500">{label}</p>
              <p className="text-[20px] font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, specialty, license…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-400 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-9 px-3 text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 cursor-pointer transition-colors"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On leave</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 h-9 px-4 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors ml-auto"
        >
          <Plus size={14} />
          Add doctor
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
          <span className="font-medium">Error:</span> {error}
          <button
            className="ml-auto text-[12px] font-medium text-red-600 hover:text-red-800 transition-colors"
            onClick={() => { setError(null); fetchDoctors(); }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {!loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
              <Stethoscope size={20} className="text-slate-400" />
            </div>
            <h3 className="text-[14px] font-semibold text-slate-700 mb-1">
              {search || statusFilter !== "all" ? "No doctors found" : "No doctors yet"}
            </h3>
            <p className="text-[12px] text-slate-400 max-w-xs">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filter."
                : "Add your first doctor to start managing your medical staff."}
            </p>
            {!search && statusFilter === "all" && (
              <button
                onClick={() => openCreate()}
                className="mt-5 flex items-center gap-2 h-8 px-4 text-[12px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={13} />
                Add first doctor
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {["Doctor", "Specialty", "License #", "Phone", "Email", "Status", ""].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                  : filtered.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                            <Stethoscope size={14} className="text-teal-600" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-slate-900">
                              Dr. {doc.first_name} {doc.last_name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-700">{doc.specialty}</td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-mono text-slate-500">{doc.license_number}</span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-600">{doc.phone}</td>
                      <td className="px-4 py-3 text-[13px] text-slate-600">{doc.email || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setEditTarget(doc)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(doc)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add doctor modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold text-slate-900">Add doctor</h2>
              <button
                onClick={() => !saving && setShowModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            <DoctorForm
              defaultLicense={newLicense}
              saving={saving}
              onSubmit={handleCreate}
              onCancel={() => setShowModal(false)}
            />
          </div>
        </div>
      )}

      {/* Edit doctor modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setEditTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold text-slate-900">
                Edit Dr. {editTarget.first_name} {editTarget.last_name}
              </h2>
              <button
                onClick={() => !saving && setEditTarget(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            <DoctorForm
              initial={editTarget}
              saving={saving}
              onSubmit={handleUpdate}
              onCancel={() => setEditTarget(null)}
            />
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <p className="text-[14px] font-semibold text-slate-900">Delete doctor</p>
            </div>
            <p className="text-[13px] text-slate-600 mb-5">
              This will permanently delete{" "}
              <span className="font-semibold">
                Dr. {deleteTarget.first_name} {deleteTarget.last_name}
              </span>
              . This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
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
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
