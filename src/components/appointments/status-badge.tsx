import { cn } from "@/lib/utils";
import type { AppointmentStatus, AppointmentType } from "@/lib/types";

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled:   { label: "Scheduled",   className: "bg-slate-100 text-slate-600 border-slate-200" },
  confirmed:   { label: "Confirmed",   className: "bg-blue-50 text-blue-700 border-blue-200" },
  checked_in:  { label: "Checked In",  className: "bg-violet-50 text-violet-700 border-violet-200" },
  in_progress: { label: "In Progress", className: "bg-amber-50 text-amber-700 border-amber-200" },
  completed:   { label: "Completed",   className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled:   { label: "Cancelled",   className: "bg-red-50 text-red-600 border-red-200" },
  no_show:     { label: "No Show",     className: "bg-slate-100 text-slate-500 border-slate-200" },
};

const TYPE_CONFIG: Record<AppointmentType, { label: string; dot: string }> = {
  consultation: { label: "Consultation", dot: "bg-blue-500" },
  follow_up:    { label: "Follow-Up",    dot: "bg-violet-500" },
  procedure:    { label: "Procedure",    dot: "bg-amber-500" },
  check_up:     { label: "Check-Up",     dot: "bg-emerald-500" },
  emergency:    { label: "Emergency",    dot: "bg-red-500" },
  custom:       { label: "Custom",       dot: "bg-slate-400" },
};

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: AppointmentStatus;
  size?: "sm" | "xs";
}) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-px text-[10px]",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

export function TypeBadge({
  type,
  customLabel,
}: {
  type: AppointmentType;
  customLabel?: string | null;
}) {
  const config = TYPE_CONFIG[type];
  const label = type === "custom" && customLabel ? customLabel : config.label;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", config.dot)} />
      <span className="text-[12px] text-slate-700">{label}</span>
    </span>
  );
}

export { STATUS_CONFIG, TYPE_CONFIG };
