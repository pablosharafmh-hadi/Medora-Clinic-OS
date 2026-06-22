"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllServices, createService, updateService, deleteService } from "@/lib/supabase/services";
import { formatCurrency } from "@/components/finance/invoice-status-badge";
import type { Service, ServiceInsert } from "@/lib/types";

const SERVICE_CATEGORIES = ["Consultation", "Diagnostics", "Procedures", "Medications", "General"];

const EMPTY_FORM: ServiceInsert = {
  service_name: "",
  category: null,
  description: null,
  price: 0,
  status: "active",
};

function ServiceForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: Service | null;
  saving: boolean;
  onSubmit: (data: ServiceInsert) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ServiceInsert>(
    initial
      ? { service_name: initial.service_name, category: initial.category ?? null, description: initial.description, price: initial.price, status: initial.status }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState<{ service_name?: string; price?: string }>({});

  const set = (field: keyof ServiceInsert, value: string | number | null) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.service_name.trim()) errs.service_name = "Required";
    if (form.price < 0) errs.price = "Price must be ≥ 0";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSubmit({ ...form, service_name: form.service_name.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
            Category <span className="font-normal text-slate-400 normal-case">(optional)</span>
          </label>
          <select
            value={form.category ?? ""}
            onChange={(e) => set("category", e.target.value || null)}
            className="w-full h-9 px-3 text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 cursor-pointer"
          >
            <option value="">— No category —</option>
            {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
          Service name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.service_name}
          onChange={(e) => set("service_name", e.target.value)}
          placeholder="e.g. General Consultation"
          className={cn(
            "w-full h-9 px-3 text-[13px] text-slate-800 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-50 placeholder:text-slate-400",
            errors.service_name ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-blue-400"
          )}
        />
        {errors.service_name && <p className="text-[11px] text-red-500 mt-1">{errors.service_name}</p>}
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
          Description <span className="font-normal text-slate-400 normal-case">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value || null)}
          placeholder="Brief description of the service"
          className="w-full px-3 py-2 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-none placeholder:text-slate-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">
            Price ($) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.price}
            onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
            className={cn(
              "w-full h-9 px-3 text-[13px] text-slate-800 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-50",
              errors.price ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-blue-400"
            )}
          />
          {errors.price && <p className="text-[11px] text-red-500 mt-1">{errors.price}</p>}
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.06em] mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className="w-full h-9 px-3 text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 cursor-pointer"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={saving} className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 h-9 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {saving ? "Saving…" : initial ? "Save changes" : "Add service"}
        </button>
      </div>
    </form>
  );
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllServices();
      setServices(data);
    } catch {
      setError("Failed to load services.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const filtered = services.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.service_name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q);
  });

  const activeCount = services.filter((s) => s.status === "active").length;
  const inactiveCount = services.filter((s) => s.status === "inactive").length;

  const handleCreate = async (data: ServiceInsert) => {
    setSaving(true);
    try {
      await createService(data);
      setShowModal(false);
      await fetchServices();
    } catch {
      setError("Failed to create service.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: ServiceInsert) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateService(editTarget.id, data);
      setEditTarget(null);
      await fetchServices();
    } catch {
      setError("Failed to update service.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteService(deleteTarget.id);
      setDeleteTarget(null);
      await fetchServices();
    } catch {
      setError("This service may be referenced by existing invoices and cannot be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleStatus = async (svc: Service) => {
    try {
      await updateService(svc.id, { status: svc.status === "active" ? "inactive" : "active" });
      setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, status: s.status === "active" ? "inactive" : "active" } : s));
    } catch {
      setError("Failed to update service status.");
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total services", value: loading ? "—" : String(services.length), color: "text-slate-900" },
          { label: "Active", value: loading ? "—" : String(activeCount), color: "text-emerald-600" },
          { label: "Inactive", value: loading ? "—" : String(inactiveCount), color: "text-slate-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className={cn("text-[20px] font-bold mt-0.5", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-400 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 h-9 px-4 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors ml-auto"
        >
          <Plus size={14} />
          Add service
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
          <span className="font-medium">Error:</span> {error}
          <button className="ml-auto text-[12px] font-medium text-red-600 hover:text-red-800" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {!loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
              <Package size={20} className="text-slate-400" />
            </div>
            <h3 className="text-[14px] font-semibold text-slate-700 mb-1">
              {search ? "No services found" : "No services yet"}
            </h3>
            <p className="text-[12px] text-slate-400 max-w-xs">
              {search ? "Try a different search." : "Add billable services to use in invoices."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {["Service", "Description", "Price", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${40 + j * 8}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                  : filtered.map((svc) => (
                    <tr key={svc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-slate-800">{svc.service_name}</p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 max-w-[240px] truncate">
                        {svc.description ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-slate-800">{formatCurrency(svc.price)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleStatus(svc)}
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer",
                            svc.status === "active"
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          )}
                          title="Click to toggle status"
                        >
                          {svc.status === "active" ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setEditTarget(svc)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(svc)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold text-slate-900">Add service</h2>
              <button onClick={() => !saving && setShowModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={15} />
              </button>
            </div>
            <ServiceForm saving={saving} onSubmit={handleCreate} onCancel={() => setShowModal(false)} />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setEditTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold text-slate-900">Edit service</h2>
              <button onClick={() => !saving && setEditTarget(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={15} />
              </button>
            </div>
            <ServiceForm initial={editTarget} saving={saving} onSubmit={handleUpdate} onCancel={() => setEditTarget(null)} />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <p className="text-[14px] font-semibold text-slate-900">Delete service?</p>
            </div>
            <p className="text-[13px] text-slate-600 mb-5">
              <span className="font-semibold">{deleteTarget.service_name}</span> will be removed from the catalog. Existing invoice items that reference it will retain their data.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 h-9 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Keep</button>
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
