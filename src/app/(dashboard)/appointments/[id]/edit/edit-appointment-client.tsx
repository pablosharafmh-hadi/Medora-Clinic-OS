"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { updateAppointment } from "@/lib/supabase/appointments";
import type { AppointmentWithRelations, AppointmentInsert, AppointmentUpdate } from "@/lib/types";

interface Props {
  appointment: AppointmentWithRelations;
}

function EditAppointmentInner({ appointment }: Props) {
  const router = useRouter();

  const handleSubmit = async (data: AppointmentInsert | AppointmentUpdate) => {
    await updateAppointment(appointment.id, data as AppointmentUpdate);
    router.push(`/appointments/${appointment.id}`);
    router.refresh();
  };

  const patientName = appointment.patient
    ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
    : "appointment";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/appointments/${appointment.id}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900">
            Edit appointment — {patientName}
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {new Date(appointment.scheduled_at).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <AppointmentForm
          appointment={appointment}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/appointments/${appointment.id}`)}
        />
      </div>
    </div>
  );
}

export function EditAppointmentClient({ appointment }: Props) {
  return (
    <Suspense>
      <EditAppointmentInner appointment={appointment} />
    </Suspense>
  );
}
