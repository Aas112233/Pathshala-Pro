"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLogin } from "@/hooks/use-queries";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  GraduationCap,
  Building2,
  Zap,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";

function getBengaliDate(date: Date) {
  const gDay = date.getDate();
  const gMonth = date.getMonth();
  const gYear = date.getFullYear();

  const isLeapYear = (gYear % 4 === 0 && gYear % 100 !== 0) || gYear % 400 === 0;

  const starts = [15, 14, 15, 14, 15, 15, 16, 16, 16, 17, 16, 16];
  const bnMonths = [
    "মাঘ",
    "ফাল্গুন",
    "চৈত্র",
    "বৈশাখ",
    "জ্যৈষ্ঠ",
    "আষাঢ়",
    "শ্রাবণ",
    "ভাদ্র",
    "আশ্বিন",
    "কার্তিক",
    "অগ্রহায়ণ",
    "পৌষ",
  ];
  const bnMonthDays = [30, isLeapYear ? 30 : 29, 30, 31, 31, 31, 31, 31, 31, 30, 30, 30];

  let bnMonthIdx;
  let bnDay;

  if (gDay >= starts[gMonth]) {
    bnMonthIdx = gMonth;
    bnDay = gDay - starts[gMonth] + 1;
  } else {
    bnMonthIdx = gMonth === 0 ? 11 : gMonth - 1;
    bnDay = bnMonthDays[bnMonthIdx] - (starts[gMonth] - gDay) + 1;
  }

  let bnYear = gYear - 593;
  if (gMonth < 3 || (gMonth === 3 && gDay < 14)) {
    bnYear -= 1;
  }

  const bnNums = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const toBnNum = (n: number) =>
    n
      .toString()
      .split("")
      .map((c) => bnNums[parseInt(c, 10)])
      .join("");

  return `${toBnNum(bnDay)} ${bnMonths[bnMonthIdx]} ${toBnNum(bnYear)}`;
}

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLogin();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [calendarDays, setCalendarDays] = useState<
    { label: string; date: number; isActive: boolean }[]
  >([]);
  const [dates, setDates] = useState({ english: "", bengali: "", arabic: "" });

  useEffect(() => {
    const days = [];
    const today = new Date();
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: d.getDate(),
        isActive: i === 0,
      });
    }
    setCalendarDays(days);

    try {
      const ms = { day: "numeric", month: "long", year: "numeric" } as const;
      setDates({
        english: new Intl.DateTimeFormat("en-US", ms).format(today),
        bengali: getBengaliDate(today),
        arabic: new Intl.DateTimeFormat("ar-SA", {
          ...ms,
          calendar: "islamic-umalqura",
        }).format(today),
      });
    } catch {
      setDates({ english: "Current Date", bengali: "Current Date", arabic: "Current Date" });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const email = emailInput.trim();
    const password = passwordInput;

    try {
      const result = await loginMutation.mutateAsync({ email, password });

      if (!result.error) {
        login(result.data.user);
        toast.success("Welcome back!");
        router.push("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (email: string, pass: string) => {
    setEmailInput(email);
    setPasswordInput(pass);
    toast.info(`Filled credentials for ${email}`);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8F9FD] p-4 transition-colors duration-500 dark:bg-slate-950 sm:p-8 lg:p-12">
      {/* ── Ambient Animated Background ─────────────────────────── */}
      <style>{`
        @keyframes lp-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(30px, -24px) scale(1.08); }
          66%      { transform: translate(-24px, 18px) scale(0.95); }
        }
        @keyframes lp-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
      `}</style>

      {/* Gradient orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-indigo-400/25 blur-[120px] dark:bg-indigo-600/20"
        style={{ animation: "lp-drift 18s ease-in-out infinite" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -right-40 h-[36rem] w-[36rem] rounded-full bg-violet-400/20 blur-[130px] dark:bg-violet-600/15"
        style={{ animation: "lp-drift 22s ease-in-out infinite", animationDelay: "-6s" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/15 blur-[110px] dark:bg-cyan-500/10"
        style={{ animation: "lp-drift 26s ease-in-out infinite", animationDelay: "-12s" }}
      />

      {/* Subtle grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(100 116 139 / 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgb(100 116 139 / 0.08) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 60% at 50% 45%, black 30%, transparent 75%)",
        }}
      />

      {/* ── Main Card ───────────────────────────────────────────── */}
      <div
        className="relative flex w-full max-w-[1280px] overflow-hidden rounded-[2.5rem] bg-white/90 shadow-[0_24px_70px_-16px_rgba(79,70,229,0.18),0_8px_24px_-8px_rgba(0,0,0,0.08)] ring-1 ring-slate-900/5 backdrop-blur-xl transition-colors duration-500 dark:bg-slate-900/90 dark:shadow-[0_24px_70px_-16px_rgba(0,0,0,0.6)] dark:ring-white/10 lg:min-h-[760px]"
        style={{ animation: "lp-fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Left Side - Image Board & Live Stats */}
        <div className="relative hidden w-1/2 p-4 lg:block">
          <div className="relative h-full w-full overflow-hidden rounded-[2rem]">
            <Image
              src="/login-bg.png"
              alt="Students in a modern academic environment"
              fill
              className="object-cover transition-transform duration-[10s] hover:scale-110"
              priority
            />
            {/* Soft Gradient Overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/90 via-indigo-900/30 to-transparent mix-blend-multiply transition-opacity duration-300 dark:mix-blend-overlay" />
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/50 to-transparent" />

            {/* Top Logo Badge inside Image */}
            <div
              className="absolute left-8 top-8 rounded-full border border-white/20 bg-slate-900/60 py-2 pl-2 pr-6 text-base font-bold tracking-wide text-white shadow-xl backdrop-blur-md"
              style={{ animation: "lp-fade-up 0.8s cubic-bezier(0.22,1,0.36,1) 0.15s both" }}
            >
              <span className="flex items-center gap-3.5">
                <div className="relative h-14 w-14 overflow-hidden rounded-[12px] border border-white/10 shadow-sm">
                  <Image
                    src="/pathshalapro-app-icon.webp"
                    alt="App Icon"
                    fill
                    className="rounded-[12px] object-cover object-[center_72%] scale-110"
                  />
                </div>
                Pathshala Pro
              </span>
            </div>

            {/* Floating Stat Chips */}
            <div
              className="absolute right-8 top-8 flex flex-col items-end gap-3"
              style={{ animation: "lp-fade-up 0.8s cubic-bezier(0.22,1,0.36,1) 0.3s both" }}
            >
              <div
                className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 shadow-lg backdrop-blur-xl"
                style={{ animation: "lp-float 6s ease-in-out infinite" }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/80 text-white shadow-inner">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white">12,000+</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                    Students
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 shadow-lg backdrop-blur-xl"
                style={{ animation: "lp-float 6s ease-in-out infinite", animationDelay: "-2s" }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/80 text-white shadow-inner">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white">500+</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                    Institutes
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 shadow-lg backdrop-blur-xl"
                style={{ animation: "lp-float 6s ease-in-out infinite", animationDelay: "-4s" }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/80 text-white shadow-inner">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white">99.9%</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                    Uptime
                  </p>
                </div>
              </div>
            </div>

            {/* Mini Calendar Glassmorphic Card */}
            <div
              className="absolute bottom-8 left-8 right-8 max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-xl"
              style={{ animation: "lp-fade-up 0.8s cubic-bezier(0.22,1,0.36,1) 0.45s both" }}
            >
              <div className="flex items-center gap-1.5 justify-between">
                {calendarDays.length > 0 ? (
                  calendarDays.map((day, i) => (
                    <div
                      key={i}
                      className={`flex min-w-[2.75rem] flex-col items-center rounded-2xl p-1.5 transition-colors ${
                        day.isActive
                          ? "border border-white/30 bg-white/25 text-white shadow-sm"
                          : "text-white/70"
                      }`}
                    >
                      <span className="mb-0.5 text-[10px] font-medium uppercase tracking-wider">
                        {day.label}
                      </span>
                      <span
                        className={`text-base font-bold ${
                          day.isActive ? "text-white" : "text-white/90"
                        }`}
                      >
                        {day.date}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex h-[50px] w-full items-center justify-center text-white/50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
              </div>

              {/* Today's Dates Card */}
              <div className="mt-3 flex flex-col justify-center rounded-2xl bg-white/95 p-3.5 shadow-lg backdrop-blur-md">
                {dates.english ? (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Today across calendars
                    </h3>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 p-1.5">
                        <span className="rounded bg-blue-200 px-1 text-[9px] font-bold text-blue-800">
                          EN
                        </span>
                        <span className="text-[11px] font-semibold text-slate-800 truncate">
                          {dates.english}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg bg-teal-50 p-1.5">
                        <span className="rounded bg-teal-200 px-1 text-[9px] font-bold text-teal-800">
                          BN
                        </span>
                        <span className="text-[11px] font-semibold text-slate-800 truncate">
                          {dates.bengali}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-1.5">
                        <span className="rounded bg-emerald-200 px-1 text-[9px] font-bold text-emerald-800">
                          AR
                        </span>
                        <span
                          className="text-[11px] font-semibold text-slate-800 truncate"
                          dir="rtl"
                        >
                          {dates.arabic}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[40px] items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="flex w-full flex-col justify-center p-8 sm:p-12 lg:w-1/2 lg:p-14 xl:p-16">
          <div className="mx-auto w-full max-w-[420px]">
            {/* Mobile Logo */}
            <div className="mb-6 inline-flex items-center gap-3 lg:hidden">
              <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-slate-100 shadow-md dark:border-slate-800">
                <Image
                  src="/pathshalapro-app-icon.webp"
                  alt="App Icon"
                  fill
                  className="rounded-2xl object-cover object-[center_72%] scale-110"
                />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Pathshala Pro</span>
            </div>

            <div className="space-y-2 pb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Institutional Security Portal
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Welcome back
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sign in to your school management cloud portal
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Email Address
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-0 top-0 flex h-full w-12 items-center justify-center text-slate-400 transition-colors group-focus-within:text-primary">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="admin@school.com"
                    disabled={isLoading}
                    className="h-12 w-full rounded-2xl border border-slate-200/80 bg-slate-50/50 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all hover:bg-slate-100/60 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white dark:hover:bg-slate-800 dark:focus:bg-slate-900"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      toast.info("Please contact your School Super Administrator to reset your password.");
                    }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-0 top-0 flex h-full w-12 items-center justify-center text-slate-400 transition-colors group-focus-within:text-primary">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    disabled={isLoading}
                    className="h-12 w-full rounded-2xl border border-slate-200/80 bg-slate-50/50 pl-12 pr-12 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all hover:bg-slate-100/60 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white dark:hover:bg-slate-800 dark:focus:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-0 top-0 flex h-full w-12 items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="group relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-2xl bg-primary text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/35 disabled:pointer-events-none disabled:opacity-70"
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                <span className="relative flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    "Sign In to ERP"
                  )}
                </span>
              </button>

              {/* Demo Credentials Quick-Fill Bar */}
              <div className="mt-4 rounded-xl border border-slate-200/60 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  Quick Fill Demo Credentials:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickFill("principal@greenwood.edu", "Password123!")}
                    className="rounded-lg border border-border bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-xs hover:border-primary hover:text-primary dark:bg-slate-900 dark:text-slate-300"
                  >
                    Principal / Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill("clerk@greenwood.edu", "Password123!")}
                    className="rounded-lg border border-border bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-xs hover:border-primary hover:text-primary dark:bg-slate-900 dark:text-slate-300"
                  >
                    Finance Clerk
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill("superadmin@pathshala.pro", "SuperSecret123!")}
                    className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-2 py-1 text-[11px] font-medium text-indigo-700 shadow-xs hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
                  >
                    SaaS SuperAdmin
                  </button>
                </div>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  New school?{" "}
                  <Link href="/onboarding" className="font-semibold text-primary hover:underline">
                    Onboard your institute (30-day free trial)
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
