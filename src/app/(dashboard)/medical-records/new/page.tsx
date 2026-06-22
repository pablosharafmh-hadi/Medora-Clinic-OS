"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MedicalRecordForm } from "@/components/medical-records/medical-record-form";
import { createMedicalRecord } from "@/lib/supabase/medical-records";
import type { MedicalRecordInsert, MedicalRecordUpdate } from "@/lib/types";

function NewRecordInner() {
  const router = useRouter();

  const handleSubmit = async (data: MedicalRecordInsert | MedicalRecordUpdate) => {
    const record = await createMedicalRecord(data as MedicalRecordInsert);
    router.push(`/medical-records/${record.id}`);
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/medical-records"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900">New medical record</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Document a clinical visit</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <MedicalRecordForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/medical-records")}
        />
      </div>
    </div>
  );
}

export default function NewMedicalRecordPage() {
  return (
    <Suspense>
      <NewRecordInner />
    </Suspense>
  );
}
