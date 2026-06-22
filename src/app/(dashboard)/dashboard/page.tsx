import Link from "next/link";
import {
  Users,
  Stethoscope,
  CalendarCheck,
  CreditCard,
  FileText,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bell,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { TodaySchedule } from "@/components/appointments/today-schedule";
import { getPatientMetrics } from "@/lib/supabase/patients";
import { getAppointmentMetrics, getAppointmentDailySnapshot } from "@/lib/supabase/appointments";
import { getAllDoctors } from "@/lib/supabase/doctors";
import { getFinancialMetrics } from "@/lib/supabase/invoices";
import { getUnreadCount, getRecentUnread } from "@/lib/supabase/notifications";
import type { Notification, NotificationCategory } from "@/lib/types";
import { formatCurrency } from "@/components/finance/invoice-status-badge";

const quickActions = [
  { icon: Users,         label: "Add Patient",           desc: "Register a new patient to your clinic",    href: "/patients/new",     iconBg: "bg-blue-50",    iconColor: "text-blue-600"    },
  { icon: Stethoscope,   label: "Add Doctor",            desc: "Onboard a doctor or specialist",            href: "/doctors",           iconBg: "bg-violet-50",  iconColor: "text-violet-600"  },
  { icon: CalendarCheck, label: "Schedule Appointment",  desc: "Book a patient visit with a doctor",        href: "/appointments/new", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { icon: FileText,      label: "Create Medical Record", desc: "Document a clinical visit or finding",      href: "/medical-records",  iconBg: "bg-amber-50",   iconColor: "text-amber-600"   },
];

const CATEGORY_STYLE: Record<NotificationCategory, { bg: string; color: string }> = {
  patient:     { bg: "bg-blue-50",    color: "text-blue-600"    },
  appointment: { bg: "bg-violet-50",  color: "text-violet-600"  },
  billing:     { bg: "bg-emerald-50", color: "text-emerald-600" },
  staff:       { bg: "bg-purple-50",  color: "text-purple-600"  },
  reminder:    { bg: "bg-amber-50",   color: "text-amber-600"   },
  alert:       { bg: "bg-red-50",     color: "text-red-600"     },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function DashboardPage() {
  const [patientMetrics, aptMetrics, snapshot, doctors, financialMetrics, unreadCount, recentAlerts] =
    await Promise.all([
      getPatientMetrics(),
      getAppointmentMetrics(),
      getAppointmentDailySnapshot(),
      getAllDoctors(),
      getFinancialMetrics(),
      getUnreadCount(),
      getRecentUnread(4),
    ]);

  const activeDoctors = doctors.filter((d) => d.status === "active").length;
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-5 max-w-7xl">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          title="Total Patients"
          icon={Users}
          color="blue"
          value={patientMetrics.total}
          emptyText="No patients registered yet"
          actionLabel="Add first patient"
          actionHref="/patients/new"
        />
        <StatCard
          title="Today's Appointments"
          icon={CalendarCheck}
          color="violet"
          value={aptMetrics.today}
          emptyText="No appointments today"
          actionLabel="Schedule one"
          actionHref="/appointments/new"
        />
        <StatCard
          title="Active Doctors"
          icon={Stethoscope}
          color="indigo"
          value={activeDoctors}
          emptyText="No doctors registered"
          actionLabel="Add doctor"
          actionHref="/doctors"
        />
        <StatCard
          title="Today's Revenue"
          icon={CreditCard}
          color="emerald"
          value={formatCurrency(financialMetrics.revenueToday)}
          emptyText="No payments today"
          actionLabel="View finance"
          actionHref="/finance"
        />
        <StatCard
          title="Monthly Revenue"
          icon={CreditCard}
          color="amber"
          value={formatCurrency(financialMetrics.revenueThisMonth)}
          emptyText="No revenue this month"
          actionLabel="Record transaction"
          actionHref="/finance"
        />
      </div>

      {/* Operational Snapshot */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <div>
            <h2 className="text-[14px] font-bold text-slate-900 tracking-tight">Operational Snapshot</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Live clinical status for today</p>
          </div>
          <span className="text-[11px] font-medium text-slate-400">{todayLabel}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-50">
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={14} className="text-emerald-600" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em]">Completed Visits</p>
            </div>
            <p className="text-[32px] font-black text-slate-900 leading-none">{snapshot.completedToday}</p>
            <p className="text-[11px] text-slate-400 mt-1.5">Appointments finished today</p>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Clock size={14} className="text-violet-600" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em]">Pending Today</p>
            </div>
            <p className="text-[32px] font-black text-slate-900 leading-none">{snapshot.pendingToday}</p>
            <p className="text-[11px] text-slate-400 mt-1.5">Scheduled and awaiting</p>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <AlertCircle size={14} className="text-amber-600" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em]">Outstanding Balance</p>
            </div>
            <p className="text-[32px] font-black text-slate-900 leading-none tracking-tight">
              {formatCurrency(financialMetrics.outstandingBalance)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {financialMetrics.outstandingInvoicesCount} unpaid invoice{financialMetrics.outstandingInvoicesCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions + Today's Schedule */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <h3 className="text-[14px] font-bold text-slate-900">Quick Actions</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Common tasks, one click away</p>
          </div>
          <div className="divide-y divide-slate-50">
            {quickActions.map(({ icon: Icon, label, desc, href, iconBg, iconColor }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 transition-all duration-150 group"
              >
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150`}>
                  <Icon size={16} className={iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800">{label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                </div>
                <ArrowRight
                  size={14}
                  className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all duration-150 shrink-0"
                />
              </Link>
            ))}
          </div>
        </div>

        <TodaySchedule />
      </div>

      {/* Recent Alerts */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-slate-400" />
            <h3 className="text-[14px] font-bold text-slate-900">Recent Alerts</h3>
            {unreadCount > 0 && (
              <span className="flex items-center justify-center h-5 min-w-5 px-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <Link href="/notifications" className="text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
            View all →
          </Link>
        </div>

        {recentAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
              <Bell size={16} className="text-slate-300" />
            </div>
            <p className="text-[13px] font-semibold text-slate-700">All clear</p>
            <p className="text-[12px] text-slate-400 mt-1">System events and reminders will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {(recentAlerts as Notification[]).map((n) => {
              const style = CATEGORY_STYLE[n.category] ?? CATEGORY_STYLE.alert;
              return (
                <div key={n.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${style.bg}`}>
                    <Bell size={13} className={style.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 leading-snug">{n.title}</p>
                    {n.body && (
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-1">{n.body}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {(n.priority === "urgent" || n.priority === "high") && (
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-2" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
