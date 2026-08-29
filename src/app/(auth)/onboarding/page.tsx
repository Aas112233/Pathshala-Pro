"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CURRENCY_LIST } from "@/lib/currencies";
import { CLASS_TEMPLATE_PRESETS, type ClassTemplatePreset } from "@/lib/schemas";
import { generateTenantSlug } from "@/lib/onboarding-templates";
import { toast } from "sonner";
import {
  GraduationCap,
  Building2,
  Globe2,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Copy,
  LogIn,
  School,
  Backpack,
  BookOpen,
  Microscope,
  Landmark,
  BookMarked,
  Sliders,
  type LucideIcon,
} from "lucide-react";

const TEMPLATE_ICONS: Record<ClassTemplatePreset, LucideIcon> = {
  K_12: School,
  PRIMARY_1_5: Backpack,
  MIDDLE_6_8: BookOpen,
  SECONDARY_9_10: Microscope,
  PK_FBISE_MATRIC_INTER: Landmark,
  IN_CBSE_SECONDARY_SR_SEC: GraduationCap,
  BD_NCTB_PRIMARY_SSC_HSC: School,
  HIGHER_SEC_11_12: GraduationCap,
  O_A_LEVELS: Landmark,
  MADRASA: BookMarked,
  CUSTOM: Sliders,
};

export default function PublicOnboardingPage() {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const tc = useTranslations("currencies");
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provisionedData, setProvisionedData] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    tenantId: "",
    schoolCode: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    motto: "",
    establishedYear: new Date().getFullYear(),

    currency: "PKR",
    currencySymbol: "₨",
    taxRate: 0,
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12h" as "12h" | "24h",
    timezone: "Asia/Karachi",
    firstDayOfWeek: "monday",
    gradingSystem: "GPA" as "GPA" | "PERCENTAGE" | "LETTER",

    academicYearLabel: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    academicStartDate: `${new Date().getFullYear()}-08-01`,
    academicEndDate: `${new Date().getFullYear() + 1}-06-30`,
    classTemplate: "K_12" as ClassTemplatePreset,

    adminName: "",
    adminEmail: "",
    adminPassword: "",
    adminPhone: "",
    subscriptionStatus: "TRIAL" as "TRIAL" | "ACTIVE",
  });

  const updateField = (key: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name" && !prev.tenantId) {
        next.tenantId = generateTenantSlug(value);
      }
      if (key === "currency") {
        const found = CURRENCY_LIST.find((c) => c.code === value);
        if (found) {
          next.currencySymbol = found.symbol;
        }
      }
      return next;
    });
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    updateField("adminPassword", pwd);
    toast.success(t("toast.passwordGenerated"));
  };

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        toast.error(t("toast.errName"));
        return false;
      }
      if (!formData.tenantId.trim()) {
        toast.error(t("toast.errSlug"));
        return false;
      }
      if (!formData.address.trim()) {
        toast.error(t("toast.errAddress"));
        return false;
      }
    } else if (currentStep === 3) {
      if (!formData.academicYearLabel.trim()) {
        toast.error(t("toast.errYearLabel"));
        return false;
      }
      if (!formData.academicStartDate || !formData.academicEndDate) {
        toast.error(t("toast.errDates"));
        return false;
      }
    } else if (currentStep === 4) {
      if (!formData.adminName.trim()) {
        toast.error(t("toast.errFullName"));
        return false;
      }
      if (!formData.adminEmail.trim() || !formData.adminEmail.includes("@")) {
        toast.error(t("toast.errEmail"));
        return false;
      }
      if (!formData.adminPassword || formData.adminPassword.length < 6) {
        toast.error(t("toast.errPassword"));
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleProvision = async () => {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        tenantId: formData.tenantId ? formData.tenantId.trim().toLowerCase() : undefined,
        schoolCode: formData.schoolCode ? formData.schoolCode.trim() : undefined,
        address: formData.address.trim(),
        phone: formData.phone ? formData.phone.trim() : undefined,
        email: formData.email && formData.email.trim() ? formData.email.trim().toLowerCase() : undefined,
        website: formData.website && formData.website.trim() ? formData.website.trim() : undefined,
        motto: formData.motto ? formData.motto.trim() : undefined,
        adminName: formData.adminName.trim(),
        adminEmail: formData.adminEmail.trim().toLowerCase(),
        adminPassword: formData.adminPassword,
        adminPhone: formData.adminPhone ? formData.adminPhone.trim() : undefined,
      };

      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg =
          json.error?.message ||
          json.message ||
          (Array.isArray(json.error?.details) && json.error.details[0]?.message) ||
          t("toast.provisionFailed");
        toast.error(errorMsg);
        setIsSubmitting(false);
        return;
      }

      setProvisionedData(json.data);
      setStep(6);
      toast.success(t("toast.success"));
    } catch {
      toast.error(t("toast.networkError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-primary text-primary-foreground mb-3">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            {t("registerTitle")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("registerSubtitle")}
          </p>
        </div>

        {/* Wizard Card */}
        <Card className="border border-border/80 bg-card rounded-lg overflow-hidden">
          {step <= 5 && (
            <div className="border-b border-border bg-muted/30 px-6 py-4">
              <div className="flex items-center justify-between">
                {[
                  { num: 1, label: t("stepProfile"), icon: Building2 },
                  { num: 2, label: t("stepLocalization"), icon: Globe2 },
                  { num: 3, label: t("stepAcademics"), icon: GraduationCap },
                  { num: 4, label: t("stepAdminAccount"), icon: UserCheck },
                  { num: 5, label: t("stepLaunch"), icon: ShieldCheck },
                ].map((s) => {
                  const isActive = step === s.num;
                  const isCompleted = step > s.num;

                  return (
                    <div
                      key={s.num}
                      className={`flex items-center gap-2 text-xs font-semibold ${
                        isActive
                          ? "text-primary"
                          : isCompleted
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : isCompleted
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
                      </div>
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <CardContent className="p-6 sm:p-8">
            {/* Step 1: t("profileSection")} */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{t("profileSection")}</h2>
                  <p className="text-xs text-muted-foreground">{t("profileSectionDesc")}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="inst-name" className="text-xs font-semibold">
                      {t("instituteName")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="inst-name"
                      placeholder={t("instituteNamePh")}
                      value={formData.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inst-slug" className="text-xs font-semibold">
                      {t("slugLabel")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="inst-slug"
                      placeholder={t("slugPh")}
                      value={formData.tenantId}
                      onChange={(e) =>
                        updateField("tenantId", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                      }
                      className="h-10 text-sm font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inst-code" className="text-xs font-semibold">
                      {t("labels.schoolCode")}
                    </Label>
                    <Input
                      id="inst-code"
                      placeholder={t("schoolCodePh")}
                      value={formData.schoolCode}
                      onChange={(e) => updateField("schoolCode", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="inst-address" className="text-xs font-semibold">
                      {t("labels.address")} <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="inst-address"
                      placeholder={t("addressPh")}
                      value={formData.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      className="text-sm min-h-[70px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inst-phone" className="text-xs font-semibold">
                      {t("labels.phone")}
                    </Label>
                    <Input
                      id="inst-phone"
                      placeholder={t("phonePh")}
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inst-email" className="text-xs font-semibold">
                      {t("labels.email")}
                    </Label>
                    <Input
                      id="inst-email"
                      type="email"
                      placeholder={t("emailPh")}
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Localization */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{t("regionalSection")}</h2>
                  <p className="text-xs text-muted-foreground">{t("regionalSectionDesc")}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t("labels.billingCurrency")}</Label>
                    <select
                      value={formData.currency}
                      onChange={(e) => updateField("currency", e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CURRENCY_LIST.map((c) => (
                        <option key={c.code} value={c.code}>
                          {tc(c.code)} ({c.symbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tax-rate" className="text-xs font-semibold">
                      {t("labels.taxRate")}
                    </Label>
                    <Input
                      id="tax-rate"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.taxRate}
                      onChange={(e) => updateField("taxRate", parseFloat(e.target.value) || 0)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t("labels.systemTimezone")}</Label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => updateField("timezone", e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="Asia/Karachi">{t("timezones.pakistan")}</option>
                      <option value="Asia/Dhaka">{t("timezones.bangladesh")}</option>
                      <option value="Asia/Kolkata">{t("timezones.india")}</option>
                      <option value="Asia/Dubai">{t("timezones.uae")}</option>
                      <option value="Asia/Riyadh">{t("timezones.saudi")}</option>
                      <option value="Europe/London">{t("timezones.london")}</option>
                      <option value="America/New_York">{t("timezones.eastern")}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t("labels.dateFormat")}</Label>
                    <select
                      value={formData.dateFormat}
                      onChange={(e) => updateField("dateFormat", e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="DD/MM/YYYY">{t("dateFormats.dmySlash")}</option>
                      <option value="MM/DD/YYYY">{t("dateFormats.mdySlash")}</option>
                      <option value="YYYY-MM-DD">{t("dateFormats.ymdDash")}</option>
                      <option value="DD-MM-YYYY">{t("dateFormats.dmyDash")}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: t("academicSystem")} */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{t("academicsSection")}</h2>
                  <p className="text-xs text-muted-foreground">
                    {t("academicsSectionDesc")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="acad-label" className="text-xs font-semibold">
                      {t("academicYearLabel")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="acad-label"
                      placeholder={t("academicYearPh")}
                      value={formData.academicYearLabel}
                      onChange={(e) => updateField("academicYearLabel", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="acad-start" className="text-xs font-semibold">
                      {t("startDate")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="acad-start"
                      type="date"
                      value={formData.academicStartDate}
                      onChange={(e) => updateField("academicStartDate", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="acad-end" className="text-xs font-semibold">
                      {t("endDate")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="acad-end"
                      type="date"
                      value={formData.academicEndDate}
                      onChange={(e) => updateField("academicEndDate", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">{t("gradeStructureLabel")}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {CLASS_TEMPLATE_PRESETS.map((preset) => {
                      const IconComp = TEMPLATE_ICONS[preset];
                      const isSelected = formData.classTemplate === preset;

                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => updateField("classTemplate", preset)}
                          className={`flex flex-col text-left p-3.5 rounded-xl border transition-all text-xs cursor-pointer ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/40 bg-card"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-2">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <IconComp className="h-4 w-4" />
                            </div>
                            <Badge
                              variant={isSelected ? "default" : "outline"}
                              className={`text-[10px] py-0 ${isSelected ? "bg-primary" : ""}`}
                            >
                              {t(`templates.${preset}.count`)}
                            </Badge>
                          </div>
                          <span className="font-bold text-foreground text-sm">{t(`templates.${preset}.label`)}</span>
                          <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {t(`templates.${preset}.description`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Administrator Account */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{t("adminSection")}</h2>
                  <p className="text-xs text-muted-foreground">
                    {t("adminSectionDesc")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-name" className="text-xs font-semibold">
                      {t("fullNameLabel")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="admin-name"
                      placeholder={t("fullNamePh")}
                      value={formData.adminName}
                      onChange={(e) => updateField("adminName", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="admin-email" className="text-xs font-semibold">
                      {t("loginEmailLabel")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder={t("loginEmailPh")}
                      value={formData.adminEmail}
                      onChange={(e) => updateField("adminEmail", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="admin-pwd" className="text-xs font-semibold">
                        {t("masterPasswordLabel")} <span className="text-destructive">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <KeyRound className="h-3 w-3" /> {t("generatePassword")}
                      </button>
                    </div>
                    <Input
                      id="admin-pwd"
                      type="text"
                      placeholder={t("passwordPh")}
                      value={formData.adminPassword}
                      onChange={(e) => updateField("adminPassword", e.target.value)}
                      className="h-10 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Review & Confirmation */}
            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{t("reviewTitle")}</h2>
                  <p className="text-xs text-muted-foreground">
                    {t("reviewDesc")}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5 text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                      {t("schoolDetails")}
                    </span>
                    <p className="font-bold text-foreground text-sm">{formData.name}</p>
                    <p className="text-muted-foreground font-mono">{t("labels.slug")} {formData.tenantId}</p>
                    <p className="text-muted-foreground">{formData.address}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5 text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                      {t("financialRegional")}
                    </span>
                    <p className="font-bold text-foreground">
                      {formData.currency} ({formData.currencySymbol})
                    </p>
                    <p className="text-muted-foreground">{t("labels.timezoneValue")} {formData.timezone}</p>
                    <p className="text-muted-foreground">{t("labels.dateValue")} {formData.dateFormat}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5 text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                      {t("academicSystem")}
                    </span>
                    <p className="font-bold text-foreground">{formData.academicYearLabel}</p>
                    <p className="text-muted-foreground">
                      {t("labels.templateValue")} {t(`templates.${formData.classTemplate}.label`)}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5 text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                      {t("superAdmin")}
                    </span>
                    <p className="font-bold text-foreground">{formData.adminName}</p>
                    <p className="text-muted-foreground">{formData.adminEmail}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Success Screen */}
            {step === 6 && provisionedData && (
              <div className="text-center py-6 space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <CheckCircle2 className="h-10 w-10" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-extrabold text-foreground">
                    {t("welcomeTitle", { name: provisionedData.name })}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Your school ERP instance is live with full database isolation, academic year{" "}
                    <span className="font-semibold text-foreground">{provisionedData.academicYear}</span>, and initial
                    grade structures.
                  </p>
                </div>

                <div className="max-w-md mx-auto p-4 rounded-xl border border-border bg-muted/30 text-left space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">{t("instituteTenantId")}</span>
                    <code className="font-mono font-bold text-primary">{provisionedData.tenantId}</code>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">{t("superAdminEmail")}</span>
                    <span className="font-semibold text-foreground">{provisionedData.adminEmail}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("classesSeeded")}</span>
                    <Badge variant="outline">{t("classesCount", { count: provisionedData.classesCount })}</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `School: ${provisionedData.name}\nTenant ID: ${provisionedData.tenantId}\nLogin Email: ${provisionedData.adminEmail}`
                      );
                      toast.success(t("detailsCopied"));
                    }}
                    className="gap-2 text-xs"
                  >
                    <Copy className="h-4 w-4" /> {t("copyCredentials")}
                  </Button>
                  <Button
                    onClick={() => router.push("/login")}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-xs"
                  >
                    <LogIn className="h-4 w-4" /> {t("goToLoginPortal")}
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation Footer */}
            {step <= 5 && (
              <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
                {step > 1 ? (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                    className="gap-2 text-xs"
                  >
                    <ArrowLeft className="h-4 w-4" /> {t("labels.previous")}
                  </Button>
                ) : (
                  <Link href="/login">
                    <Button variant="ghost" className="text-muted-foreground text-xs">
                      {t("labels.backToLogin")}
                    </Button>
                  </Link>
                )}

                {step < 5 ? (
                  <Button
                    onClick={handleNext}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-xs"
                  >
                    {t("labels.next")} <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleProvision}
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md text-xs"
                  >
                    {isSubmitting ? (
                      <>{t("provisioning")}</>
                    ) : (
                      <>
                        <Building2 className="h-4 w-4" /> {t("completeLaunch")}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-xs text-muted-foreground mt-8">
        {t("copyright", { year: new Date().getFullYear() })}
      </div>
    </div>
  );
}
