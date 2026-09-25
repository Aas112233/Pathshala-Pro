"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useLogin } from "@/hooks/use-queries";
import { useAuth } from "@/components/providers/auth-provider";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { locales, localeNames, type Locale, isRtl } from "@/i18n/config";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  GraduationCap,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Receipt,
  Globe,
  Sun,
  Moon,
  LogIn,
  ChevronDown,
  Check,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


export default function LoginPage() {
  const t = useTranslations("auth");
  const currentLocale = useLocale() as Locale;
  const { theme, setTheme } = useTheme();
  const loginMutation = useLogin();
  const { login } = useAuth();
  const { run, isPending } = useSubmitGuard();

  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localeDropdownOpen, setLocaleDropdownOpen] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setLocaleDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const switchLocale = (newLocale: Locale) => {
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
    setLocaleDropdownOpen(false);
    window.location.reload();
  };


  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const returnUrl = searchParams?.get("returnUrl");
  const isSessionExpired = searchParams?.get("expired") === "1";

  useEffect(() => {
    if (isSessionExpired) {
      toast.error("Your session expired. Please sign in again.");
    }
    // Scrub credentials if a native pre-hydration submit ever leaked them
    // into the URL (email/password must never persist in history or logs).
    const params = new URLSearchParams(window.location.search);
    if (params.has("email") || params.has("password")) {
      params.delete("email");
      params.delete("password");
      const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState(null, "", clean);
    }
  }, [isSessionExpired]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const email = emailInput.trim();
    const password = passwordInput;

    void run(async () => {
      try {
        const result = await loginMutation.mutateAsync({ email, password });

        if (!result.error) {
          login(result.data.user);
          toast.success(t("welcomeToast"));

          // Safe internal target redirect
          let destination = "/";
          if (result.data.redirectTo === "/subscription/inactive") {
            destination = "/subscription/inactive";
          } else if (returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//")) {
            destination = returnUrl;
          }

          window.location.replace(destination);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("invalidCredentials");
        toast.error(message);
      }
    });
  };

  const rtlActive = isRtl(currentLocale);

  return (
    <div
      className={cn(
        "flex min-h-screen w-full bg-background font-sans text-foreground antialiased",
        rtlActive && "dir-rtl"
      )}
    >
      {/* ── Left Pillar: Institutional Showcase (Desktop) ──────── */}
      <div className="relative hidden w-1/2 flex-col justify-between border-r border-slate-800/80 bg-slate-950 p-10 text-white lg:flex xl:p-14 2xl:p-16 select-none overflow-hidden">
        {/* Subtle geometric dot grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Soft atmospheric depth gradient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-transparent to-slate-950/80"
        />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-md">
              <Image
                src="/pathshalapro-app-icon.webp"
                alt="Pathshala Pro Logo"
                fill
                sizes="44px"
                className="object-cover"
                priority
              />
            </div>
            <div>
              <span className="block text-lg font-bold tracking-tight text-white">
                Pathshala Pro
              </span>
              <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Institutional School ERP
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Cloud SaaS v1.0</span>
          </div>
        </div>

        {/* Center Presentation: Narrative & Core Pillars */}
        <div className="relative z-10 my-auto max-w-xl py-8">
          <div className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
            <span>{t("enterpriseEdition")}</span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white xl:text-4xl leading-snug">
            {t("heroHeadline")}
          </h1>

          <p className="mt-3 text-sm text-slate-300/90 leading-relaxed">
            {t("heroSubhead")}
          </p>

          {/* Operational Pillars Grid */}
          <div className="mt-8 grid grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 transition-colors hover:bg-white/[0.08]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
                <GraduationCap className="h-4 w-4" />
              </div>
              <p className="mt-2.5 text-xs font-semibold text-white">
                {t("pillarAcademic")}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 transition-colors hover:bg-white/[0.08]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                <Receipt className="h-4 w-4" />
              </div>
              <p className="mt-2.5 text-xs font-semibold text-white">
                {t("pillarFinance")}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 transition-colors hover:bg-white/[0.08]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <p className="mt-2.5 text-xs font-semibold text-white">
                {t("pillarAttendance")}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 transition-colors hover:bg-white/[0.08]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                <Building2 className="h-4 w-4" />
              </div>
              <p className="mt-2.5 text-xs font-semibold text-white">
                {t("pillarMultiCampus")}
              </p>
            </div>
          </div>

          {/* Audited Metrics Strip */}
          <div className="mt-8 grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xs">
            <div className="px-3 text-center">
              <p className="text-xl font-bold tracking-tight text-white">
                {t("institutesStat")}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {t("institutes")}
              </p>
            </div>
            <div className="px-3 text-center">
              <p className="text-xl font-bold tracking-tight text-white">
                {t("studentsStat")}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {t("students")}
              </p>
            </div>
            <div className="px-3 text-center">
              <p className="text-xl font-bold tracking-tight text-emerald-400">
                {t("slaMetric")}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {t("uptime")}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Security Badge */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-slate-500" />
            
          </div>
          <span>&copy; {new Date().getFullYear()} Pathshala Pro</span>
        </div>
      </div>

      {/* ── Right Pillar: Authentication Portal ─────────────────── */}
      <div className="flex min-h-screen flex-1 flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16">
        {/* Top Utility Header */}
        <div className="flex items-center justify-between">
          {/* Operational Status Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>{t("systemStatus")}</span>
          </div>

          {/* Controls: Language Switcher & Theme Toggle */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setLocaleDropdownOpen(!localeDropdownOpen)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  localeDropdownOpen && "bg-muted text-foreground"
                )}
                aria-label="Select Language"
              >
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>{localeNames[currentLocale] || "Language"}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    localeDropdownOpen && "rotate-180"
                  )}
                />
              </button>

              {localeDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-40 overflow-hidden rounded-xl border border-border/80 bg-popover p-1 shadow-lg z-50">
                  {locales.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => switchLocale(loc)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
                        currentLocale === loc
                          ? "bg-accent font-semibold text-primary"
                          : "text-popover-foreground"
                      )}
                    >
                      <span>{localeNames[loc]}</span>
                      {currentLocale === loc && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dark/Light Mode Toggle */}
            {isMounted && (
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Toggle Theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Center Portal Form Box */}
        <div className="mx-auto my-auto w-full max-w-[420px] py-8">
          {/* Mobile Brand Lockup (visible only on small screens) */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <Image
                src="/pathshalapro-app-icon.webp"
                alt="Pathshala Pro Logo"
                fill
                sizes="44px"
                className="object-cover"
                priority
              />
            </div>
            <div>
              <span className="block text-lg font-bold tracking-tight text-foreground">
                Pathshala Pro
              </span>
              <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Institutional School ERP
              </span>
            </div>
          </div>

          {/* Form Header */}
          <div className="space-y-1.5 pb-6">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t("securityPortal")}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("welcome")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>


          {/* Authentication Form (method=post: native fallback must never serialize credentials into the URL) */}
          <form onSubmit={handleSubmit} method="post" className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                {t("emailAddress")}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground">
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
                  placeholder={t("emailPlaceholder")}
                  disabled={isPending}
                  className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 outline-none transition-all hover:border-border focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-foreground"
                >
                  {t("password")}
                </label>
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("forgotPassword")}
                </button>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground">
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
                  disabled={isPending}
                  className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-10 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 outline-none transition-all hover:border-border focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center space-x-2 pt-0.5">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(!!checked)}
              />
              <label
                htmlFor="remember"
                className="text-xs font-medium leading-none text-muted-foreground cursor-pointer select-none"
              >
                {t("rememberMe")}
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>{t("authenticating")}</span>
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  <span>{t("signInErp")}</span>
                </>
              )}
            </Button>

            {/* Onboarding Link */}
            <div className="pt-3 text-center">
              <p className="text-xs text-muted-foreground">
                {t("newSchool")}{" "}
                <Link
                  href="/onboarding"
                  className="font-semibold text-primary hover:underline"
                >
                  {t("onboardTrial")}
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Trust & Compliance Footer */}
        <div className="text-center text-[11px] text-muted-foreground/80">
          <p>
            
          </p>
        </div>
      </div>

      {/* Forgot Password Guidance Modal */}
      <AppModal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        title={t("resetModalTitle")}
        maxWidth="md"
      >
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/30 p-4">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-foreground">
              {t("resetPasswordHelp")}
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForgotModalOpen(false)}
            >
              {t("resetModalClose")}
            </Button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
