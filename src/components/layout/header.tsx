"use client";

import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearch } from "@/components/layout/global-search";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/patients": { title: "Patients", subtitle: "Manage patient records and clinical profiles" },
  "/doctors": { title: "Doctors", subtitle: "Medical staff, specialties, and schedules" },
  "/appointments": { title: "Appointments", subtitle: "Schedule and manage patient visits" },
  "/medical-records": { title: "Medical Records", subtitle: "Clinical documentation and patient history" },
  "/finance": { title: "Finance", subtitle: "Revenue, expenses, and financial reporting" },
  "/staff":         { title: "Staff",         subtitle: "Personnel, roles, and access management" },
  "/notifications": { title: "Notifications", subtitle: "Alerts, reminders, and system events" },
  "/reports":        { title: "Analytics",    subtitle: "Executive reports, charts, and performance trends" },
  "/reports/export": { title: "Export Center", subtitle: "Generate and export patient, doctor, financial, and appointment reports" },
  "/ai-assistant": { title: "AI Assistant", subtitle: "Intelligent clinical and operational support" },
  "/settings": { title: "Settings", subtitle: "Clinic configuration and system preferences" },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function Header() {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  const matchedKey = Object.keys(pageMeta).find(
    (key) => pathname === key || pathname.startsWith(key + "/")
  );
  const page = matchedKey ? pageMeta[matchedKey] : null;

  return (
    <header className="flex items-center justify-between h-[60px] px-6 bg-white border-b border-slate-100/80 shrink-0">

      {/* Left */}
      <div className="flex items-center min-w-0">
        {isDashboard ? (
          <div>
            <h1 className="text-[15px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">
              {getGreeting()}, Admin
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-none">
              {getFormattedDate()} &middot; Medora Clinic Operations Center
            </p>
          </div>
        ) : page ? (
          <div>
            <h1 className="text-[15px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">
              {page.title}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block leading-none">
              {page.subtitle}
            </p>
          </div>
        ) : (
          <h1 className="text-[15px] font-bold text-slate-900">Medora OS</h1>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 shrink-0">

        {/* Search */}
        <GlobalSearch />

        {/* Notifications */}
        <NotificationBell />

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* User menu */}
        <button className="flex items-center gap-2 h-8 pl-1.5 pr-2.5 hover:bg-slate-100 rounded-lg transition-all duration-150 group">
          <div className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-[9px] font-bold tracking-wide">AD</span>
          </div>
          <div className="hidden sm:flex flex-col items-start leading-none gap-0.5">
            <span className="text-[12px] font-semibold text-slate-700">Admin User</span>
            <span className="text-[10px] text-slate-400">Administrator</span>
          </div>
          <ChevronDown size={11} className="text-slate-400 hidden sm:block group-hover:text-slate-500 transition-colors" />
        </button>
      </div>
    </header>
  );
}
