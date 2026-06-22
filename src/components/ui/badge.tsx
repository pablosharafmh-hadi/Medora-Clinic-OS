import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
};

const variantStyles: Record<Variant, string> = {
  default: "bg-blue-50 text-blue-700 border-blue-100",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  warning: "bg-amber-50 text-amber-700 border-amber-100",
  danger: "bg-red-50 text-red-700 border-red-100",
  info: "bg-cyan-50 text-cyan-700 border-cyan-100",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

export function Badge({ children, variant = "default", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
