"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MedicalRecordForm } from "@/components/medical-records/medical-record-form";
import { updateMedicalRecord } from "@/lib/supabase/medical-records";
import type { MedicalRecordWithRelations, MedicalRecordInsert, MedicalRecordUpdate } from "@/lib/types";

interface Props {
  record: MedicalRecordWithRelations;
}

function EditRecordInner({ record }: Props) {
  const router = useRouter();

  const handleSubmit = async (data: MedicalRecordInsert | MedicalRecordUpdate) => {
    await updateMedicalRecord(record.id, data as MedicalRecordUpdate);
    router.push(`/medical-records/${record.id}`);
    router.refresh();
  };

  const patientName = record.patient
    ? `${record.patient.first_name} ${record.patient.last_name}`
    : "record";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/medical-records/${record.id}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900">
            Edit record — {patientName}
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {new Date(record.visit_date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <MedicalRecordForm
          record={record}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/medical-records/${record.id}`)}
        />
      </div>
    </div>
  );
}

export function EditRecordClient({ record }: Props) {
  return (
    <Suspense>
      <EditRecordInner record={record} />
    </Suspense>
  );
}
