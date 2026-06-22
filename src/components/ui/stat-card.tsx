import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

type CardColor = "blue" | "violet" | "indigo" | "emerald" | "amber";

const COLORS: Record<CardColor, { accent: string; iconBg: string; iconColor: string }> = {
  blue:    { accent: "from-blue-500 to-blue-600",       iconBg: "bg-blue-50",    iconColor: "text-blue-600"    },
  violet:  { accent: "from-violet-500 to-violet-600",   iconBg: "bg-violet-50",  iconColor: "text-violet-600"  },
  indigo:  { accent: "from-indigo-500 to-indigo-600",   iconBg: "bg-indigo-50",  iconColor: "text-indigo-600"  },
  emerald: { accent: "from-emerald-500 to-emerald-600", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  amber:   { accent: "from-amber-500 to-amber-600",     iconBg: "bg-amber-50",   iconColor: "text-amber-600"   },
};

type Props = {
  title: string;
  icon: LucideIcon;
  color?: CardColor;
  iconColor?: string;
  iconBg?: string;
  value?: number | string;
  loading?: boolean;
  emptyText: string;
  actionLabel?: string;
  actionHref?: string;
};

export function StatCard({
  title,
  icon: Icon,
  color = "blue",
  iconColor: iconColorOverride,
  iconBg: iconBgOverride,
  value,
  loading = false,
  emptyText,
  actionLabel,
  actionHref,
}: Props) {
  const { accent, iconBg, iconColor } = COLORS[color];
  const resolvedIconBg    = iconBgOverride    ?? iconBg;
  const resolvedIconColor = iconColorOverride ?? iconColor;

  const isEmpty = value === undefined || value === null || value === 0 || value === "0";

  return (
    <div className="relative bg-white rounded-2xl border border-slate-100 p-5 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200">
      <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${accent}`} />

      <div className="flex items-start justify-between mb-3.5 pt-0.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] leading-tight">{title}</p>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", resolvedIconBg)}>
          <Icon size={15} className={resolvedIconColor} />
        </div>
      </div>

      {loading ? (
        <div className="h-9 w-20 bg-slate-100 rounded-lg animate-pulse mt-1" />
      ) : (
        <>
          <p className={cn(
            "text-[30px] font-black leading-none tracking-tight",
            isEmpty ? "text-slate-200" : "text-slate-900"
          )}>
            {value ?? 0}
          </p>
          {isEmpty && (
            <p className="text-[11px] text-slate-400 leading-snug mt-1.5">{emptyText}</p>
          )}
          {isEmpty && actionLabel && actionHref && (
            <Link
              href={actionHref}
              className="inline-flex items-center mt-2 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {actionLabel} →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
