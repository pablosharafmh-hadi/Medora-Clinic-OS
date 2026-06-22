"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  Users,
  CalendarCheck,
  CreditCard,
  UserCog,
  Clock,
  AlertTriangle,
  CheckCheck,
  X,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  generateScheduledAlerts,
} from "@/lib/supabase/notifications";
import type { Notification, NotificationCategory } from "@/lib/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getRelatedLink(n: Notification): string | null {
  if (!n.related_id || !n.related_type) return null;
  switch (n.related_type) {
    case "patient":     return `/patients/${n.related_id}`;
    case "appointment": return `/appointments/${n.related_id}`;
    case "invoice":     return `/finance/invoices/${n.related_id}`;
    case "doctor":      return `/doctors`;
    case "staff":       return `/staff`;
    default:            return null;
  }
}

const CATEGORY_STYLE: Record<NotificationCategory, { Icon: React.ElementType; bg: string; color: string; label: string }> = {
  patient:     { Icon: Users,         bg: "bg-blue-50",    color: "text-blue-600",    label: "Patient" },
  appointment: { Icon: CalendarCheck, bg: "bg-violet-50",  color: "text-violet-600",  label: "Appointment" },
  billing:     { Icon: CreditCard,    bg: "bg-emerald-50", color: "text-emerald-600", label: "Billing" },
  staff:       { Icon: UserCog,       bg: "bg-purple-50",  color: "text-purple-600",  label: "Staff" },
  reminder:    { Icon: Clock,         bg: "bg-amber-50",   color: "text-amber-600",   label: "Reminder" },
  alert:       { Icon: AlertTriangle, bg: "bg-red-50",     color: "text-red-600",     label: "Alert" },
};

const PRIORITY_COLORS: Record<string, { dot: string; label: string; text: string }> = {
  urgent: { dot: "bg-red-500",    label: "Urgent",  text: "text-red-600" },
  high:   { dot: "bg-amber-500",  label: "High",    text: "text-amber-600" },
  normal: { dot: "bg-slate-400",  label: "Normal",  text: "text-slate-500" },
  low:    { dot: "bg-slate-300",  label: "Low",     text: "text-slate-400" },
};

type FilterTab = "all" | "unread" | NotificationCategory;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all",         label: "All" },
  { value: "unread",      label: "Unread" },
  { value: "patient",     label: "Patient" },
  { value: "appointment", label: "Appointment" },
  { value: "billing",     label: "Billing" },
  { value: "staff",       label: "Staff" },
  { value: "reminder",    label: "Reminders" },
];

// ─── page ────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingAlerts, setGeneratingAlerts] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 25;

  const load = useCallback(async (tab: FilterTab, off: number, append = false) => {
    const filters = {
      status:   tab === "unread" ? ("unread" as const) : ("all" as const),
      category: (tab !== "all" && tab !== "unread" ? tab : "all") as NotificationCategory | "all",
      limit: PAGE_SIZE,
      offset: off,
    };

    const { data, count } = await getNotifications(filters);
    const [uc] = await Promise.all([getUnreadCount()]);
    setUnreadCount(uc);
    setTotalCount(count);
    setNotifications((prev) => (append ? [...prev, ...data] : data));
    setHasMore(off + data.length < count);
  }, []);

  // On mount: generate alerts first, then load
  useEffect(() => {
    setGeneratingAlerts(true);
    generateScheduledAlerts()
      .catch(console.error)
      .finally(async () => {
        setGeneratingAlerts(false);
        setLoading(true);
        await load("all", 0);
        setLoading(false);
      });
  }, [load]);

  const handleTabChange = async (tab: FilterTab) => {
    setActiveTab(tab);
    setOffset(0);
    setLoading(true);
    await load(tab, 0);
    setLoading(false);
  };

  const handleLoadMore = async () => {
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    await load(activeTab, nextOffset, true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await generateScheduledAlerts().catch(console.error);
    await load(activeTab, 0);
    setOffset(0);
    setRefreshing(false);
  };

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleDismiss = async (id: string) => {
    await dismissNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotalCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" as const })));
    setUnreadCount(0);
  };

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-5">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="flex items-center justify-center h-6 px-2 bg-blue-600 text-white text-[11px] font-bold rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || generatingAlerts}
            className="flex items-center gap-2 h-8 px-3 text-[12px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing || generatingAlerts ? "animate-spin" : ""} />
            {generatingAlerts ? "Checking alerts…" : "Refresh"}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 h-8 px-3 text-[12px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <CheckCheck size={13} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {FILTER_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleTabChange(value)}
            className={cn(
              "flex-shrink-0 h-8 px-3 text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap",
              activeTab === value
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {label}
            {value === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 bg-white/20 rounded-full text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-2/5" />
                  <div className="h-3 bg-slate-100 rounded w-3/5" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Bell size={22} className="text-slate-300" />
            </div>
            <p className="text-[14px] font-semibold text-slate-700">
              {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="text-[12px] text-slate-400 mt-1.5 max-w-xs leading-relaxed">
              {activeTab === "unread"
                ? "You're all caught up. New activity will appear here."
                : "System events, alerts, and reminders will appear here as your clinic operates."}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              {notifications.map((n) => {
                const style     = CATEGORY_STYLE[n.category] ?? CATEGORY_STYLE.alert;
                const Icon      = style.Icon;
                const priority  = PRIORITY_COLORS[n.priority];
                const relLink   = getRelatedLink(n);
                const isUnread  = n.status === "unread";
                const isUrgent  = n.priority === "urgent" || n.priority === "high";

                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-4 px-5 py-4 transition-colors group",
                      isUnread ? "bg-blue-50/20" : "bg-white hover:bg-slate-50/40",
                      isUrgent && isUnread && "bg-amber-50/20"
                    )}
                  >
                    {/* Category icon */}
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", style.bg)}>
                      <Icon size={15} className={style.color} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={cn(
                              "text-[13px] leading-snug",
                              isUnread ? "font-semibold text-slate-900" : "font-medium text-slate-700"
                            )}>
                              {n.title}
                            </p>
                            {isUnread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          {n.body && (
                            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{n.body}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
                              style.color
                            )}>
                              {style.label}
                            </span>
                            <span className="text-slate-300">·</span>
                            <div className="flex items-center gap-1">
                              <div className={cn("w-1.5 h-1.5 rounded-full", priority.dot)} />
                              <span className={cn("text-[11px] font-medium", priority.text)}>{priority.label}</span>
                            </div>
                            <span className="text-slate-300">·</span>
                            <span className="text-[11px] text-slate-400">{timeAgo(n.created_at)}</span>
                            {relLink && (
                              <>
                                <span className="text-slate-300">·</span>
                                <Link
                                  href={relLink}
                                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                  View record
                                  <ChevronRight size={10} />
                                </Link>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isUnread && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              title="Mark as read"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <CheckCheck size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDismiss(n.id)}
                            title="Dismiss"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="px-5 py-4 border-t border-slate-100 text-center">
                <button
                  onClick={handleLoadMore}
                  className="text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Load more notifications
                </button>
              </div>
            )}

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-[11px] text-slate-400">
                Showing {notifications.length} of {totalCount} notification{totalCount !== 1 ? "s" : ""}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
