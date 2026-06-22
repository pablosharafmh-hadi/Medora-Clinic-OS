"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarCheck,
  FileText,
  CreditCard,
  UserCog,
  BarChart3,
  Download,
  Settings,
  LogOut,
  Receipt,
  Package,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  sub?: { label: string; href: string; icon: React.ElementType }[];
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { label: "Dashboard",       href: "/dashboard",       icon: LayoutDashboard },
      { label: "Patients",        href: "/patients",        icon: Users },
      { label: "Doctors",         href: "/doctors",         icon: Stethoscope },
      { label: "Appointments",    href: "/appointments",    icon: CalendarCheck },
      { label: "Medical Records", href: "/medical-records", icon: FileText },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Finance",
        href: "/finance",
        icon: CreditCard,
        sub: [
          { label: "Invoices",         href: "/finance/invoices",  icon: Receipt },
          { label: "Service Catalog",  href: "/finance/services",  icon: Package },
        ],
      },
      { label: "Staff",          href: "/staff",          icon: UserCog },
      { label: "Notifications",  href: "/notifications",  icon: Bell },
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        sub: [
          { label: "Analytics",    href: "/reports",        icon: BarChart3 },
          { label: "Export Center", href: "/reports/export", icon: Download },
        ],
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");


  return (
    <aside className="flex flex-col w-[240px] min-h-screen bg-[#0A1628] border-r border-[#0F1E2E] shrink-0">

      {/* Brand area */}
      <div className="px-5 pt-7 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="relative w-[42px] h-[42px] shrink-0 rounded-xl bg-[#0D2039] border border-[#1A3352] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
            <Image
              src="/logo.png"
              alt="Medora"
              fill
              className="object-contain p-[9px]"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-[16px] tracking-[0.06em] leading-none">MEDORA</span>
            <span className="text-[#3A5570] text-[11px] tracking-[0.12em] font-medium uppercase mt-[5px] leading-none">Clinic OS</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] text-[#2D4B6E] uppercase tracking-[0.18em] font-bold px-2.5 mb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                const showSub = item.sub && pathname.startsWith(item.href);

                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-2.5 py-[9px] rounded-lg text-[13px] font-medium transition-all duration-150 group relative",
                        active
                          ? "bg-[#0F2A44] text-[#93C5FD]"
                          : "text-[#4A6A80] hover:bg-[#0C1F32] hover:text-[#8BA8BE]"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-blue-400 rounded-r-full" />
                      )}
                      <Icon
                        size={15}
                        className={cn(
                          "shrink-0 transition-colors",
                          active ? "text-blue-400" : "text-[#2A4560] group-hover:text-[#4A6A80]"
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>

                    {/* Sub-items (Finance sub-nav) */}
                    {showSub && item.sub && (
                      <div className="ml-4 mt-0.5 space-y-0.5 pl-2.5 border-l border-[#0F1E2E]">
                        {item.sub.map((sub) => {
                          const subActive = isActive(sub.href);
                          const SubIcon = sub.icon;
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className={cn(
                                "flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition-all duration-150 group relative",
                                subActive
                                  ? "bg-[#0F2A44] text-[#93C5FD]"
                                  : "text-[#3A5A70] hover:bg-[#0C1F32] hover:text-[#6A8A9E]"
                              )}
                            >
                              {subActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[14px] bg-blue-400 rounded-r-full" />
                              )}
                              <SubIcon
                                size={13}
                                className={cn(
                                  "shrink-0 transition-colors",
                                  subActive ? "text-blue-400" : "text-[#1E3A50] group-hover:text-[#3A5A70]"
                                )}
                              />
                              <span className="truncate">{sub.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: settings + user */}
      <div className="px-3 pt-3 pb-4 border-t border-[#0F1E2E] space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-2.5 py-[9px] rounded-lg text-[13px] font-medium transition-all duration-150 group relative",
            isActive("/settings")
              ? "bg-[#0F2A44] text-[#93C5FD]"
              : "text-[#4A6A80] hover:bg-[#0C1F32] hover:text-[#8BA8BE]"
          )}
        >
          {isActive("/settings") && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-blue-400 rounded-r-full" />
          )}
          <Settings
            size={15}
            className={cn(
              "shrink-0",
              isActive("/settings") ? "text-blue-400" : "text-[#2A4560] group-hover:text-[#4A6A80]"
            )}
          />
          <span>Settings</span>
        </Link>

        <div className="flex items-center gap-3 px-2.5 py-2.5 mt-1 rounded-xl bg-[#0C1E30] border border-[#102030]">
          <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold tracking-wide">AD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#8BA8BE] text-[12px] font-semibold leading-tight truncate">Admin User</p>
            <p className="text-[#2A4560] text-[10px] truncate mt-0.5">Administrator</p>
          </div>
          <button className="p-1 hover:bg-[#162B45] rounded-lg transition-colors" aria-label="Sign out">
            <LogOut size={12} className="text-[#2A4560] hover:text-[#4A6A80] transition-colors" />
          </button>
        </div>
      </div>
    </aside>
  );
}
