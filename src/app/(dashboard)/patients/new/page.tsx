"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PatientForm } from "@/components/patients/patient-form";
import { createPatient } from "@/lib/supabase/patients";
import type { PatientInsert, PatientUpdate } from "@/lib/types";

export default function NewPatientPage() {
  const router = useRouter();

  const handleSubmit = async (data: PatientInsert | PatientUpdate) => {
    await createPatient(data as PatientInsert);
    router.push("/patients");
    router.refresh();
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/patients"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900">Add new patient</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Fill in the details to register a new patient</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <PatientForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
