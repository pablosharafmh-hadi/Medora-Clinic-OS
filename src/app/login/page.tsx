import Image from "next/image";
import Link from "next/link";
import { Shield, Zap, Lock } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-[#F0F4F8]">

      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 bg-[#0A1628] p-10 relative overflow-hidden">
        {/* Subtle ambient glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/8 rounded-full blur-2xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="relative w-9 h-9 shrink-0 rounded-[10px] bg-[#0F2236] border border-[#1E3450] flex items-center justify-center overflow-hidden">
              <Image src="/logo.png" alt="Medora" fill className="object-contain p-1" priority />
            </div>
            <div>
              <span className="text-white font-bold text-[15px] tracking-[0.08em]">MEDORA</span>
              <p className="text-[#2D4A66] text-[9px] tracking-[0.15em] font-semibold uppercase mt-0.5">Clinic OS</p>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-[28px] font-bold text-white leading-tight tracking-tight">
              Enterprise clinic<br />management.
            </h2>
            <p className="text-[#4A6680] text-[14px] mt-3 leading-relaxed max-w-[280px]">
              A unified operating system built for modern healthcare practices.
            </p>
          </div>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-4">
          {[
            { icon: Shield, label: "HIPAA-compliant infrastructure", sub: "End-to-end encrypted data" },
            { icon: Zap, label: "Real-time operations", sub: "Live appointments and workflows" },
            { icon: Lock, label: "Role-based access control", sub: "Granular staff permissions" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0F2236] border border-[#1E3450] flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={13} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#94A3B8] leading-tight">{label}</p>
                <p className="text-[11px] text-[#2D4A66] mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-[#162032] text-[11px] relative z-10 font-medium">
          © {new Date().getFullYear()} Medora Health Technologies
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="relative w-8 h-8 rounded-[9px] bg-[#0A1628] border border-[#1E3450] overflow-hidden flex items-center justify-center">
              <Image src="/logo.png" alt="Medora" fill className="object-contain p-1" />
            </div>
            <span className="font-bold text-slate-900 text-[15px] tracking-[0.06em]">MEDORA</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="mb-7">
              <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">
                Sign in to Medora OS
              </h1>
              <p className="text-[13px] text-slate-400 mt-1.5">
                Enter your credentials to access your clinic workspace.
              </p>
            </div>

            <form className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5 tracking-wide">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@clinic.com"
                  className="w-full h-10 px-3.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-semibold text-slate-600 tracking-wide">Password</label>
                  <a href="#" className="text-[12px] text-blue-600 hover:text-blue-700 font-medium">
                    Forgot?
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full h-10 px-3.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-0.5">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-3.5 h-3.5 accent-blue-600 rounded"
                />
                <label htmlFor="remember" className="text-[12px] text-slate-500 select-none">
                  Keep me signed in for 30 days
                </label>
              </div>

              <Link
                href="/dashboard"
                className="flex items-center justify-center w-full h-10 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[13px] font-semibold rounded-lg transition-colors mt-1 shadow-sm shadow-blue-200"
              >
                Sign in to workspace
              </Link>
            </form>

            <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5">
              <Lock size={11} className="text-slate-300" />
              <p className="text-[11px] text-slate-400">
                TLS encrypted ·{" "}
                <a href="#" className="text-blue-500 hover:text-blue-600">Privacy Policy</a>
              </p>
            </div>
          </div>

          <p className="text-center text-[12px] text-slate-400 mt-4">
            Need access?{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 font-semibold">
              Contact your administrator
            </a>
          </p>
        </div>
      </div>

    </div>
  );
}
