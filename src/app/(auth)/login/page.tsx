"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLogin } from "@/hooks/use-queries";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { Mail, Lock, Loader2, Sparkles } from "lucide-react";
import Image from "next/image";

function getBengaliDate(date: Date) {
  const gDay = date.getDate();
  const gMonth = date.getMonth(); 
  const gYear = date.getFullYear();

  const isLeapYear = (gYear % 4 === 0 && gYear % 100 !== 0) || gYear % 400 === 0;

  const starts = [15, 14, 15, 14, 15, 15, 16, 16, 16, 17, 16, 16];
  const bnMonths = ["মাঘ", "ফাল্গুন", "চৈত্র", "বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ", "পৌষ"];
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

  const bnNums = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  const toBnNum = (n: number) => n.toString().split('').map(c => bnNums[parseInt(c, 10)]).join('');

  return `${toBnNum(bnDay)} ${bnMonths[bnMonthIdx]} ${toBnNum(bnYear)}`;
}

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLogin();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [calendarDays, setCalendarDays] = useState<{ label: string; date: number; isActive: boolean }[]>([]);
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
        arabic: new Intl.DateTimeFormat("ar-SA", { ...ms, calendar: "islamic-umalqura" }).format(today),
      });
    } catch (e) {
      setDates({ english: "Current Date", bengali: "Current Date", arabic: "Current Date" });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 transition-colors duration-500 dark:bg-slate-950 sm:p-8 lg:p-12">
      <div className="flex w-full max-w-[1280px] overflow-hidden rounded-[2.5rem] bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] transition-colors duration-500 dark:bg-slate-900 dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] lg:min-h-[760px]">
        {/* Left Side - Image Board */}
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
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent mix-blend-multiply transition-opacity duration-300 dark:mix-blend-overlay" />
            
            {/* Top Logo Badge inside Image */}
            <div className="absolute left-8 top-8 rounded-full border border-white/20 bg-slate-900/60 py-2 pl-2 pr-6 text-base font-bold tracking-wide text-white shadow-xl backdrop-blur-md">
              <span className="flex items-center gap-3.5">
                <div className="relative h-16 w-16 overflow-hidden rounded-[12px] border border-white/10 shadow-sm">
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

            {/* Mini Calendar Glassmorphic Card */}
            <div className="absolute bottom-10 left-10 max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-1.5 justify-between">
                {calendarDays.length > 0 ? (
                  calendarDays.map((day, i) => (
                    <div
                      key={i}
                      className={`flex min-w-[3.25rem] flex-col items-center rounded-2xl p-2 transition-colors ${
                        day.isActive
                          ? "border border-white/30 bg-white/20 text-white shadow-sm"
                          : "text-white/70"
                      }`}
                    >
                      <span className="mb-1 text-[11px] font-medium uppercase tracking-wider">
                        {day.label}
                      </span>
                      <span
                        className={`text-lg font-bold ${day.isActive ? "text-white" : "text-white/90"}`}
                      >
                        {day.date}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex h-[60px] w-full items-center justify-center text-white/50">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
              </div>

              {/* Today's Dates Card */}
              <div className="mt-4 flex flex-col justify-center rounded-2xl bg-white p-5 shadow-lg">
                {dates.english ? (
                  <div className="space-y-3">
                    <h3 className="mb-1 text-xl font-black text-slate-900">
                      Today is
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <span className="text-[10px] font-bold">EN</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{dates.english}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                        <span className="text-[10px] font-bold">BN</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{dates.bengali}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <span className="text-[10px] font-bold">AR</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800" dir="rtl">{dates.arabic}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[112px] items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="flex w-full flex-col justify-center p-8 sm:p-16 lg:w-1/2 lg:p-20 xl:p-24">
          <div className="mx-auto w-full max-w-[400px]">
            {/* Mobile/Tablet Logo (hidden on desktop where left sidebar exists) */}
            <div className="mb-8 inline-flex items-center gap-3 lg:hidden">
              <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-slate-100 shadow-lg dark:border-slate-800">
                <Image
                  src="/pathshalapro-app-icon.webp"
                  alt="App Icon"
                  fill
                  className="rounded-2xl object-cover object-[center_72%] scale-110"
                />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Pathshala Pro</span>
            </div>

            <div className="space-y-3 pb-10">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Welcome back
              </h1>
              <p className="text-base text-slate-500 dark:text-slate-400">
                Please enter your details to sign in
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="ml-1 text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-300"
                >
                  Email
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-0 top-0 flex h-full w-14 items-center justify-center text-slate-400 transition-colors group-focus-within:text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@school.com"
                    disabled={isLoading}
                    className="h-14 w-full rounded-2xl border-0 bg-slate-100/80 pl-14 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-transparent transition-all hover:bg-slate-200/50 focus:bg-white focus:ring-2 focus:ring-primary dark:bg-slate-800/60 dark:text-white dark:hover:bg-slate-800 dark:focus:bg-slate-900"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="ml-1 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <a href="#" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-0 top-0 flex h-full w-14 items-center justify-center text-slate-400 transition-colors group-focus-within:text-primary">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    disabled={isLoading}
                    className="h-14 w-full rounded-2xl border-0 bg-slate-100/80 pl-14 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-transparent transition-all hover:bg-slate-200/50 focus:bg-white focus:ring-2 focus:ring-primary dark:bg-slate-800/60 dark:text-white dark:hover:bg-slate-800 dark:focus:bg-slate-900"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="group relative mt-4 flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-primary text-base font-semibold text-white shadow-lg shadow-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/40 disabled:pointer-events-none disabled:opacity-70"
              >
                {/* Button Shine Effect */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                
                <span className="relative flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    "Sign In"
                  )}
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
