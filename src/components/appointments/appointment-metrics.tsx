"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CalendarClock, CheckCircle, XCircle, UserMinus } from "lucide-react";
import { getAppointmentMetrics } from "@/lib/supabase/appointments";
import type { AppointmentMetrics } from "@/lib/types";

function MetricCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={15} className={iconColor} />
        </div>
      </div>
      {loading ? (
        <div className="h-7 w-10 bg-slate-100 rounded animate-pulse" />
      ) : (
        <p className="text-[24px] font-bold text-slate-900 leading-none">{value.toLocaleString()}</p>
      )}
    </div>
  );
}

export function AppointmentMetricsBar() {
  const [metrics, setMetrics] = useState<AppointmentMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAppointmentMetrics()
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: "Today",
      value: metrics?.today ?? 0,
      icon: CalendarCheck,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
    },
    {
      label: "This week",
      value: metrics?.thisWeek ?? 0,
      icon: CalendarClock,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
    },
    {
      label: "Completed",
      value: metrics?.completed ?? 0,
      icon: CheckCircle,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
    {
      label: "Cancelled",
      value: metrics?.cancelled ?? 0,
      icon: XCircle,
      iconColor: "text-red-500",
      iconBg: "bg-red-50",
    },
    {
      label: "No show",
      value: metrics?.noShow ?? 0,
      icon: UserMinus,
      iconColor: "text-slate-500",
      iconBg: "bg-slate-100",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  );
}
