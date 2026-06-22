"use client";

import { useEffect, useState } from "react";
import { FileText, CalendarDays, Clock, CheckCircle2, CalendarClock } from "lucide-react";
import { getMedicalRecordMetrics } from "@/lib/supabase/medical-records";
import type { MedicalRecordMetrics } from "@/lib/types";

const METRICS = [
  { key: "total" as const,       label: "Total records",    icon: FileText,       color: "text-blue-600",   bg: "bg-blue-50" },
  { key: "thisMonth" as const,   label: "This month",       icon: CalendarDays,   color: "text-violet-600", bg: "bg-violet-50" },
  { key: "draft" as const,       label: "Draft",            icon: Clock,          color: "text-amber-600",  bg: "bg-amber-50" },
  { key: "final" as const,       label: "Finalised",        icon: CheckCircle2,   color: "text-emerald-600",bg: "bg-emerald-50" },
  { key: "withFollowUp" as const,label: "Follow-ups due",   icon: CalendarClock,  color: "text-red-600",    bg: "bg-red-50" },
];

export function RecordMetricsBar() {
  const [metrics, setMetrics] = useState<MedicalRecordMetrics | null>(null);

  useEffect(() => {
    getMedicalRecordMetrics().then(setMetrics).catch(console.error);
  }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      {METRICS.map(({ key, label, icon: Icon, color, bg }) => (
        <div
          key={key}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5 flex items-center gap-3"
        >
          <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={16} className={color} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">{label}</p>
            <p className="text-[20px] font-bold text-slate-900 leading-tight">
              {metrics ? metrics[key] : "—"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
