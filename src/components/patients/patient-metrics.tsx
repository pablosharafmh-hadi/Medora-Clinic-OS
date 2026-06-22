"use client";

import { useEffect, useState } from "react";
import { Users, UserCheck, UserX, UserPlus } from "lucide-react";
import { getPatientMetrics } from "@/lib/supabase/patients";
import type { PatientMetrics } from "@/lib/types";

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
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={15} className={iconColor} />
        </div>
      </div>
      {loading ? (
        <div className="h-7 w-12 bg-slate-100 rounded animate-pulse" />
      ) : (
        <p className="text-[26px] font-bold text-slate-900 leading-none">{value.toLocaleString()}</p>
      )}
    </div>
  );
}

export function PatientMetricsBar() {
  const [metrics, setMetrics] = useState<PatientMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPatientMetrics()
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: "Total patients",
      value: metrics?.total ?? 0,
      icon: Users,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
    },
    {
      label: "Active",
      value: metrics?.active ?? 0,
      icon: UserCheck,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
    {
      label: "Inactive",
      value: metrics?.inactive ?? 0,
      icon: UserX,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
    },
    {
      label: "New this month",
      value: metrics?.thisMonth ?? 0,
      icon: UserPlus,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  );
}
