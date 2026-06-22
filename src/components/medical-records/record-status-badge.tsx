import { cn } from "@/lib/utils";
import type { MedicalRecordStatus } from "@/lib/types";

const STATUS_CONFIG: Record<MedicalRecordStatus, { label: string; className: string }> = {
  draft:   { label: "Draft",   className: "bg-amber-50 text-amber-700 border-amber-200" },
  final:   { label: "Final",   className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  amended: { label: "Amended", className: "bg-blue-50 text-blue-700 border-blue-200" },
};

interface Props {
  status: MedicalRecordStatus;
  className?: string;
}

export function RecordStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
