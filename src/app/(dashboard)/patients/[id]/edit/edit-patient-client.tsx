"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PatientForm } from "@/components/patients/patient-form";
import { updatePatient } from "@/lib/supabase/patients";
import type { Patient, PatientInsert, PatientUpdate } from "@/lib/types";

interface Props {
  patient: Patient;
}

export function EditPatientClient({ patient }: Props) {
  const router = useRouter();

  const handleSubmit = async (data: PatientInsert | PatientUpdate) => {
    await updatePatient(patient.id, data as PatientUpdate);
    router.push(`/patients/${patient.id}`);
    router.refresh();
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/patients/${patient.id}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900">
            Edit patient — {patient.first_name} {patient.last_name}
          </h1>
          {patient.patient_number && (
            <p className="text-[12px] text-slate-500 mt-0.5 font-mono">{patient.patient_number}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <PatientForm
          patient={patient}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/patients/${patient.id}`)}
        />
      </div>
    </div>
  );
}
