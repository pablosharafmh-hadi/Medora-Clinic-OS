"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import {
  getRecentNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
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
  return `${days}d ago`;
}

const CATEGORY_STYLE: Record<NotificationCategory, { Icon: React.ElementType; bg: string; color: string }> = {
  patient:     { Icon: Users,         bg: "bg-blue-50",    color: "text-blue-600" },
  appointment: { Icon: CalendarCheck, bg: "bg-violet-50",  color: "text-violet-600" },
  billing:     { Icon: CreditCard,    bg: "bg-emerald-50", color: "text-emerald-600" },
  staff:       { Icon: UserCog,       bg: "bg-purple-50",  color: "text-purple-600" },
  reminder:    { Icon: Clock,         bg: "bg-amber-50",   color: "text-amber-600" },
  alert:       { Icon: AlertTriangle, bg: "bg-red-50",     color: "text-red-600" },
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-l-2 border-l-red-400",
  high:   "border-l-2 border-l-amber-400",
  normal: "",
  low:    "",
};

// ─── component ───────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);

  const loadData = useCallback(async () => {
    const [count, recent] = await Promise.all([
      getUnreadCount(),
      getRecentNotifications(8),
    ]);
    setUnreadCount(count);
    setNotifications(recent);
  }, []);

  useEffect(() => {
    loadData();

    // Poll every 30s as a reliable fallback
    const interval = setInterval(loadData, 30000);

    // Supabase Realtime subscription for instant updates
    const channel = supabase
      .channel("notification-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => { loadData(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        () => { loadData(); }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkAllRead = async () => {
    setMarking(true);
    await markAllAsRead();
    await loadData();
    setMarking(false);
  };

  const handleMarkOne = async (id: string) => {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-150"
        aria-label="Notifications"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center px-1 bg-blue-600 text-white text-[9px] font-bold rounded-full border border-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+8px)] w-[360px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="flex items-center justify-center h-5 min-w-5 px-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={marking}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                  <Bell size={16} className="text-slate-300" />
                </div>
                <p className="text-[12px] font-semibold text-slate-500">All caught up</p>
                <p className="text-[11px] text-slate-400">No new notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((n) => {
                  const style = CATEGORY_STYLE[n.category] ?? CATEGORY_STYLE.alert;
                  const Icon  = style.Icon;
                  const isUnread = n.status === "unread";
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60 group",
                        isUnread ? "bg-blue-50/30" : "bg-white",
                        PRIORITY_BORDER[n.priority]
                      )}
                    >
                      {/* Icon */}
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", style.bg)}>
                        <Icon size={13} className={style.color} />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[12px] leading-snug", isUnread ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {/* Mark read */}
                      {isUnread && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkOne(n.id); }}
                          className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 transition-colors flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100"
                          title="Mark as read"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/40">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              View all notifications
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
