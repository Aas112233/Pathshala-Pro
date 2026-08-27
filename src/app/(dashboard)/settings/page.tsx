"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, School, DollarSign, Calendar, Save, RotateCcw, Globe, Building2, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import {
  DEFAULT_TENANT_SETTINGS,
  formatDateWithSettings,
  type TenantSettings,
} from "@/lib/tenant-settings";

import { CURRENCY_LIST } from "@/lib/currencies";

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2026)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-12-31)" },
  { value: "DD-MM-YYYY", label: "DD-MM-YYYY (31-12-2026)" },
  { value: "DD MMM YYYY", label: "DD MMM YYYY (31 Dec 2026)" },
  { value: "MMM DD, YYYY", label: "MMM DD, YYYY (Dec 31, 2026)" },
  { value: "D MMMM YYYY", label: "D MMMM YYYY (31 December 2026)" },
];

const TIME_FORMATS = [
  { value: "24h", label: "24 Hour (14:30)" },
  { value: "12h", label: "12 Hour (2:30 PM)" },
];

const CURRENCIES = CURRENCY_LIST.map((c) => ({
  value: c.code,
  symbol: c.symbol,
  label: `${c.name} (${c.code} - ${c.symbol})`,
}));

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const GRADING_SYSTEMS = [
  { value: "GPA", label: "GPA (Grade Point Average)" },
  { value: "PERCENTAGE", label: "Percentage (%)" },
  { value: "LETTER", label: "Letter Grade (A, B, C...)" },
];

function formatDatePreview(dateFormat: string) {
  const now = new Date();
  return formatDateWithSettings(now, { ...DEFAULT_TENANT_SETTINGS, dateFormat });
}

function formatTimePreview(timeFormat: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
    timeZone: timezone,
  }).format(new Date());
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { settings: savedSettings, isLoading, refreshSettings, setSettings: setGlobalSettings } = useTenantSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("school");
  const [settings, setSettings] = useState<TenantSettings>(DEFAULT_TENANT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<TenantSettings>(DEFAULT_TENANT_SETTINGS);
  const [errors, setErrors] = useState<Partial<Record<keyof TenantSettings, string>>>({});

  useEffect(() => {
    setSettings(savedSettings);
    setInitialSettings(savedSettings);
  }, [savedSettings]);

  function validateSettings(current: TenantSettings) {
    const nextErrors: Partial<Record<keyof TenantSettings, string>> = {};

    if (!current.name.trim()) nextErrors.name = "School name is required";
    if (!current.address.trim()) nextErrors.address = "Address is required";
    if (current.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current.email)) {
      nextErrors.email = "Enter a valid email address";
    }
    if (current.website && !/^https?:\/\/.+/i.test(current.website)) {
      nextErrors.website = "Website must start with http:// or https://";
    }
    if (current.establishedYear) {
      const currentYear = new Date().getFullYear();
      if (current.establishedYear < 1800 || current.establishedYear > currentYear) {
        nextErrors.establishedYear = `Year must be between 1800 and ${currentYear}`;
      }
    }
    if (current.taxRate < 0 || current.taxRate > 100) {
      nextErrors.taxRate = "Tax rate must be between 0 and 100";
    }
    if (!current.currencySymbol.trim()) {
      nextErrors.currencySymbol = "Currency symbol is required";
    }

    return nextErrors;
  }

  const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);
  const previewDate = formatDatePreview(settings.dateFormat);
  const previewTime = formatTimePreview(settings.timeFormat, settings.timezone);
  const settingsCompletion = [
    settings.name,
    settings.address,
    settings.phone,
    settings.email,
    settings.website,
    settings.motto,
  ].filter(Boolean).length;

  async function handleSave() {
    const validationErrors = validateSettings(settings);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix the highlighted settings fields");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      
      const result = await res.json();
      if (result.success) {
        toast.success("Settings saved successfully");
        if (result.data) {
          setSettings(result.data);
          setInitialSettings(result.data);
          setGlobalSettings(result.data);
        } else {
          setInitialSettings(settings);
        }
        await refreshSettings();
      } else {
        toast.error(result.message || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  function updateSetting<K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function handleReset() {
    setSettings(initialSettings);
    setErrors({});
    toast.success("Changes discarded");
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-border/60 bg-card p-5"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Settings}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" type="button" onClick={handleReset} disabled={!hasUnsavedChanges || isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button type="submit" form="settings-form" disabled={isSaving || !hasUnsavedChanges}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </PageHeader>

      {hasUnsavedChanges ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have unsaved settings changes. Save or reset before leaving this screen.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Profile Completion</p>
              <p className="text-xl font-semibold">{settingsCompletion}/6</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billing Preview</p>
              <p className="text-xl font-semibold">{settings.currencySymbol}1,000.00</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Local Time Preview</p>
              <p className="text-xl font-semibold">{previewTime}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <form
        id="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="school" className="gap-2">
            <School className="h-4 w-4" />
            <span className="hidden sm:inline">School Profile</span>
            <span className="sm:hidden">School</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Financial</span>
            <span className="sm:hidden">Financial</span>
          </TabsTrigger>
          <TabsTrigger value="datetime" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Date & Time</span>
            <span className="sm:hidden">Date</span>
          </TabsTrigger>
        </TabsList>

        {/* School Profile Tab */}
        <TabsContent value="school" className="space-y-4">
          <ERPFormSection
            title="School Information"
            description="Basic information about your school"
          >
            <ERPFormGrid cols={2}>
              <ERPFormField label="School Name" required error={errors.name} htmlFor="name">
                <Input
                  id="name"
                  value={settings.name}
                  onChange={(e) => updateSetting("name", e.target.value)}
                  placeholder="Enter school name"
                  aria-invalid={Boolean(errors.name)}
                />
              </ERPFormField>

              <ERPFormField label="School Code" htmlFor="schoolCode">
                <Input
                  id="schoolCode"
                  value={settings.schoolCode || ""}
                  onChange={(e) => updateSetting("schoolCode", e.target.value)}
                  placeholder="EIIN or school code"
                />
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormField label="Address" required error={errors.address} htmlFor="address">
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => updateSetting("address", e.target.value)}
                placeholder="Full address"
                aria-invalid={Boolean(errors.address)}
              />
            </ERPFormField>

            <ERPFormGrid cols={2}>
              <ERPFormField label="Phone" htmlFor="phone">
                <Input
                  id="phone"
                  value={settings.phone || ""}
                  onChange={(e) => updateSetting("phone", e.target.value)}
                  placeholder="+880-XXX-XXXXXX"
                />
              </ERPFormField>

              <ERPFormField label="Email" error={errors.email} htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={settings.email || ""}
                  onChange={(e) => updateSetting("email", e.target.value)}
                  placeholder="info@school.edu"
                  aria-invalid={Boolean(errors.email)}
                />
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormGrid cols={2}>
              <ERPFormField label="Logo URL" htmlFor="logoUrl">
                <Input
                  id="logoUrl"
                  value={settings.logoUrl || ""}
                  onChange={(e) => updateSetting("logoUrl", e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </ERPFormField>

              <ERPFormField label="Website" error={errors.website} htmlFor="website">
                <Input
                  id="website"
                  value={settings.website || ""}
                  onChange={(e) => updateSetting("website", e.target.value)}
                  placeholder="https://www.school.edu"
                  aria-invalid={Boolean(errors.website)}
                />
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormGrid cols={2}>
              <ERPFormField label="Established Year" error={errors.establishedYear} htmlFor="establishedYear">
                <Input
                  id="establishedYear"
                  type="number"
                  value={settings.establishedYear || ""}
                  onChange={(e) => updateSetting("establishedYear", parseInt(e.target.value) || undefined)}
                  placeholder="1990"
                  min={1800}
                  max={new Date().getFullYear()}
                  aria-invalid={Boolean(errors.establishedYear)}
                />
              </ERPFormField>

              <ERPFormField label="School Motto" htmlFor="motto">
                <Input
                  id="motto"
                  value={settings.motto || ""}
                  onChange={(e) => updateSetting("motto", e.target.value)}
                  placeholder="Education for all"
                />
              </ERPFormField>
            </ERPFormGrid>

            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-background">
                  {settings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.logoUrl} alt="School logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <School className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">{settings.name || "School Name Preview"}</p>
                  <p className="text-sm text-muted-foreground">{settings.motto || "Your school motto will appear here"}</p>
                  <p className="text-sm text-muted-foreground">{settings.address || "School address preview"}</p>
                  <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
                    {settings.email ? <span>{settings.email}</span> : null}
                    {settings.phone ? <span>{settings.phone}</span> : null}
                    {settings.website ? <span>{settings.website}</span> : null}
                  </div>
                </div>
              </div>
            </div>
          </ERPFormSection>
        </TabsContent>

        {/* Financial Settings Tab */}
        <TabsContent value="financial" className="space-y-4">
          <ERPFormSection
            title="Currency Settings"
            description="Configure currency and financial preferences"
          >
            <ERPFormGrid cols={2}>
              <ERPFormField label="Currency">
                <Select
                  value={settings.currency}
                  onValueChange={(value) => {
                    const currency = CURRENCIES.find(c => c.value === value);
                    updateSetting("currency", value);
                    updateSetting("currencySymbol", currency?.symbol || "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label="Currency Symbol" error={errors.currencySymbol}>
                <Input
                  value={settings.currencySymbol}
                  onChange={(e) => updateSetting("currencySymbol", e.target.value)}
                  placeholder="৳"
                  className="w-32"
                  aria-invalid={Boolean(errors.currencySymbol)}
                />
              </ERPFormField>

              <ERPFormField
                label="Tax Rate (%)"
                helperText="Applied to fee vouchers and transactions"
                error={errors.taxRate}
                htmlFor="taxRate"
              >
                <Input
                  id="taxRate"
                  type="number"
                  value={settings.taxRate}
                  onChange={(e) => updateSetting("taxRate", parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  step="0.01"
                  min="0"
                  max="100"
                  aria-invalid={Boolean(errors.taxRate)}
                />
              </ERPFormField>
            </ERPFormGrid>

            <div className="rounded-lg bg-muted p-4">
              <h4 className="mb-2 text-sm font-medium">Currency Preview</h4>
              <div className="flex flex-wrap items-center gap-4 text-lg">
                <span className="font-semibold">
                  {settings.currencySymbol}1,000.00
                </span>
                <span className="text-muted-foreground">
                  Fee Amount Example
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Tax-inclusive amount: {settings.currencySymbol}{(1000 + (1000 * settings.taxRate) / 100).toFixed(2)}
              </p>
            </div>
          </ERPFormSection>
        </TabsContent>

        {/* Date & Time Tab */}
        <TabsContent value="datetime" className="space-y-4">
          <ERPFormSection
            title="Date & Time Format"
            description="Configure how dates and times are displayed"
          >
            <ERPFormGrid cols={2}>
              <ERPFormField
                label="Date Format"
                helperText="Visual format only - database stores ISO format"
              >
                <Select
                  value={settings.dateFormat}
                  onValueChange={(value) => updateSetting("dateFormat", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label="Time Format">
                <Select
                  value={settings.timeFormat}
                  onValueChange={(value) => updateSetting("timeFormat", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label="Timezone">
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => updateSetting("timezone", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Dhaka">Asia/Dhaka (GMT+6)</SelectItem>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</SelectItem>
                    <SelectItem value="Asia/Karachi">Asia/Karachi (GMT+5)</SelectItem>
                    <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label="First Day of Week">
                <Select
                  value={settings.firstDayOfWeek}
                  onValueChange={(value) => updateSetting("firstDayOfWeek", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="monday">Monday</SelectItem>
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label="Academic Year Start">
                <Select
                  value={settings.academicYearStart}
                  onValueChange={(value) => updateSetting("academicYearStart", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month} value={month} className="capitalize">
                        {month.charAt(0).toUpperCase() + month.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label="Grading System">
                <Select
                  value={settings.gradingSystem}
                  onValueChange={(value) => updateSetting("gradingSystem", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADING_SYSTEMS.map((system) => (
                      <SelectItem key={system.value} value={system.value}>
                        {system.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
            </ERPFormGrid>

            <div className="rounded-lg bg-muted p-4">
              <h4 className="mb-2 text-sm font-medium">Date Preview</h4>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{previewDate}</span>
                <span className="text-muted-foreground">
                  Current Date ({settings.dateFormat})
                </span>
              </div>
              <div className="mt-2 flex items-center gap-4">
                <span className="font-semibold">{previewTime}</span>
                <span className="text-muted-foreground">
                  Current Time ({settings.timeFormat}, {settings.timezone})
                </span>
              </div>
              <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Globe className="h-4 w-4" />
                  Academic Calendar Preferences
                </div>
                <p className="mt-2 text-muted-foreground">
                  Week starts on {settings.firstDayOfWeek}. Academic year begins in {settings.academicYearStart}. Grading uses {settings.gradingSystem}.
                </p>
              </div>
            </div>
          </ERPFormSection>
        </TabsContent>
      </Tabs>
      </form>
    </div>
  );
}
