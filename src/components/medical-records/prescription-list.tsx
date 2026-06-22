"use client";

import { useState } from "react";
import { Plus, Pill, Edit2, Trash2, AlertTriangle } from "lucide-react";
import { createPrescription, updatePrescription, deletePrescription } from "@/lib/supabase/prescriptions";
import { PrescriptionForm } from "./prescription-form";
import type { Prescription, PrescriptionInsert, PrescriptionUpdate } from "@/lib/types";

interface Props {
  medicalRecordId: string;
  initialPrescriptions: Prescription[];
}

export function PrescriptionList({ medicalRecordId, initialPrescriptions }: Props) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialPrescriptions);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleAdd = async (data: PrescriptionInsert | PrescriptionUpdate) => {
    const created = await createPrescription(data as PrescriptionInsert);
    setPrescriptions((prev) => [...prev, created]);
    setShowAdd(false);
  };

  const handleEdit = async (id: string, data: PrescriptionInsert | PrescriptionUpdate) => {
    const updated = await updatePrescription(id, data as PrescriptionUpdate);
    setPrescriptions((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deletePrescription(id);
      setPrescriptions((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="space-y-3">
      {prescriptions.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-3">
            <Pill size={18} className="text-violet-400" />
          </div>
          <p className="text-[13px] font-semibold text-slate-700">No prescriptions</p>
          <p className="text-[12px] text-slate-400 mt-1">
            Add medications prescribed during this visit.
          </p>
        </div>
      )}

      {prescriptions.map((p) => (
        <div key={p.id}>
          {editingId === p.id ? (
            <PrescriptionForm
              medicalRecordId={medicalRecordId}
              prescription={p}
              onSave={(data) => handleEdit(p.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 group">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Pill size={14} className="text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800">{p.medication_name}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  {p.dosage} · {p.frequency} · {p.duration}
                </p>
                {p.instructions && (
                  <p className="text-[11px] text-slate-400 mt-1 italic">{p.instructions}</p>
                )}
              </div>

              {pendingDeleteId === p.id ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-1 mr-1">
                    <AlertTriangle size={12} className="text-red-500" />
                    <span className="text-[11px] text-red-600 font-medium">Delete?</span>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="px-2 h-6 text-[11px] font-semibold text-white bg-red-600 rounded hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    {deletingId === p.id ? "…" : "Yes"}
                  </button>
                  <button
                    onClick={() => setPendingDeleteId(null)}
                    className="px-2 h-6 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingId(p.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => setPendingDeleteId(p.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {showAdd ? (
        <PrescriptionForm
          medicalRecordId={medicalRecordId}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 h-9 text-[12px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 border-dashed rounded-xl transition-colors"
        >
          <Plus size={13} />
          Add prescription
        </button>
      )}
    </div>
  );
}
