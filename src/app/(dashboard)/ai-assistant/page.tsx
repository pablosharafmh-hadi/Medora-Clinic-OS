"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  Trash2,
  ChevronDown,
  User,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "admin" | "manager" | "doctor" | "receptionist" | "nurse";
type MessageRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  error?: boolean;
}

const ROLE_OPTIONS: { value: Role; label: string; badge: string; badgeColor: string }[] = [
  { value: "admin",        label: "Administrator",   badge: "Full access",    badgeColor: "bg-blue-100 text-blue-700" },
  { value: "manager",      label: "Clinic Manager",  badge: "Full access",    badgeColor: "bg-blue-100 text-blue-700" },
  { value: "doctor",       label: "Doctor",          badge: "No financials",  badgeColor: "bg-violet-100 text-violet-700" },
  { value: "receptionist", label: "Receptionist",    badge: "Limited access", badgeColor: "bg-amber-100 text-amber-700" },
  { value: "nurse",        label: "Nurse",           badge: "Limited access", badgeColor: "bg-amber-100 text-amber-700" },
];

const SUGGESTED_QUESTIONS = [
  { label: "How many patients do we have?",                          category: "Patients" },
  { label: "What's on today's schedule?",                           category: "Appointments" },
  { label: "Which doctor has the most appointments this month?",    category: "Doctors" },
  { label: "How many appointments were cancelled this week?",       category: "Appointments" },
  { label: "What are our most popular services?",                   category: "Services" },
  { label: "What is our revenue for this month?",                   category: "Finance" },
  { label: "How many new patients did we get this week?",           category: "Patients" },
  { label: "What is our appointment completion rate this month?",   category: "Analytics" },
];

const CATEGORY_COLOR: Record<string, string> = {
  Patients:     "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  Appointments: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  Doctors:      "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  Services:     "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  Finance:      "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
  Analytics:    "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
};

// ─── Bold+newline renderer ────────────────────────────────────────────────────

function RenderContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <span>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={li}>
            {parts.map((part, pi) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={pi} className="font-semibold">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                <span key={pi}>{part}</span>
              )
            )}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </span>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 h-5 px-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "800ms" }}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
  const [role, setRole]         = useState<Role>("admin");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const roleRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      const history = [...messages, userMsg]
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: history.slice(0, -1),
            role,
          }),
        });

        const data = (await res.json()) as { message?: string; error?: string };

        if (!res.ok || data.error) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: data.error ?? "Something went wrong. Please try again.",
              error: true,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: data.message ?? "" },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "Unable to reach the AI assistant. Check your connection and API key, then try again.",
            error: true,
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, messages, role]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const currentRole = ROLE_OPTIONS.find((r) => r.value === role)!;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-sm">
            <Sparkles size={17} className="text-white" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-slate-900 leading-none">AI Clinical Assistant</h2>
            <p className="text-[11px] text-slate-400 mt-1 leading-none">
              Powered by real Medora data · Never hallucinates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">

          {/* Role selector */}
          <div ref={roleRef} className="relative">
            <button
              onClick={() => setRoleOpen((v) => !v)}
              className="flex items-center gap-2 h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-[12px] font-medium text-slate-700"
            >
              <User size={12} className="text-slate-400" />
              <span>{currentRole.label}</span>
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", currentRole.badgeColor)}>
                {currentRole.badge}
              </span>
              <ChevronDown size={11} className={cn("text-slate-400 transition-transform", roleOpen && "rotate-180")} />
            </button>

            {roleOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-100 rounded-2xl shadow-lg overflow-hidden z-20">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-2.5 pb-1.5">
                  Viewing as role
                </p>
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setRole(opt.value);
                      setRoleOpen(false);
                      clearChat();
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 text-[12px] hover:bg-slate-50 transition-colors",
                      role === opt.value ? "text-blue-700 bg-blue-50/50" : "text-slate-700"
                    )}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", opt.badgeColor)}>
                      {opt.badge}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear */}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors text-[12px] font-medium text-slate-500"
            >
              <Trash2 size={12} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2 pr-1">

        {/* Empty state / suggested questions */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200/50">
                <Sparkles size={26} className="text-white" />
              </div>
              <h3 className="text-[16px] font-bold text-slate-900">Ask about your clinic</h3>
              <p className="text-[13px] text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                I analyze live Medora data to answer operational questions — patients, appointments, revenue, and more.
              </p>
            </div>

            <div className="w-full max-w-2xl">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center mb-3">
                Suggested questions
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => sendMessage(q.label)}
                    disabled={loading}
                    className={cn(
                      "text-left px-4 py-3 rounded-xl border text-[12px] font-medium transition-all duration-150 hover:shadow-sm active:scale-[0.98]",
                      CATEGORY_COLOR[q.category] ?? "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-50 block mb-0.5">
                      {q.category}
                    </span>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            {msg.role === "assistant" && (
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm",
                  msg.error
                    ? "bg-red-100"
                    : "bg-gradient-to-br from-blue-600 to-violet-600"
                )}
              >
                {msg.error
                  ? <AlertCircle size={14} className="text-red-600" />
                  : <Sparkles size={14} className="text-white" />
                }
              </div>
            )}

            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm",
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-tr-sm"
                  : msg.error
                  ? "bg-red-50 text-red-800 border border-red-100 rounded-tl-sm"
                  : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm"
              )}
            >
              <RenderContent text={msg.content} />
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <User size={14} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Loading bubble */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
              <Loader2 size={14} className="text-white animate-spin" />
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 mt-3 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden focus-within:border-blue-400 focus-within:shadow-md transition-all duration-150">
        <div className="flex items-end gap-3 px-4 py-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about patients, appointments, revenue, doctors…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 outline-none leading-relaxed max-h-32 overflow-y-auto"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150",
              input.trim() && !loading
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            )}
          >
            <Send size={15} />
          </button>
        </div>
        <p className="px-4 pb-2.5 text-[10px] text-slate-300">
          Enter to send · Shift+Enter for new line · All answers come from live clinic data
        </p>
      </div>
    </div>
  );
}
