"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { createAppointment } from "@/lib/supabase/appointments";
import type { AppointmentInsert, AppointmentUpdate } from "@/lib/types";

function NewAppointmentInner() {
  const router = useRouter();

  const handleSubmit = async (data: AppointmentInsert | AppointmentUpdate) => {
    const apt = await createAppointment(data as AppointmentInsert);
    router.push(`/appointments/${apt.id}`);
    router.refresh();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/appointments"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900">New appointment</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Schedule a patient visit with a doctor</p>
        </div>
      </div>

      <AppointmentForm onSubmit={handleSubmit} />
    </div>
  );
}

export default function NewAppointmentPage() {
  return (
    <Suspense>
      <NewAppointmentInner />
    </Suspense>
  );
}
