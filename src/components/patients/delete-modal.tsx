"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteModalProps {
  patientName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteModal({ patientName, onConfirm, onCancel }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete patient.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-4 mb-5">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Delete patient record</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-[13px] text-slate-600 leading-relaxed mb-5">
          You are about to permanently delete the record for{" "}
          <span className="font-semibold text-slate-900">{patientName}</span>.
          All associated data will be removed from the system.
        </p>

        {error && (
          <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 h-9 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 h-9 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting…" : "Delete patient"}
          </button>
        </div>
      </div>
    </div>
  );
}
