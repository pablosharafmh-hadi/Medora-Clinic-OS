"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  Users,
  CalendarCheck,
  CreditCard,
  CheckCircle2,
  Stethoscope,
  Package,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  getDateBounds,
  getPreviousPeriodBounds,
  getAnalyticsSummary,
  getRevenueTrend,
  getMonthlyRevenue,
  getAppointmentStatusBreakdown,
  getAppointmentTrend,
  getPatientGrowth,
  getDoctorPerformance,
  getServicePerformance,
  getPaymentMethodBreakdown,
  type DateRangeOption,
  type AnalyticsSummary,
  type RevenueTrendPoint,
  type MonthlyRevenuePoint,
  type StatusPoint,
  type AppointmentTrendPoint,
  type PatientGrowthPoint,
  type DoctorStat,
  type ServiceStat,
  type PaymentMethodPoint,
} from "@/lib/supabase/analytics";

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatCurrencyFull(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function formatAxisCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <div className="animate-pulse bg-slate-100 rounded-2xl" style={{ height }} />;
}

function SectionCard({
  title, subtitle, children, className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden", className)}>
      <div className="px-5 py-4 border-b border-slate-50">
        <h3 className="text-[13px] font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyChart({ message = "No data for this period" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[220px] gap-2 text-center">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
        <AlertCircle size={16} className="text-slate-300" />
      </div>
      <p className="text-[12px] text-slate-400">{message}</p>
    </div>
  );
}

// Custom recharts tooltips
interface TooltipItem { name: string; value: number; color: string }
interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  formatter?: (value: number) => string;
}

function ChartTooltip({ active, payload, label, formatter = String }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-[12px]">
      {label && <p className="font-semibold text-slate-600 mb-1.5">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="font-bold" style={{ color: entry.color }}>
          {entry.name}: {formatter(entry.value)}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-[12px]">
      <p className="font-semibold text-slate-700">{payload[0].name}</p>
      <p className="text-slate-500">{payload[0].value} appointment{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, iconBg, iconColor, label, value, prevValue, format = String, href,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  prevValue?: number;
  format?: (v: number) => string;
  href?: string;
}) {
  const pct = prevValue !== undefined ? pctChange(value, prevValue) : null;
  const up  = pct !== null && pct > 0;
  const dn  = pct !== null && pct < 0;

  const content = (
    <div className={cn(
      "bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group",
      href && "cursor-pointer hover:border-blue-200 hover:shadow-md transition-all duration-150"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", iconBg)}>
          <Icon size={16} className={iconColor} />
        </div>
        {href && (
          <ArrowUpRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
        )}
      </div>
      <p className="text-[24px] font-bold text-slate-900 leading-none">{format(value)}</p>
      <p className="text-[11px] text-slate-500 mt-1.5">{label}</p>
      {pct !== null && (
        <div className={cn("flex items-center gap-1 mt-2 text-[11px] font-semibold",
          up ? "text-emerald-600" : dn ? "text-red-500" : "text-slate-400"
        )}>
          {up ? <TrendingUp size={11} /> : dn ? <TrendingDown size={11} /> : <Minus size={11} />}
          {pct !== 0 ? `${Math.abs(pct)}% vs prior period` : "No change"}
        </div>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

// ─── Data types ───────────────────────────────────────────────────────────────

interface AnalyticsData {
  summary:        AnalyticsSummary;
  prevSummary:    AnalyticsSummary;
  revenueTrend:   RevenueTrendPoint[];
  monthlyRevenue: MonthlyRevenuePoint[];
  statusBreakdown: StatusPoint[];
  aptTrend:       AppointmentTrendPoint[];
  patientGrowth:  PatientGrowthPoint[];
  doctorStats:    DoctorStat[];
  serviceStats:   ServiceStat[];
  paymentMethods: PaymentMethodPoint[];
}

// ─── Sort state for doctor table ──────────────────────────────────────────────

type DoctorSortKey = keyof Pick<DoctorStat, "total" | "completed" | "completion_rate" | "revenue" | "patients_seen">;

// ─── Page ─────────────────────────────────────────────────────────────────────

const DATE_RANGES: { value: DateRangeOption; label: string }[] = [
  { value: "7d",        label: "7 days" },
  { value: "30d",       label: "30 days" },
  { value: "90d",       label: "90 days" },
  { value: "thisMonth", label: "This month" },
  { value: "thisYear",  label: "This year" },
  { value: "allTime",   label: "All time" },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash:         "Cash",
  credit_card:  "Credit Card",
  bank_transfer:"Bank Transfer",
  insurance:    "Insurance",
  other:        "Other",
};

const PAYMENT_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#94a3b8"];

export default function ReportsPage() {
  const [range,   setRange]   = useState<DateRangeOption>("30d");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [doctorSort, setDoctorSort] = useState<DoctorSortKey>("total");
  const [doctorSortAsc, setDoctorSortAsc] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const loadData = useCallback(async (r: DateRangeOption) => {
    setLoading(true);
    const { from, to }         = getDateBounds(r);
    const { from: pFrom, to: pTo } = getPreviousPeriodBounds(r);

    const [
      summary, prevSummary,
      revenueTrend, monthlyRevenue,
      statusBreakdown, aptTrend,
      patientGrowth,
      doctorStats, serviceStats, paymentMethods,
    ] = await Promise.all([
      getAnalyticsSummary(from, to),
      getAnalyticsSummary(pFrom, pTo),
      getRevenueTrend(from, to),
      getMonthlyRevenue(12),
      getAppointmentStatusBreakdown(from, to),
      getAppointmentTrend(from, to),
      getPatientGrowth(12),
      getDoctorPerformance(from, to),
      getServicePerformance(from, to),
      getPaymentMethodBreakdown(from, to),
    ]);

    setData({
      summary, prevSummary,
      revenueTrend, monthlyRevenue,
      statusBreakdown, aptTrend,
      patientGrowth,
      doctorStats, serviceStats, paymentMethods,
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(range); }, [range, loadData]);

  const sortedDoctors = data
    ? [...data.doctorStats].sort((a, b) =>
        doctorSortAsc ? a[doctorSort] - b[doctorSort] : b[doctorSort] - a[doctorSort]
      )
    : [];

  const toggleSort = (key: DoctorSortKey) => {
    if (doctorSort === key) setDoctorSortAsc((v) => !v);
    else { setDoctorSort(key); setDoctorSortAsc(false); }
  };

  const SortTh = ({ col, label }: { col: DoctorSortKey; label: string }) => (
    <th
      onClick={() => toggleSort(col)}
      className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 transition-colors select-none"
    >
      <span className="flex items-center justify-end gap-1">
        {label}
        {doctorSort === col && (
          <span className="text-blue-500">{doctorSortAsc ? "↑" : "↓"}</span>
        )}
      </span>
    </th>
  );

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[12px] font-semibold text-slate-500">Period:</p>
        {DATE_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setRange(value)}
            className={cn(
              "h-8 px-3 text-[12px] font-medium rounded-lg transition-colors",
              range === value
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {label}
          </button>
        ))}
        {loading && (
          <div className="flex items-center gap-1.5 ml-2 text-[11px] text-slate-400">
            <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
            Updating…
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {loading || !data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse">
              <div className="w-9 h-9 bg-slate-100 rounded-xl mb-3" />
              <div className="h-7 bg-slate-100 rounded w-24 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-32" />
            </div>
          ))
        ) : (
          <>
            <KpiCard
              icon={CreditCard}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              label="Revenue (period)"
              value={data.summary.total_revenue}
              prevValue={data.prevSummary.total_revenue}
              format={formatCurrency}
              href="/finance"
            />
            <KpiCard
              icon={CalendarCheck}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
              label="Appointments (period)"
              value={data.summary.total_appointments}
              prevValue={data.prevSummary.total_appointments}
              href="/appointments"
            />
            <KpiCard
              icon={Users}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              label="New patients (period)"
              value={data.summary.new_patients}
              prevValue={data.prevSummary.new_patients}
              href="/patients"
            />
            <KpiCard
              icon={CheckCircle2}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              label="Completion rate"
              value={data.summary.completion_rate}
              prevValue={data.prevSummary.completion_rate}
              format={(v) => `${v}%`}
            />
          </>
        )}
      </div>

      {/* Revenue section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Revenue trend */}
        <SectionCard
          className="xl:col-span-2"
          title="Revenue trend"
          subtitle="Collected payments in the selected period"
        >
          {loading || !mounted ? (
            <ChartSkeleton />
          ) : !data || data.revenueTrend.every((p) => p.revenue === 0) ? (
            <EmptyChart message="No revenue recorded in this period" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.revenueTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatAxisCurrency}
                  width={52}
                />
                <Tooltip content={<ChartTooltip formatter={formatCurrencyFull} />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#revGrad)"
                  name="Revenue"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#3b82f6" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Payment methods */}
        <SectionCard
          title="Payment methods"
          subtitle="Revenue breakdown by payment type"
        >
          {loading || !mounted ? (
            <ChartSkeleton />
          ) : !data || data.paymentMethods.length === 0 ? (
            <EmptyChart message="No payments recorded in this period" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data.paymentMethods}
                    dataKey="amount"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data.paymentMethods.map((_, i) => (
                      <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {data.paymentMethods.map((m, i) => (
                  <div key={m.method} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                      <span className="text-slate-600">{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</span>
                    </div>
                    <span className="font-semibold text-slate-800">{formatCurrencyFull(m.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* Monthly revenue bar */}
      <SectionCard title="Monthly revenue" subtitle="Last 12 months — collected payments">
        {loading || !mounted ? (
          <ChartSkeleton height={220} />
        ) : !data || data.monthlyRevenue.every((p) => p.revenue === 0) ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.monthlyRevenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={formatAxisCurrency} width={52} />
              <Tooltip content={<ChartTooltip formatter={formatCurrencyFull} />} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Appointments section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Appointment trend */}
        <SectionCard
          className="xl:col-span-2"
          title="Appointment trend"
          subtitle="Total and completed appointments in the selected period"
        >
          {loading || !mounted ? (
            <ChartSkeleton />
          ) : !data || data.aptTrend.every((p) => p.total === 0) ? (
            <EmptyChart message="No appointments in this period" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.aptTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <Tooltip content={<ChartTooltip formatter={String} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="total"     name="Total"     fill="#e0e7ff" radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="completed" name="Completed" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Appointment status */}
        <SectionCard title="Appointment status" subtitle="Distribution in the selected period">
          {loading || !mounted ? (
            <ChartSkeleton />
          ) : !data || data.statusBreakdown.length === 0 ? (
            <EmptyChart message="No appointment data" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data.statusBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data.statusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {data.statusBreakdown.map((s) => {
                  const total = data.statusBreakdown.reduce((sum, x) => sum + x.value, 0);
                  const pct   = total > 0 ? Math.round((s.value / total) * 100) : 0;
                  return (
                    <div key={s.name} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        <span className="text-slate-600">{s.name}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{s.value} <span className="font-normal text-slate-400">({pct}%)</span></span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* Patient growth */}
      <SectionCard title="Patient growth" subtitle="New patient registrations — last 12 months">
        {loading || !mounted ? (
          <ChartSkeleton height={220} />
        ) : !data || data.patientGrowth.every((p) => p.new_patients === 0) ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.patientGrowth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
              <Tooltip content={<ChartTooltip formatter={String} />} />
              <Bar dataKey="new_patients" name="New Patients" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Doctor performance */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
              <Stethoscope size={14} className="text-slate-400" />
              Doctor performance
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Appointments and revenue within selected period · Click headers to sort</p>
          </div>
          <Link href="/doctors" className="text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
            Manage doctors →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Doctor</th>
                <SortTh col="total"           label="Appointments" />
                <SortTh col="completed"       label="Completed" />
                <SortTh col="completion_rate" label="Rate %" />
                <SortTh col="patients_seen"   label="Patients seen" />
                <SortTh col="revenue"         label="Revenue" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-slate-100 rounded w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sortedDoctors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className="text-[12px] text-slate-400">No doctor data for this period</p>
                  </td>
                </tr>
              ) : (
                sortedDoctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Stethoscope size={13} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{doc.name}</p>
                          <p className="text-[11px] text-slate-400">{doc.specialty}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold text-slate-800">{doc.total}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-emerald-700 font-medium">{doc.completed}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", doc.completion_rate >= 80 ? "bg-emerald-500" : doc.completion_rate >= 60 ? "bg-amber-400" : "bg-red-400")}
                            style={{ width: `${doc.completion_rate}%` }}
                          />
                        </div>
                        <span className={cn("text-[12px] font-semibold",
                          doc.completion_rate >= 80 ? "text-emerald-700" : doc.completion_rate >= 60 ? "text-amber-700" : "text-red-600"
                        )}>{doc.completion_rate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] text-slate-600">{doc.patients_seen}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold text-slate-800">{formatCurrencyFull(doc.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && sortedDoctors.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-100 bg-slate-50/40">
                  <td className="px-4 py-3 text-[11px] font-semibold text-slate-500">Total</td>
                  <td className="px-4 py-3 text-right text-[12px] font-bold text-slate-800">
                    {sortedDoctors.reduce((s, d) => s + d.total, 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] font-bold text-emerald-700">
                    {sortedDoctors.reduce((s, d) => s + d.completed, 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] font-bold text-slate-800">
                    {sortedDoctors.length > 0
                      ? Math.round(sortedDoctors.reduce((s, d) => s + d.completion_rate, 0) / sortedDoctors.length)
                      : 0}%
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] text-slate-600">—</td>
                  <td className="px-4 py-3 text-right text-[12px] font-bold text-slate-800">
                    {formatCurrencyFull(sortedDoctors.reduce((s, d) => s + d.revenue, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Service performance */}
      <SectionCard
        title="Service performance"
        subtitle="Top 10 services by bookings within selected period"
      >
        {loading || !mounted ? (
          <ChartSkeleton height={280} />
        ) : !data || data.serviceStats.length === 0 ? (
          <EmptyChart message="No service data for this period. Ensure appointments have services selected." />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Horizontal bar chart */}
            <ResponsiveContainer width="100%" height={Math.max(200, data.serviceStats.length * 36)}>
              <BarChart
                data={data.serviceStats}
                layout="vertical"
                margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip content={<ChartTooltip formatter={String} />} />
                <Bar dataKey="bookings" name="Bookings" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>

            {/* Service revenue table */}
            <div>
              <div className="flex text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 pb-2 border-b border-slate-100">
                <span className="flex-1">Service</span>
                <span className="w-16 text-center">Bookings</span>
                <span className="w-24 text-right">Revenue</span>
                <span className="w-20 text-right">Avg / visit</span>
              </div>
              <div className="space-y-0">
                {data.serviceStats.map((s, i) => (
                  <div
                    key={s.name}
                    className="flex items-center py-2.5 px-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/40 transition-colors text-[12px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: `${["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"][i % 5]}20` }}
                        >
                          <Package size={10} style={{ color: ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"][i % 5] }} />
                        </div>
                        <span className="font-medium text-slate-700 truncate">{s.name}</span>
                      </div>
                    </div>
                    <span className="w-16 text-center text-slate-500">{s.bookings}</span>
                    <span className="w-24 text-right font-semibold text-slate-800">{formatCurrencyFull(s.revenue)}</span>
                    <span className="w-20 text-right text-slate-400">{s.avg_price > 0 ? formatCurrencyFull(s.avg_price) : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Financial summary strip */}
      {!loading && data && (
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Outstanding balance",
              value: formatCurrencyFull(data.summary.outstanding_balance),
              sub: "Across pending & overdue invoices",
              color: data.summary.outstanding_balance > 0 ? "text-red-600" : "text-emerald-600",
            },
            {
              label: "Appointments cancelled",
              value: String(data.summary.total_appointments - data.summary.completed_appointments - Math.max(0, data.statusBreakdown.find(s => s.name === "Scheduled")?.value ?? 0)),
              sub: "Cancelled + no-show in period",
              color: "text-amber-600",
            },
            {
              label: "Avg revenue / appointment",
              value: data.summary.completed_appointments > 0
                ? formatCurrencyFull(data.summary.total_revenue / data.summary.completed_appointments)
                : "—",
              sub: "Revenue ÷ completed appointments",
              color: "text-blue-600",
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-[11px] text-slate-400 font-medium">{label}</p>
              <p className={cn("text-[22px] font-bold mt-1 leading-none", color)}>{value}</p>
              <p className="text-[10px] text-slate-400 mt-1.5">{sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
