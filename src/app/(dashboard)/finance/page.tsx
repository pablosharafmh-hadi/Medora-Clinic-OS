"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  FileText,
  CalendarCheck,
  Plus,
  ArrowRight,
  Receipt,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFinancialMetrics, getInvoices } from "@/lib/supabase/invoices";
import { InvoiceStatusBadge, formatCurrency } from "@/components/finance/invoice-status-badge";
import type { FinancialMetrics, InvoiceWithRelations } from "@/lib/types";

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[12px] font-semibold text-slate-500">{label}</p>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon size={16} className={iconColor} />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse" />
      ) : (
        <p className="text-[26px] font-bold text-slate-900 leading-none tracking-tight">{value}</p>
      )}
      {sub && !loading && (
        <p className="text-[11px] text-slate-400 mt-1.5">{sub}</p>
      )}
    </div>
  );
}

export default function FinancePage() {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<InvoiceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getFinancialMetrics(),
      getInvoices({ pageSize: 8 }),
    ]).then(([m, inv]) => {
      setMetrics(m);
      setRecentInvoices(inv.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const quickActions = [
    {
      icon: CalendarCheck,
      label: "New Appointment",
      desc: "Invoice is auto-generated on completion",
      href: "/appointments/new",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      icon: Receipt,
      label: "All Invoices",
      desc: "View and manage invoices",
      href: "/finance/invoices",
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      icon: Stethoscope,
      label: "Service Catalog",
      desc: "Manage billable services",
      href: "/finance/services",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
  ];

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Revenue today"
          value={metrics ? formatCurrency(metrics.revenueToday) : "$0.00"}
          sub="Payments received today"
          icon={DollarSign}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          loading={loading}
        />
        <MetricCard
          label="Revenue this month"
          value={metrics ? formatCurrency(metrics.revenueThisMonth) : "$0.00"}
          sub="Payments received this month"
          icon={TrendingUp}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          loading={loading}
        />
        <MetricCard
          label="Outstanding balance"
          value={metrics ? formatCurrency(metrics.outstandingBalance) : "$0.00"}
          sub={metrics ? `${metrics.outstandingInvoicesCount} unpaid invoices` : ""}
          icon={CreditCard}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          loading={loading}
        />
        <MetricCard
          label="Paid invoices"
          value={metrics ? String(metrics.paidInvoicesCount) : "0"}
          sub={metrics ? `of ${metrics.totalInvoicesCount} total` : ""}
          icon={FileText}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Quick actions */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-[14px] font-bold text-slate-900">Quick actions</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Billing tasks, one click away</p>
          </div>
          <div className="divide-y divide-slate-50">
            {quickActions.map(({ icon: Icon, label, desc, href, iconBg, iconColor }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-all duration-150 group"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150", iconBg)}>
                  <Icon size={16} className={iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800">{label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                </div>
                <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Revenue summary */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Revenue summary</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Payment collection overview</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-4 gap-4">
            {[
              {
                label: "Today",
                value: metrics ? formatCurrency(metrics.revenueToday) : "—",
                color: "text-slate-900",
              },
              {
                label: "This week",
                value: metrics ? formatCurrency(metrics.revenueThisWeek) : "—",
                color: "text-slate-900",
              },
              {
                label: "This month",
                value: metrics ? formatCurrency(metrics.revenueThisMonth) : "—",
                color: "text-slate-900",
              },
              {
                label: "This year",
                value: metrics ? formatCurrency(metrics.revenueThisYear) : "—",
                color: "text-blue-700",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[11px] text-slate-500 font-medium mb-1">{label}</p>
                {loading ? (
                  <div className="h-6 w-16 bg-slate-200 rounded animate-pulse" />
                ) : (
                  <p className={cn("text-[18px] font-bold leading-none", color)}>{value}</p>
                )}
              </div>
            ))}
            <div className="col-span-4 border-t border-slate-100 pt-4 grid grid-cols-3 gap-4">
              {[
                {
                  label: "Paid",
                  value: metrics ? String(metrics.paidInvoicesCount) : "0",
                  sub: "invoices",
                  color: "text-emerald-600",
                },
                {
                  label: "Outstanding",
                  value: metrics ? String(metrics.outstandingInvoicesCount) : "0",
                  sub: "invoices",
                  color: "text-amber-600",
                },
                {
                  label: "Balance due",
                  value: metrics ? formatCurrency(metrics.outstandingBalance) : "$0.00",
                  sub: "total",
                  color: "text-red-600",
                },
              ].map(({ label, value, sub, color }) => (
                <div key={label}>
                  <p className="text-[11px] text-slate-500 font-medium">{label}</p>
                  {loading ? (
                    <div className="h-5 w-12 bg-slate-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className={cn("text-[16px] font-bold mt-0.5", color)}>
                      {value}
                      <span className="text-[11px] font-normal text-slate-400 ml-1">{sub}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <div>
            <h3 className="text-[14px] font-bold text-slate-900">Recent invoices</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Latest billing activity</p>
          </div>
          <Link
            href="/finance/invoices"
            className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            View all
            <ArrowRight size={13} />
          </Link>
        </div>
        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="ml-auto h-4 w-16 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : recentInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <FileText size={20} className="text-slate-400" />
            </div>
            <p className="text-[13px] font-semibold text-slate-700">No invoices yet</p>
            <p className="text-[12px] text-slate-400 mt-1 max-w-xs">
              Create your first invoice to start tracking billing.
            </p>
            <Link
              href="/finance/invoices/new"
              className="mt-4 flex items-center gap-2 h-8 px-4 text-[12px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={13} />
              Create invoice
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/50">
                  {["Invoice #", "Patient", "Date", "Total", "Balance", "Status"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/finance/invoices/${inv.id}`}
                  >
                    <td className="px-5 py-3">
                      <span className="text-[12px] font-mono font-semibold text-slate-700">
                        {inv.invoice_number ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-slate-800">
                      {inv.patient
                        ? `${inv.patient.first_name} ${inv.patient.last_name}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-[12px] text-slate-500">
                      {new Date(inv.issue_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3 text-[13px] font-semibold text-slate-800">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="px-5 py-3 text-[13px] text-slate-600">
                      {formatCurrency(inv.balance_due)}
                    </td>
                    <td className="px-5 py-3">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
