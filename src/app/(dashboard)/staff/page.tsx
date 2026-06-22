"use client";

import { useState, useEffect } from "react";
import {
  UserCog,
  Plus,
  Search,
  Users,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllDoctors } from "@/lib/supabase/doctors";
import { getStaff, createStaff, updateStaff, deleteStaff } from "@/lib/supabase/staff";
import type { Staff, Doctor, StaffInsert, StaffRow, UserRole } from "@/lib/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function generateEmployeeId(): string {
  const yr = new Date().getFullYear().toString().slice(-2);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `EMP${yr}${rand}`;
}

function toStaffRow(s: Staff): StaffRow {
  return {
    id: s.id,
    source: "staff",
    first_name: s.first_name,
    last_name: s.last_name,
    role: s.role,
    department: s.department,
    phone: s.phone,
    email: s.email,
    employee_id: s.employee_id,
    salary: s.salary,
    status: s.status,
  };
}

function toDoctorRow(d: Doctor): StaffRow {
  return {
    id: d.id,
    source: "doctor",
    first_name: d.first_name,
    last_name: d.last_name,
    role: "doctor",
    department: d.specialty,
    phone: d.phone,
    email: d.email,
    employee_id: null,
    salary: null,
    status: d.status,
  };
}

// ─── constants ───────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "on_leave" | "inactive";

const NON_DOCTOR_ROLES = [
  { value: "admin",        label: "Admin" },
  { value: "manager",      label: "Clinic Manager" },
  { value: "receptionist", label: "Receptionist" },
  { value: "nurse",        label: "Nurse" },
] as const;

const ROLE_META: Record<UserRole, { label: string; pill: string }> = {
  admin:        { label: "Admin",          pill: "bg-red-50 text-red-700 border-red-100" },
  manager:      { label: "Clinic Manager", pill: "bg-purple-50 text-purple-700 border-purple-100" },
  doctor:       { label: "Doctor",         pill: "bg-blue-50 text-blue-700 border-blue-100" },
  nurse:        { label: "Nurse",          pill: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  receptionist: { label: "Receptionist",   pill: "bg-amber-50 text-amber-700 border-amber-100" },
};

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  active:   { label: "Active",   dot: "bg-emerald-500", text: "text-emerald-700" },
  on_leave: { label: "On leave", dot: "bg-amber-400",   text: "text-amber-700" },
  inactive: { label: "Inactive", dot: "bg-slate-400",   text: "text-slate-600" },
};

const ROLE_CARDS: { role: UserRole; label: string; color: string }[] = [
  { role: "admin",        label: "Admin",       color: "bg-red-50 border-red-100 text-red-700" },
  { role: "manager",      label: "Manager",     color: "bg-purple-50 border-purple-100 text-purple-700" },
  { role: "doctor",       label: "Doctor",      color: "bg-blue-50 border-blue-100 text-blue-700" },
  { role: "nurse",        label: "Nurse",       color: "bg-emerald-50 border-emerald-100 text-emerald-700" },
  { role: "receptionist", label: "Receptionist",color: "bg-amber-50 border-amber-100 text-amber-700" },
];

// ─── form types ──────────────────────────────────────────────────────────────

type FormData = {
  first_name: string;
  last_name: string;
  role: "admin" | "manager" | "receptionist" | "nurse";
  department: string;
  phone: string;
  email: string;
  employee_id: string;
  salary: string;
  status: "active" | "inactive" | "on_leave";
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const EMPTY_FORM: FormData = {
  first_name: "",
  last_name: "",
  role: "receptionist",
  department: "",
  phone: "",
  email: "",
  employee_id: "",
  salary: "",
  status: "active",
};

// ─── sub-components ──────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
        {label}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full h-9 px-3 text-[13px] border rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors";

// ─── page ────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Staff | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── data ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([getAllDoctors(), getStaff()])
      .then(([docs, staff]) => {
        setDoctors(docs);
        setStaffMembers(staff);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ─── merged rows ───────────────────────────────────────────────────────────

  const allRows: StaffRow[] = [
    ...doctors.map(toDoctorRow),
    ...staffMembers.map(toStaffRow),
  ];

  const filtered = allRows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (roleFilter !== "all" && r.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.first_name.toLowerCase().includes(q) ||
        r.last_name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        (r.department?.toLowerCase().includes(q) ?? false) ||
        r.email.toLowerCase().includes(q) ||
        (r.employee_id?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  // ─── counts ────────────────────────────────────────────────────────────────

  const countByRole = (role: UserRole) => allRows.filter((r) => r.role === role).length;
  const totalActive   = allRows.filter((r) => r.status === "active").length;
  const totalOnLeave  = allRows.filter((r) => r.status === "on_leave").length;
  const totalInactive = allRows.filter((r) => r.status === "inactive").length;

  // ─── form logic ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, employee_id: generateEmployeeId() });
    setErrors({});
    setSaveError(null);
    setShowForm(true);
  };

  const openEdit = (s: Staff) => {
    setEditTarget(s);
    setForm({
      first_name: s.first_name,
      last_name: s.last_name,
      role: s.role as FormData["role"],
      department: s.department ?? "",
      phone: s.phone,
      email: s.email,
      employee_id: s.employee_id,
      salary: s.salary != null ? String(s.salary) : "",
      status: s.status,
    });
    setErrors({});
    setSaveError(null);
    setShowForm(true);
  };

  const set = (key: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim())  e.last_name  = "Required";
    if (!form.phone.trim())      e.phone      = "Required";
    if (!form.employee_id.trim()) e.employee_id = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: StaffInsert = {
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        role:       form.role,
        department: form.department.trim() || null,
        phone:      form.phone.trim(),
        email:      form.email.trim(),
        employee_id: form.employee_id.trim(),
        salary:     form.salary.trim() ? parseFloat(form.salary.trim()) : null,
        status:     form.status,
      };
      if (editTarget) {
        const updated = await updateStaff(editTarget.id, payload);
        setStaffMembers((prev) => prev.map((s) => (s.id === editTarget.id ? updated : s)));
      } else {
        const created = await createStaff(payload);
        setStaffMembers((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save staff member.";
      if (msg.includes("employee_id")) {
        setSaveError("That Employee ID is already in use. Please choose a different one.");
      } else {
        setSaveError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStaff(deleteTarget.id);
      setStaffMembers((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-7xl">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff..."
              className="pl-9 pr-4 h-9 text-sm bg-white border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
            />
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-9 px-4 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
        >
          <Plus size={14} />
          Add Staff Member
        </button>
      </div>

      {/* Role breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ROLE_CARDS.map(({ role, label, color }) => (
          <button
            key={role}
            onClick={() => setRoleFilter((prev) => (prev === role ? "all" : role))}
            className={cn(
              "rounded-2xl border px-4 py-3 cursor-pointer hover:shadow-sm transition-all text-left",
              color,
              roleFilter === role && "ring-2 ring-offset-1 ring-current/40"
            )}
          >
            <p className="text-xs font-medium">{label}</p>
            <p className="text-2xl font-bold mt-1">
              {loading ? "—" : countByRole(role)}
            </p>
            {role === "doctor" && (
              <p className="text-[10px] opacity-60 mt-0.5">Via Doctors module</p>
            )}
          </button>
        ))}
      </div>

      {/* Workforce overview */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-slate-400" />
          <h3 className="text-[14px] font-bold text-slate-900">Workforce Overview</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Staff",  value: loading ? "—" : String(allRows.length) },
            { label: "Active",       value: loading ? "—" : String(totalActive) },
            { label: "On Leave",     value: loading ? "—" : String(totalOnLeave) },
            { label: "Inactive",     value: loading ? "—" : String(totalInactive) },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Staff directory */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-slate-900">Staff Directory</h3>
          <div className="flex gap-2">
            {(["all", "active", "on_leave", "inactive"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-colors capitalize",
                  statusFilter === f
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {f === "all" ? "All" : f === "on_leave" ? "On Leave" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {["Employee", "Role", "Department", "Employee ID", "Salary", "Phone", "Email", "Status", ""].map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-slate-100 rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <UserCog size={20} className="text-slate-400" />
                      </div>
                      <p className="text-[13px] font-semibold text-slate-700">
                        {allRows.length === 0 ? "No staff members yet" : "No results match your filters"}
                      </p>
                      <p className="text-[12px] text-slate-400">
                        {allRows.length === 0
                          ? "Add clinic staff or doctors to see them here."
                          : "Try clearing the search or changing the filters."}
                      </p>
                      {allRows.length === 0 && (
                        <button
                          onClick={openCreate}
                          className="flex items-center gap-2 h-9 px-4 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
                        >
                          <Plus size={14} />
                          Add Staff Member
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const roleMeta   = ROLE_META[row.role];
                  const statusMeta = STATUS_META[row.status];
                  return (
                    <tr key={`${row.source}-${row.id}`} className="hover:bg-slate-50/50 transition-colors group">
                      {/* Employee */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                              row.source === "doctor" ? "bg-blue-50" : "bg-slate-100"
                            )}
                          >
                            {row.source === "doctor" ? (
                              <Stethoscope size={14} className="text-blue-600" />
                            ) : (
                              <UserCog size={14} className="text-slate-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-slate-800">
                              {row.first_name} {row.last_name}
                            </p>
                            <p className="text-[11px] text-slate-400">{row.email || "—"}</p>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                            roleMeta.pill
                          )}
                        >
                          {roleMeta.label}
                        </span>
                      </td>
                      {/* Department */}
                      <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap">
                        {row.department || <span className="text-slate-300">—</span>}
                      </td>
                      {/* Employee ID */}
                      <td className="px-4 py-3 text-[12px] font-mono text-slate-500 whitespace-nowrap">
                        {row.employee_id || <span className="text-slate-300 font-sans">—</span>}
                      </td>
                      {/* Salary */}
                      <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap">
                        {row.salary != null
                          ? `$${Number(row.salary).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Phone */}
                      <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap">
                        {row.phone || <span className="text-slate-300">—</span>}
                      </td>
                      {/* Email */}
                      <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap">
                        {row.email || <span className="text-slate-300">—</span>}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full", statusMeta.dot)} />
                          <span className={cn("text-[12px] font-medium", statusMeta.text)}>
                            {statusMeta.label}
                          </span>
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.source === "doctor" ? (
                          <span className="text-[11px] text-slate-400 italic">Doctors module</span>
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                const s = staffMembers.find((m) => m.id === row.id);
                                if (s) openEdit(s);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                const s = staffMembers.find((m) => m.id === row.id);
                                if (s) setDeleteTarget(s);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-50 flex items-center justify-between">
            <p className="text-[12px] text-slate-400">
              Showing {filtered.length} of {allRows.length} personnel
              {doctors.length > 0 && (
                <span className="ml-1">· {doctors.length} doctor{doctors.length !== 1 ? "s" : ""} synced from Doctors module</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ─── Add / Edit modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-[15px] font-bold text-slate-900">
                {editTarget ? "Edit staff member" : "Add staff member"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-6 space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name" error={errors.first_name}>
                  <input
                    value={form.first_name}
                    onChange={(e) => set("first_name", e.target.value)}
                    placeholder="Jane"
                    className={cn(inputCls, errors.first_name && "border-red-300 focus:border-red-400")}
                  />
                </Field>
                <Field label="Last name" error={errors.last_name}>
                  <input
                    value={form.last_name}
                    onChange={(e) => set("last_name", e.target.value)}
                    placeholder="Smith"
                    className={cn(inputCls, errors.last_name && "border-red-300 focus:border-red-400")}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Role">
                  <select
                    value={form.role}
                    onChange={(e) => set("role", e.target.value)}
                    className={inputCls}
                  >
                    {NON_DOCTOR_ROLES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    className={inputCls}
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
              </div>

              <Field label="Department (optional)">
                <input
                  value={form.department}
                  onChange={(e) => set("department", e.target.value)}
                  placeholder="e.g. Front Desk, Administration"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone" error={errors.phone}>
                  <input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+1 555 000 0000"
                    className={cn(inputCls, errors.phone && "border-red-300 focus:border-red-400")}
                  />
                </Field>
                <Field label="Email">
                  <input
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="jane@clinic.com"
                    type="email"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Employee ID" error={errors.employee_id}>
                  <div className="flex gap-2">
                    <input
                      value={form.employee_id}
                      onChange={(e) => set("employee_id", e.target.value)}
                      placeholder="EMP2400"
                      className={cn(inputCls, errors.employee_id && "border-red-300 focus:border-red-400")}
                    />
                    <button
                      type="button"
                      onClick={() => set("employee_id", generateEmployeeId())}
                      className="flex-shrink-0 h-9 px-3 text-[12px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Gen
                    </button>
                  </div>
                </Field>
                <Field label="Monthly Salary (optional)">
                  <input
                    value={form.salary}
                    onChange={(e) => set("salary", e.target.value)}
                    placeholder="e.g. 3500.00"
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                  />
                </Field>
              </div>

              {saveError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-[12px] text-red-700">
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                  {saveError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-9 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : editTarget ? "Save changes" : "Add staff member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete confirmation ───────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <p className="text-[14px] font-semibold text-slate-900">Remove staff member</p>
            </div>
            <p className="text-[13px] text-slate-600 mb-5">
              This will permanently remove{" "}
              <span className="font-semibold">
                {deleteTarget.first_name} {deleteTarget.last_name}
              </span>{" "}
              from the staff directory. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Keep
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-9 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
