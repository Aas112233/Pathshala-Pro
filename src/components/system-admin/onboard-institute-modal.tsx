"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CURRENCY_LIST } from "@/lib/currencies";
import { CLASS_TEMPLATE_PRESETS, type ClassTemplatePreset } from "@/lib/schemas";
import { generateTenantSlug } from "@/lib/onboarding-templates";
import { toast } from "sonner";
import {
  Building2,
  Globe2,
  GraduationCap,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  School,
  BookOpen,
  Calendar,
  Layers,
  Copy,
  ExternalLink,
  Backpack,
  Microscope,
  Landmark,
  BookMarked,
  Sliders,
  type LucideIcon,
} from "lucide-react";

interface OnboardInstituteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TEMPLATE_DESCRIPTIONS: Record<
  ClassTemplatePreset,
  { label: string; description: string; count: string; icon: LucideIcon }
> = {
  K_12: {
    label: "K-12 Comprehensive",
    description: "Playgroup, Nursery, KG, Grades 1-10 with Sections & Core Subjects",
    count: "13 Classes + Sections",
    icon: School,
  },
  PRIMARY_1_5: {
    label: "Primary School (1–5)",
    description: "Class 1 through Class 5 with Sections A & B",
    count: "5 Classes",
    icon: Backpack,
  },
  MIDDLE_6_8: {
    label: "Middle School (6–8)",
    description: "Class 6 through Class 8 with Sections & General Science",
    count: "3 Classes",
    icon: BookOpen,
  },
  SECONDARY_9_10: {
    label: "Secondary / Matric (9–10)",
    description: "Class 9 & 10 Matriculation with Science/Arts groups",
    count: "2 Classes",
    icon: Microscope,
  },
  HIGHER_SEC_11_12: {
    label: "Higher Secondary (11–12)",
    description: "FSc Pre-Med, Pre-Eng, ICS Computer Science & I.Com",
    count: "2 Grades + 4 Streams",
    icon: GraduationCap,
  },
  O_A_LEVELS: {
    label: "Cambridge (O / A Levels)",
    description: "O-Level (Y1–Y3) and A-Level (AS/A2) with Science & Business streams",
    count: "5 Years",
    icon: Landmark,
  },
  MADRASA: {
    label: "Madrasa / Religious Institute",
    description: "Nazra Quran, Hifz-ul-Quran & Dars-e-Nizami levels",
    count: "4 Levels",
    icon: BookMarked,
  },
  CUSTOM: {
    label: "Custom (Blank Start)",
    description: "No default classes seeded. Setup classes and subjects manually later.",
    count: "0 Classes",
    icon: Sliders,
  },
};

export function OnboardInstituteModal({
  isOpen,
  onClose,
  onSuccess,
}: OnboardInstituteModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provisionedData, setProvisionedData] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1
    name: "",
    tenantId: "",
    schoolCode: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    motto: "",
    establishedYear: new Date().getFullYear(),

    // Step 2
    currency: "PKR",
    currencySymbol: "₨",
    taxRate: 0,
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12h" as "12h" | "24h",
    timezone: "Asia/Karachi",
    firstDayOfWeek: "monday",
    gradingSystem: "GPA" as "GPA" | "PERCENTAGE" | "LETTER",

    // Step 3
    academicYearLabel: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    academicStartDate: `${new Date().getFullYear()}-08-01`,
    academicEndDate: `${new Date().getFullYear() + 1}-06-30`,
    classTemplate: "K_12" as ClassTemplatePreset,

    // Step 4
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
    toast.success("Generated secure temporary password");
  };

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        toast.error("Please enter the institute name");
        return false;
      }
      if (!formData.address.trim()) {
        toast.error("Please enter the school address");
        return false;
      }
    } else if (currentStep === 3) {
      if (!formData.academicYearLabel.trim()) {
        toast.error("Please provide an academic year label");
        return false;
      }
      if (!formData.academicStartDate || !formData.academicEndDate) {
        toast.error("Please select session start and end dates");
        return false;
      }
    } else if (currentStep === 4) {
      if (!formData.adminName.trim()) {
        toast.error("Please enter the administrator's name");
        return false;
      }
      if (!formData.adminEmail.trim() || !formData.adminEmail.includes("@")) {
        toast.error("Please enter a valid administrator email");
        return false;
      }
      if (!formData.adminPassword || formData.adminPassword.length < 6) {
        toast.error("Password must be at least 6 characters");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
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

      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        const errorMsg =
          result.error?.message ||
          result.message ||
          (Array.isArray(result.error?.details) && result.error.details[0]?.message) ||
          "Failed to provision institute";
        toast.error(errorMsg);
        return;
      }

      setProvisionedData(result.data);
      setStep(6); // Success Step
      toast.success("Institute successfully onboarded!");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Network error during onboarding");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setProvisionedData(null);
    onClose();
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Onboard New Educational Institute"
      subtitle="SaaS Multi-Tenant Provisioning"
      description="Register, configure regional localization, initialize academic periods, and provision school admin access."
      maxWidth="5xl"
    >
      {/* Step Indicator */}
      {step <= 5 && (
        <div className="mb-6 border-b border-border pb-4">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: "Institute Profile", icon: Building2 },
              { num: 2, label: "Region & Currency", icon: Globe2 },
              { num: 3, label: "Academic System", icon: GraduationCap },
              { num: 4, label: "Admin Credentials", icon: UserCheck },
              { num: 5, label: "Review & Provision", icon: ShieldCheck },
            ].map((s) => {
              const Icon = s.icon;
              const isActive = step === s.num;
              const isCompleted = step > s.num;

              return (
                <div
                  key={s.num}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-primary"
                      : isCompleted
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground opacity-60"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : isCompleted
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 1: Institute Profile */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="inst-name" className="text-xs font-semibold">
                Institute Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inst-name"
                placeholder="e.g. Beaconhouse International Academy"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-slug" className="text-xs font-semibold">
                Tenant Slug / Subdomain <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="inst-slug"
                  placeholder="e.g. beaconhouse-intl"
                  value={formData.tenantId}
                  onChange={(e) => updateField("tenantId", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="h-10 text-sm font-mono"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Unique identifier used for multi-tenant isolation.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-code" className="text-xs font-semibold">
                School Registration / Code
              </Label>
              <Input
                id="inst-code"
                placeholder="e.g. SCH-2026-01"
                value={formData.schoolCode}
                onChange={(e) => updateField("schoolCode", e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="inst-address" className="text-xs font-semibold">
                Campus Address <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="inst-address"
                placeholder="Street address, City, District, Postal Code"
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-phone" className="text-xs font-semibold">
                Official Phone Number
              </Label>
              <Input
                id="inst-phone"
                placeholder="e.g. +92 51 1234567"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-email" className="text-xs font-semibold">
                Official School Email
              </Label>
              <Input
                id="inst-email"
                type="email"
                placeholder="e.g. info@beaconhouse.edu"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-motto" className="text-xs font-semibold">
                Motto / Slogan
              </Label>
              <Input
                id="inst-motto"
                placeholder="e.g. Excellence in Education"
                value={formData.motto}
                onChange={(e) => updateField("motto", e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-year" className="text-xs font-semibold">
                Established Year
              </Label>
              <Input
                id="inst-year"
                type="number"
                value={formData.establishedYear}
                onChange={(e) => updateField("establishedYear", parseInt(e.target.value) || 2026)}
                className="h-10 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Regional & Financial */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="currency-select" className="text-xs font-semibold">
                Default Currency <span className="text-destructive">*</span>
              </Label>
              <select
                id="currency-select"
                value={formData.currency}
                onChange={(e) => updateField("currency", e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CURRENCY_LIST.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currency-sym" className="text-xs font-semibold">
                Currency Symbol
              </Label>
              <Input
                id="currency-sym"
                value={formData.currencySymbol}
                onChange={(e) => updateField("currencySymbol", e.target.value)}
                className="h-10 text-sm font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timezone-select" className="text-xs font-semibold">
                Timezone <span className="text-destructive">*</span>
              </Label>
              <select
                id="timezone-select"
                value={formData.timezone}
                onChange={(e) => updateField("timezone", e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Asia/Karachi">Asia/Karachi (Pakistan Standard Time UTC+5)</option>
                <option value="Asia/Dhaka">Asia/Dhaka (Bangladesh Standard Time UTC+6)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (Indian Standard Time UTC+5:30)</option>
                <option value="Asia/Dubai">Asia/Dubai (Gulf Standard Time UTC+4)</option>
                <option value="Asia/Riyadh">Asia/Riyadh (Arabia Standard Time UTC+3)</option>
                <option value="Europe/London">Europe/London (GMT / BST)</option>
                <option value="America/New_York">America/New_York (EST / EDT)</option>
                <option value="UTC">UTC (Universal Time Coordinated)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date-fmt" className="text-xs font-semibold">
                Date Format
              </Label>
              <select
                id="date-fmt"
                value={formData.dateFormat}
                onChange={(e) => updateField("dateFormat", e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 25/08/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/25/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-08-25)</option>
                <option value="DD-MMM-YYYY">DD-MMM-YYYY (e.g. 25-Aug-2026)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="time-fmt" className="text-xs font-semibold">
                Time Format
              </Label>
              <select
                id="time-fmt"
                value={formData.timeFormat}
                onChange={(e) => updateField("timeFormat", e.target.value as any)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="12h">12-hour format (e.g. 02:30 PM)</option>
                <option value="24h">24-hour military format (e.g. 14:30)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grading-sys" className="text-xs font-semibold">
                Grading System
              </Label>
              <select
                id="grading-sys"
                value={formData.gradingSystem}
                onChange={(e) => updateField("gradingSystem", e.target.value as any)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="GPA">GPA 4.0 / 5.0 System</option>
                <option value="PERCENTAGE">Percentage (%) Scale</option>
                <option value="LETTER">Letter Grade (A+, A, B, C, D, F)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Academic Setup & Structure Preset */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ay-label" className="text-xs font-semibold">
                Initial Academic Session <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ay-label"
                value={formData.academicYearLabel}
                onChange={(e) => updateField("academicYearLabel", e.target.value)}
                placeholder="e.g. 2026-2027"
                className="h-10 text-sm font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ay-start" className="text-xs font-semibold">
                Session Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ay-start"
                type="date"
                value={formData.academicStartDate}
                onChange={(e) => updateField("academicStartDate", e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ay-end" className="text-xs font-semibold">
                Session End Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ay-end"
                type="date"
                value={formData.academicEndDate}
                onChange={(e) => updateField("academicEndDate", e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Select Initial Grade Structure Template
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically seeds standard classes, sections, and foundational subject curricula.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {CLASS_TEMPLATE_PRESETS.map((preset) => {
                const info = TEMPLATE_DESCRIPTIONS[preset];
                const isSelected = formData.classTemplate === preset;
                const IconComp = info.icon;

                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateField("classTemplate", preset)}
                    className={`flex flex-col text-left p-3.5 rounded-xl border transition-all text-xs ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/30 bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <IconComp className="h-4 w-4" />
                      </div>
                      <Badge variant={isSelected ? "default" : "outline"} className="text-[10px] py-0">
                        {info.count}
                      </Badge>
                    </div>
                    <span className="font-semibold text-foreground text-sm">{info.label}</span>
                    <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {info.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Administrator Credentials */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/15 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-foreground">Institute Super Admin Account</p>
              <p className="text-muted-foreground">
                This account will have master administrative privileges over school configurations, finance, admissions, and user management.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-name" className="text-xs font-semibold">
                Principal / Admin Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="admin-name"
                placeholder="e.g. Dr. Tariq Mahmood"
                value={formData.adminName}
                onChange={(e) => updateField("adminName", e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-xs font-semibold">
                Official Login Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="e.g. principal@beaconhouse.edu"
                value={formData.adminEmail}
                onChange={(e) => updateField("adminEmail", e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-pwd" className="text-xs font-semibold">
                  Secure Password <span className="text-destructive">*</span>
                </Label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  <KeyRound className="h-3 w-3" /> Auto-generate
                </button>
              </div>
              <Input
                id="admin-pwd"
                type="text"
                placeholder="Enter password or auto-generate"
                value={formData.adminPassword}
                onChange={(e) => updateField("adminPassword", e.target.value)}
                className="h-10 text-sm font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-status" className="text-xs font-semibold">
                Subscription Status
              </Label>
              <select
                id="sub-status"
                value={formData.subscriptionStatus}
                onChange={(e) => updateField("subscriptionStatus", e.target.value as any)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="TRIAL">30-Day Free Trial</option>
                <option value="ACTIVE">Active (Paid Enterprise SaaS)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Review & Confirmation */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border border-border/80 shadow-none">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                  <Building2 className="h-4 w-4" /> Institute Details
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-bold text-base text-foreground">{formData.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">Tenant ID: {formData.tenantId}</p>
                  <p className="text-xs text-muted-foreground">{formData.address}</p>
                  {formData.email && <p className="text-xs text-muted-foreground">{formData.email}</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-none">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                  <Globe2 className="h-4 w-4" /> Regional & Financial
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-foreground">
                    Currency: {formData.currency} ({formData.currencySymbol})
                  </p>
                  <p className="text-xs text-muted-foreground">Timezone: {formData.timezone}</p>
                  <p className="text-xs text-muted-foreground">Date Format: {formData.dateFormat}</p>
                  <p className="text-xs text-muted-foreground">Grading: {formData.gradingSystem}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-none">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                  <GraduationCap className="h-4 w-4" /> Academic Setup
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-foreground">Session: {formData.academicYearLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    Template: {TEMPLATE_DESCRIPTIONS[formData.classTemplate].label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dates: {formData.academicStartDate} to {formData.academicEndDate}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-none">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                  <UserCheck className="h-4 w-4" /> Super Administrator
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-foreground">{formData.adminName}</p>
                  <p className="text-xs text-muted-foreground">Email: {formData.adminEmail}</p>
                  <p className="text-xs text-muted-foreground font-mono">Password: ••••••••</p>
                </div>
              </CardContent>
            </Card>
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
            <h3 className="text-2xl font-bold text-foreground">{provisionedData.name} is Ready!</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The school instance has been provisioned with database isolation, academic year{" "}
              <span className="font-semibold">{provisionedData.academicYear}</span>, and seeded structure.
            </p>
          </div>

          <Card className="max-w-lg mx-auto text-left border border-border/80 shadow-none">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-border pb-2">
                <span className="text-muted-foreground">Tenant Slug / ID:</span>
                <code className="font-mono font-bold text-primary">{provisionedData.tenantId}</code>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border pb-2">
                <span className="text-muted-foreground">Admin Login:</span>
                <span className="font-semibold text-foreground">{provisionedData.adminEmail}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border pb-2">
                <span className="text-muted-foreground">Classes Initialized:</span>
                <Badge variant="outline">{provisionedData.classesCount} Classes</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Subscription:</span>
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {provisionedData.subscriptionStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(
                  `School: ${provisionedData.name}\nTenant: ${provisionedData.tenantId}\nEmail: ${provisionedData.adminEmail}`
                );
                toast.success("Credentials copied to clipboard");
              }}
              className="gap-2"
            >
              <Copy className="h-4 w-4" /> Copy Details
            </Button>
            <Button
              onClick={resetAndClose}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              Finish & Return
            </Button>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      {step <= 5 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {step > 1 ? (
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Previous
            </Button>
          ) : (
            <Button variant="ghost" onClick={resetAndClose} disabled={isSubmitting}>
              Cancel
            </Button>
          )}

          {step < 5 ? (
            <Button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleProvision}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md"
            >
              {isSubmitting ? (
                <>Provisioning Infrastructure...</>
              ) : (
                <>
                  <Building2 className="h-4 w-4" /> Provision Institute Now
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </TopSheet>
  );
}
