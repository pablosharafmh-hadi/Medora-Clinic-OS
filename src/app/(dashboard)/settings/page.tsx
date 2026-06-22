import {
  Settings,
  Building2,
  Bell,
  Shield,
  Users,
  Palette,
  Database,
  Globe,
  ChevronRight,
} from "lucide-react";

const settingsSections = [
  {
    group: "Clinic",
    items: [
      { icon: Building2, title: "Clinic Profile", desc: "Name, address, contact, operating hours", badge: null },
      { icon: Globe,     title: "Localization",   desc: "Language, timezone, date format, currency", badge: null },
    ],
  },
  {
    group: "System",
    items: [
      { icon: Users,    title: "User Management",    desc: "Manage accounts, roles, and invitations",         badge: "Admin Only" },
      { icon: Shield,   title: "Security & Access",  desc: "Authentication, session policy, audit logs",      badge: "Admin Only" },
      { icon: Database, title: "Data & Integrations",desc: "Supabase, backups, and third-party connections",  badge: null },
    ],
  },
  {
    group: "Preferences",
    items: [
      { icon: Bell,    title: "Notifications", desc: "Email alerts, in-app notifications, reminders",  badge: null },
      { icon: Palette, title: "Appearance",    desc: "Theme, density, and display preferences",        badge: "Coming Soon" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      {settingsSections.map(({ group, items }) => (
        <div key={group}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-3 px-1">
            {group}
          </p>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
            {items.map(({ icon: Icon, title, desc, badge }) => (
              <button
                key={title}
                className="flex items-center gap-4 w-full px-5 py-4 hover:bg-slate-50/70 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-800">{title}</p>
                    {badge && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        badge === "Admin Only"
                          ? "bg-red-50 text-red-600 border border-red-100"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Version info */}
      <div className="flex items-center justify-between px-5 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0D1B2A] flex items-center justify-center shrink-0">
            <Settings size={15} className="text-blue-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-slate-800">Medora OS</p>
            <p className="text-[11px] text-slate-400">Phase 10 — Production Hardening</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-bold text-slate-700">v1.0.0</p>
          <p className="text-[10px] text-slate-400">Build 2026</p>
        </div>
      </div>
    </div>
  );
}
