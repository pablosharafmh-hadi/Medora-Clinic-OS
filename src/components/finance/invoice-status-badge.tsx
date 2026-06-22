import { cn } from "@/lib/utils";
import type { InvoiceStatus, PaymentMethod } from "@/lib/types";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft:          "bg-slate-100 text-slate-600",
  pending:        "bg-blue-50 text-blue-700",
  paid:           "bg-emerald-50 text-emerald-700",
  partially_paid: "bg-violet-50 text-violet-700",
  overdue:        "bg-red-50 text-red-700",
  cancelled:      "bg-slate-100 text-slate-400",
  refunded:       "bg-amber-50 text-amber-700",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:          "Draft",
  pending:        "Pending",
  paid:           "Paid",
  partially_paid: "Partial",
  overdue:        "Overdue",
  cancelled:      "Cancelled",
  refunded:       "Refunded",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:          "Cash",
  credit_card:   "Credit Card",
  bank_transfer: "Bank Transfer",
  insurance:     "Insurance",
  other:         "Other",
};

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
      {METHOD_LABELS[method]}
    </span>
  );
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
