"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, Stethoscope, CalendarCheck, UserCog, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type ResultItem = {
  id: string;
  label: string;
  sub: string;
  href: string;
  category: "patient" | "doctor" | "appointment" | "staff";
};

const CATEGORY_META = {
  patient:     { label: "Patients",     icon: Users,         color: "text-blue-600",   bg: "bg-blue-50"   },
  doctor:      { label: "Doctors",      icon: Stethoscope,   color: "text-indigo-600", bg: "bg-indigo-50" },
  appointment: { label: "Appointments", icon: CalendarCheck, color: "text-violet-600", bg: "bg-violet-50" },
  staff:       { label: "Staff",        icon: UserCog,       color: "text-emerald-600",bg: "bg-emerald-50"},
} as const;

async function runSearch(q: string): Promise<ResultItem[]> {
  const term = q.trim();
  if (!term) return [];

  const like = `%${term}%`;

  const [pats, docs, apts, staff] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name, patient_number, phone")
      .or(`first_name.ilike.${like},last_name.ilike.${like},patient_number.ilike.${like},phone.ilike.${like}`)
      .eq("status", "active")
      .limit(5),
    supabase
      .from("doctors")
      .select("id, first_name, last_name, specialty, license_number")
      .or(`first_name.ilike.${like},last_name.ilike.${like},specialty.ilike.${like},license_number.ilike.${like}`)
      .limit(5),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, service_name, patient_id, patients(first_name, last_name)")
      .or(`status.ilike.${like},service_name.ilike.${like}`)
      .order("scheduled_at", { ascending: false })
      .limit(5),
    supabase
      .from("staff")
      .select("id, first_name, last_name, role, email")
      .or(`first_name.ilike.${like},last_name.ilike.${like},role.ilike.${like},email.ilike.${like}`)
      .limit(5),
  ]);

  type PatRow = { id: string; first_name: string; last_name: string; patient_number: string | null; phone: string };
  type DocRow = { id: string; first_name: string; last_name: string; specialty: string; license_number: string };
  type AptRow = { id: string; scheduled_at: string; status: string; service_name: string | null; patient_id: string; patients: { first_name: string; last_name: string } | null };
  type StaffRow = { id: string; first_name: string; last_name: string; role: string; email: string };

  const results: ResultItem[] = [];

  for (const p of ((pats.data ?? []) as unknown as PatRow[])) {
    results.push({
      id: p.id,
      label: `${p.first_name} ${p.last_name}`,
      sub: [p.patient_number, p.phone].filter(Boolean).join(" · ") || "Patient",
      href: `/patients/${p.id}`,
      category: "patient",
    });
  }

  for (const d of ((docs.data ?? []) as unknown as DocRow[])) {
    results.push({
      id: d.id,
      label: `Dr. ${d.first_name} ${d.last_name}`,
      sub: `${d.specialty} · ${d.license_number}`,
      href: `/doctors`,
      category: "doctor",
    });
  }

  for (const a of ((apts.data ?? []) as unknown as AptRow[])) {
    const pat = a.patients;
    const patName = pat ? `${pat.first_name} ${pat.last_name}` : "Unknown patient";
    const date = new Date(a.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    results.push({
      id: a.id,
      label: a.service_name ? `${a.service_name} — ${patName}` : `Appointment — ${patName}`,
      sub: `${date} · ${a.status.replace(/_/g, " ")}`,
      href: `/appointments/${a.id}`,
      category: "appointment",
    });
  }

  for (const s of ((staff.data ?? []) as unknown as StaffRow[])) {
    results.push({
      id: s.id,
      label: `${s.first_name} ${s.last_name}`,
      sub: `${s.role.charAt(0).toUpperCase() + s.role.slice(1)} · ${s.email || "No email"}`,
      href: `/staff`,
      category: "staff",
    });
  }

  return results;
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSelected(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await runSearch(query);
        setResults(r);
        setSelected(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const navigate = (item: ResultItem) => {
    router.push(item.href);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) navigate(results[selected]);
  };

  const grouped = results.reduce<Record<string, ResultItem[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  return (
    <>
      {/* Trigger button in header */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-8 px-3 text-[12px] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 hover:text-slate-500 transition-all duration-150"
      >
        <Search size={13} />
        <span className="hidden md:inline font-medium">Search</span>
        <kbd className="hidden md:inline text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-400 font-mono ml-0.5">
          ⌘K
        </kbd>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search patients, doctors, appointments, staff…"
                className="flex-1 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
              />
              {loading && <Loader2 size={14} className="text-slate-400 animate-spin shrink-0" />}
              {query && !loading && (
                <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto">
              {!query.trim() ? (
                <div className="py-10 text-center text-[13px] text-slate-400">
                  Start typing to search across the clinic
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="py-10 text-center text-[13px] text-slate-400">
                  No results for &quot;{query}&quot;
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {(["patient", "doctor", "appointment", "staff"] as const).map((cat) => {
                    const items = grouped[cat];
                    if (!items?.length) return null;
                    const meta = CATEGORY_META[cat];
                    const Icon = meta.icon;
                    let flatIndex = 0;
                    for (const c of (["patient", "doctor", "appointment", "staff"] as const)) {
                      if (c === cat) break;
                      flatIndex += grouped[c]?.length ?? 0;
                    }
                    return (
                      <div key={cat}>
                        <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                          {meta.label}
                        </p>
                        {items.map((item, i) => {
                          const idx = flatIndex + i;
                          return (
                            <button
                              key={item.id}
                              onClick={() => navigate(item)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                                selected === idx ? "bg-blue-50" : "hover:bg-slate-50"
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                                <Icon size={13} className={meta.color} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-slate-800 truncate">{item.label}</p>
                                <p className="text-[11px] text-slate-400 truncate capitalize">{item.sub}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">↵</kbd> open</span>
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
