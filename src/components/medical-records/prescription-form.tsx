"use client";

import { useState } from "react";
import type { Prescription, PrescriptionInsert, PrescriptionUpdate } from "@/lib/types";

interface Props {
  medicalRecordId: string;
  prescription?: Prescription;
  onSave: (data: PrescriptionInsert | PrescriptionUpdate) => Promise<void>;
  onCancel: () => void;
}

export function PrescriptionForm({ medicalRecordId, prescription, onSave, onCancel }: Props) {
  const [medicationName, setMedicationName] = useState(prescription?.medication_name ?? "");
  const [dosage, setDosage] = useState(prescription?.dosage ?? "");
  const [frequency, setFrequency] = useState(prescription?.frequency ?? "");
  const [duration, setDuration] = useState(prescription?.duration ?? "");
  const [instructions, setInstructions] = useState(prescription?.instructions ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicationName.trim()) { setError("Medication name is required."); return; }
    if (!dosage.trim()) { setError("Dosage is required."); return; }
    if (!frequency.trim()) { setError("Frequency is required."); return; }
    if (!duration.trim()) { setError("Duration is required."); return; }

    setSaving(true);
    setError(null);

    const data = prescription
      ? ({ medication_name: medicationName.trim(), dosage: dosage.trim(), frequency: frequency.trim(), duration: duration.trim(), instructions: instructions.trim() || null } as PrescriptionUpdate)
      : ({ medical_record_id: medicalRecordId, medication_name: medicationName.trim(), dosage: dosage.trim(), frequency: frequency.trim(), duration: duration.trim(), instructions: instructions.trim() || null } as PrescriptionInsert);

    try {
      await onSave(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prescription.");
      setSaving(false);
    }
  };

  const inputClass =
    "w-full h-9 px-3 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors";
  const labelClass = "block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em] mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <h4 className="text-[12px] font-bold text-slate-700">
        {prescription ? "Edit prescription" : "Add prescription"}
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass}>Medication name *</label>
          <input
            type="text"
            value={medicationName}
            onChange={(e) => setMedicationName(e.target.value)}
            placeholder="e.g. Amoxicillin"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Dosage *</label>
          <input
            type="text"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="e.g. 500mg"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Frequency *</label>
          <input
            type="text"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder="e.g. 3x daily"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Duration *</label>
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 7 days"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Special instructions</label>
          <input
            type="text"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Take with food"
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 h-8 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : prescription ? "Save changes" : "Add prescription"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 h-8 text-[12px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
