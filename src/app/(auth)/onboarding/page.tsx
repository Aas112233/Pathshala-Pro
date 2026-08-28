"use client";

import { useState } from "react";
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

const TEMPLATE_DESCRIPTIONS: Record<
  ClassTemplatePreset,
  { label: string; description: string; count: string; icon: LucideIcon }
> = {
  K_12: {
    label: "K-12 Comprehensive",
    description: "Playgroup, Nursery, KG, Grades 1-10 with Sections & Core Subjects",
    count: "13 Classes",
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
  PK_FBISE_MATRIC_INTER: {
    label: "Pakistan FBISE (Matric & Intermediate)",
    description: "FBISE SSC and HSSC classes with science, computer, arts, and commerce groups",
    count: "4 Classes",
    icon: Landmark,
  },
  IN_CBSE_SECONDARY_SR_SEC: {
    label: "India CBSE (Secondary & Senior Secondary)",
    description: "CBSE classes 9–12 with secondary and senior-secondary streams",
    count: "4 Classes",
    icon: GraduationCap,
  },
  BD_NCTB_PRIMARY_SSC_HSC: {
    label: "Bangladesh NCTB (Primary to HSC)",
    description: "NCTB primary, junior, secondary, and higher-secondary curriculum levels",
    count: "12 Classes",
    icon: School,
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

export default function PublicOnboardingPage() {
  const router = useRouter();
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
    toast.success("Generated secure password");
  };

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        toast.error("Please enter the school name");
        return false;
      }
      if (!formData.tenantId.trim()) {
        toast.error("Please provide a tenant slug");
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
        toast.error("Please enter the administrator name");
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
          "Failed to provision school ERP";
        toast.error(errorMsg);
        setIsSubmitting(false);
        return;
      }

      setProvisionedData(json.data);
      setStep(6);
      toast.success("School onboarded successfully!");
    } catch {
      toast.error("Network error during provisioning. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600 text-white mb-3 shadow-md">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Register Your Educational Institute
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Launch your dedicated Pathshala-Pro cloud ERP in under 2 minutes.
          </p>
        </div>

        {/* Wizard Card */}
        <Card className="border border-border/80 shadow-xl bg-card rounded-2xl overflow-hidden">
          {step <= 5 && (
            <div className="border-b border-border bg-muted/30 px-6 py-4">
              <div className="flex items-center justify-between">
                {[
                  { num: 1, label: "Profile", icon: Building2 },
                  { num: 2, label: "Localization", icon: Globe2 },
                  { num: 3, label: "Academics", icon: GraduationCap },
                  { num: 4, label: "Admin Account", icon: UserCheck },
                  { num: 5, label: "Provision", icon: ShieldCheck },
                ].map((s) => {
                  const isActive = step === s.num;
                  const isCompleted = step > s.num;

                  return (
                    <div
                      key={s.num}
                      className={`flex items-center gap-2 text-xs font-semibold ${
                        isActive
                          ? "text-indigo-600 dark:text-indigo-400"
                          : isCompleted
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          isActive
                            ? "bg-indigo-600 text-white"
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
            {/* Step 1: Institute Profile */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Institute Profile</h2>
                  <p className="text-xs text-muted-foreground">Provide official identity and campus location.</p>
                </div>

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
                      School Slug / Subdomain <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="inst-slug"
                      placeholder="e.g. beaconhouse-intl"
                      value={formData.tenantId}
                      onChange={(e) =>
                        updateField("tenantId", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                      }
                      className="h-10 text-sm font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inst-code" className="text-xs font-semibold">
                      School Code / Reg Number
                    </Label>
                    <Input
                      id="inst-code"
                      placeholder="e.g. BIA-2026"
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
                      placeholder="Campus Street, Sector / Area, City, Country"
                      value={formData.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      className="text-sm min-h-[70px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inst-phone" className="text-xs font-semibold">
                      Official Contact Phone
                    </Label>
                    <Input
                      id="inst-phone"
                      placeholder="+92 300 1234567"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inst-email" className="text-xs font-semibold">
                      Official Contact Email
                    </Label>
                    <Input
                      id="inst-email"
                      type="email"
                      placeholder="info@beaconhouse.edu"
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
                  <h2 className="text-lg font-bold text-foreground">Regional & Financial Settings</h2>
                  <p className="text-xs text-muted-foreground">Configure your local currency, timezone, and calendar.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Billing Currency</Label>
                    <select
                      value={formData.currency}
                      onChange={(e) => updateField("currency", e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CURRENCY_LIST.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.symbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tax-rate" className="text-xs font-semibold">
                      Applicable Tax / VAT Rate (%)
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
                    <Label className="text-xs font-semibold">System Timezone</Label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => updateField("timezone", e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="Asia/Karachi">Pakistan (PKT, UTC+5)</option>
                      <option value="Asia/Dhaka">Bangladesh (BST, UTC+6)</option>
                      <option value="Asia/Kolkata">India (IST, UTC+5:30)</option>
                      <option value="Asia/Dubai">UAE (GST, UTC+4)</option>
                      <option value="Asia/Riyadh">Saudi Arabia (AST, UTC+3)</option>
                      <option value="Europe/London">London (GMT/BST, UTC+0/+1)</option>
                      <option value="America/New_York">Eastern Time (EST/EDT, UTC-5)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Standard Date Format</Label>
                    <select
                      value={formData.dateFormat}
                      onChange={(e) => updateField("dateFormat", e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</option>
                      <option value="DD-MM-YYYY">DD-MM-YYYY (31-12-2026)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Academic System */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Academic Structure</h2>
                  <p className="text-xs text-muted-foreground">
                    Define the first active academic session and auto-generate class structures.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="acad-label" className="text-xs font-semibold">
                      Academic Year Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="acad-label"
                      placeholder="e.g. 2026-2027"
                      value={formData.academicYearLabel}
                      onChange={(e) => updateField("academicYearLabel", e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="acad-start" className="text-xs font-semibold">
                      Session Start Date <span className="text-destructive">*</span>
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
                      Session End Date <span className="text-destructive">*</span>
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
                  <Label className="text-xs font-semibold">Choose Initial Grade Structure</Label>
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
                          className={`flex flex-col text-left p-3.5 rounded-xl border transition-all text-xs cursor-pointer ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 ring-1 ring-indigo-600 shadow-sm"
                              : "border-border hover:border-primary/40 bg-card"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-2">
                            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                              <IconComp className="h-4 w-4" />
                            </div>
                            <Badge
                              variant={isSelected ? "default" : "outline"}
                              className={`text-[10px] py-0 ${isSelected ? "bg-indigo-600" : ""}`}
                            >
                              {info.count}
                            </Badge>
                          </div>
                          <span className="font-bold text-foreground text-sm">{info.label}</span>
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

            {/* Step 4: Administrator Account */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Principal / Super Admin Account</h2>
                  <p className="text-xs text-muted-foreground">
                    Create the master administrator login credentials to manage your ERP.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-name" className="text-xs font-semibold">
                      Full Name <span className="text-destructive">*</span>
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
                      Login Email <span className="text-destructive">*</span>
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

                  <div className="space-y-1.5 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="admin-pwd" className="text-xs font-semibold">
                        Master Password <span className="text-destructive">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <KeyRound className="h-3 w-3" /> Generate Secure Password
                      </button>
                    </div>
                    <Input
                      id="admin-pwd"
                      type="text"
                      placeholder="Minimum 6 characters"
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
                  <h2 className="text-lg font-bold text-foreground">Review & Confirm Setup</h2>
                  <p className="text-xs text-muted-foreground">
                    Verify all configurations before instant cloud provisioning.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5 text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                      School Details
                    </span>
                    <p className="font-bold text-foreground text-sm">{formData.name}</p>
                    <p className="text-muted-foreground font-mono">Slug: {formData.tenantId}</p>
                    <p className="text-muted-foreground">{formData.address}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5 text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                      Financial & Regional
                    </span>
                    <p className="font-bold text-foreground">
                      {formData.currency} ({formData.currencySymbol})
                    </p>
                    <p className="text-muted-foreground">Timezone: {formData.timezone}</p>
                    <p className="text-muted-foreground">Date: {formData.dateFormat}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5 text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                      Academic System
                    </span>
                    <p className="font-bold text-foreground">{formData.academicYearLabel}</p>
                    <p className="text-muted-foreground">
                      Template: {TEMPLATE_DESCRIPTIONS[formData.classTemplate].label}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5 text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                      Super Admin
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
                    Welcome to Pathshala-Pro, {provisionedData.name}!
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Your school ERP instance is live with full database isolation, academic year{" "}
                    <span className="font-semibold text-foreground">{provisionedData.academicYear}</span>, and initial
                    grade structures.
                  </p>
                </div>

                <div className="max-w-md mx-auto p-4 rounded-xl border border-border bg-muted/30 text-left space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">Institute Tenant ID:</span>
                    <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{provisionedData.tenantId}</code>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">Super Admin Email:</span>
                    <span className="font-semibold text-foreground">{provisionedData.adminEmail}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Classes Seeded:</span>
                    <Badge variant="outline">{provisionedData.classesCount} Classes</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `School: ${provisionedData.name}\nTenant ID: ${provisionedData.tenantId}\nLogin Email: ${provisionedData.adminEmail}`
                      );
                      toast.success("School details copied");
                    }}
                    className="gap-2 text-xs"
                  >
                    <Copy className="h-4 w-4" /> Copy Credentials
                  </Button>
                  <Button
                    onClick={() => router.push("/login")}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs"
                  >
                    <LogIn className="h-4 w-4" /> Go to Login Portal
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
                    <ArrowLeft className="h-4 w-4" /> Previous
                  </Button>
                ) : (
                  <Link href="/login">
                    <Button variant="ghost" className="text-muted-foreground text-xs">
                      Back to Login
                    </Button>
                  </Link>
                )}

                {step < 5 ? (
                  <Button
                    onClick={handleNext}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs"
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleProvision}
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md text-xs"
                  >
                    {isSubmitting ? (
                      <>Provisioning School ERP...</>
                    ) : (
                      <>
                        <Building2 className="h-4 w-4" /> Complete & Launch School
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
        &copy; {new Date().getFullYear()} Pathshala-Pro ERP. All rights reserved.
      </div>
    </div>
  );
}
