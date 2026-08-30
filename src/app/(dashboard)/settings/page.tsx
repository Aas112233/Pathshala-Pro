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
import { Settings, School, DollarSign, Calendar, Save, RotateCcw, Globe, Building2, Clock3, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import {
  DEFAULT_TENANT_SETTINGS,
  formatDateWithSettings,
  type TenantSettings,
} from "@/lib/tenant-settings";

import { CURRENCY_LIST } from "@/lib/currencies";
import { NotificationSettingsSection } from "./notification-settings-section";
import { PaymentMethodsSettingsSection } from "./payment-methods-settings-section";

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", key: "DD_MM_YYYY" },
  { value: "MM/DD/YYYY", key: "MM_DD_YYYY" },
  { value: "YYYY-MM-DD", key: "YYYY_MM_DD" },
  { value: "DD-MM-YYYY", key: "DD_MM_YYYY_DASH" },
  { value: "DD MMM YYYY", key: "DD_MMM_YYYY" },
  { value: "MMM DD, YYYY", key: "MMM_DD_YYYY" },
  { value: "D MMMM YYYY", key: "D_MMMM_YYYY" },
];

const TIME_FORMATS = [
  { value: "24h", key: "time24" },
  { value: "12h", key: "time12" },
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
  { value: "GPA", key: "gpa" },
  { value: "PERCENTAGE", key: "percentage" },
  { value: "LETTER", key: "letter" },
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
  const nt = useTranslations('notifications');
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

    if (!current.name.trim()) nextErrors.name = t("ui.validation.schoolNameRequired");
    if (!current.address.trim()) nextErrors.address = t("ui.validation.addressRequired");
    if (current.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current.email)) {
      nextErrors.email = t("ui.validation.validEmail");
    }
    if (current.website && !/^https?:\/\/.+/i.test(current.website)) {
      nextErrors.website = t("ui.validation.validWebsite");
    }
    if (current.establishedYear) {
      const currentYear = new Date().getFullYear();
      if (current.establishedYear < 1800 || current.establishedYear > currentYear) {
        nextErrors.establishedYear = t("ui.validation.yearRange", { year: currentYear });
      }
    }
    if (current.taxRate < 0 || current.taxRate > 100) {
      nextErrors.taxRate = t("ui.validation.taxRange");
    }
    if (!current.currencySymbol.trim()) {
      nextErrors.currencySymbol = t("ui.validation.currencyRequired");
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
      toast.error(t("ui.fixErrors"));
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
        toast.success(t("ui.saved"));
        if (result.data) {
          setSettings(result.data);
          setInitialSettings(result.data);
          setGlobalSettings(result.data);
        } else {
          setInitialSettings(settings);
        }
        await refreshSettings();
      } else {
        toast.error(result.message || t("ui.saveFailed"));
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(t("ui.saveFailed"));
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
    toast.success(t("ui.discarded"));
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-border/60 bg-card p-5"
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
            {t("ui.reset")}
          </Button>
          <Button type="submit" form="settings-form" disabled={isSaving || !hasUnsavedChanges}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? t("saving") : t("saveChanges")}
          </Button>
        </div>
      </PageHeader>

      {hasUnsavedChanges ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("ui.unsaved")}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("ui.profileCompletion")}</p>
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
              <p className="text-sm text-muted-foreground">{t("ui.billingPreview")}</p>
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
              <p className="text-sm text-muted-foreground">{t("ui.localTimePreview")}</p>
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
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="school" className="gap-2">
            <School className="h-4 w-4" />
            <span className="hidden sm:inline">{t("ui.schoolTab")}</span>
            <span className="sm:hidden">{t("ui.schoolTabShort")}</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">{t("ui.financialTab")}</span>
            <span className="sm:hidden">{t("ui.financialTab")}</span>
          </TabsTrigger>
          <TabsTrigger value="payment_methods" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">{t("ui.paymentMethodsTab")}</span>
            <span className="sm:hidden">{t("ui.paymentMethodsTabShort")}</span>
          </TabsTrigger>
          <TabsTrigger value="datetime" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">{t("ui.dateTimeTab")}</span>
            <span className="sm:hidden">{t("ui.dateTimeShort")}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{nt("settingsTab")}</span>
            <span className="sm:hidden">{nt("settingsShort")}</span>
          </TabsTrigger>
        </TabsList>

        {/* School Profile Tab */}
        <TabsContent value="school" className="space-y-4">
          <ERPFormSection
            title={t("ui.schoolInfo")}
            description={t("ui.schoolInfoDesc")}
          >
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("ui.schoolNameLabel")} required error={errors.name} htmlFor="name">
                <Input
                  id="name"
                  value={settings.name}
                  onChange={(e) => updateSetting("name", e.target.value)}
                  placeholder={t("ui.enterSchoolName")}
                  aria-invalid={Boolean(errors.name)}
                />
              </ERPFormField>

              <ERPFormField label={t("ui.schoolCodeLabel")} htmlFor="schoolCode">
                <Input
                  id="schoolCode"
                  value={settings.schoolCode || ""}
                  onChange={(e) => updateSetting("schoolCode", e.target.value)}
                  placeholder={t("ui.placeholder.schoolCode")}
                />
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormField label={t("ui.addressLabel")} required error={errors.address} htmlFor="address">
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => updateSetting("address", e.target.value)}
                placeholder={t("ui.placeholder.fullAddress")}
                aria-invalid={Boolean(errors.address)}
              />
            </ERPFormField>

            <ERPFormGrid cols={2}>
              <ERPFormField label={t("ui.phoneLabel")} htmlFor="phone">
                <Input
                  id="phone"
                  value={settings.phone || ""}
                  onChange={(e) => updateSetting("phone", e.target.value)}
                  placeholder={t("ui.placeholder.phone")}
                />
              </ERPFormField>

              <ERPFormField label={t("ui.emailLabel")} error={errors.email} htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={settings.email || ""}
                  onChange={(e) => updateSetting("email", e.target.value)}
                  placeholder={t("ui.placeholder.email")}
                  aria-invalid={Boolean(errors.email)}
                />
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormGrid cols={2}>
              <ERPFormField label={t("ui.logoUrl")} htmlFor="logoUrl">
                <Input
                  id="logoUrl"
                  value={settings.logoUrl || ""}
                  onChange={(e) => updateSetting("logoUrl", e.target.value)}
                  placeholder={t("ui.placeholder.logo")}
                />
              </ERPFormField>

              <ERPFormField label={t("ui.websiteLabel")} error={errors.website} htmlFor="website">
                <Input
                  id="website"
                  value={settings.website || ""}
                  onChange={(e) => updateSetting("website", e.target.value)}
                  placeholder={t("ui.placeholder.website")}
                  aria-invalid={Boolean(errors.website)}
                />
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormGrid cols={2}>
              <ERPFormField label={t("ui.establishedYearLabel")} error={errors.establishedYear} htmlFor="establishedYear">
                <Input
                  id="establishedYear"
                  type="number"
                  value={settings.establishedYear || ""}
                  onChange={(e) => updateSetting("establishedYear", parseInt(e.target.value) || undefined)}
                  placeholder={t("ui.placeholder.year")}
                  min={1800}
                  max={new Date().getFullYear()}
                  aria-invalid={Boolean(errors.establishedYear)}
                />
              </ERPFormField>

              <ERPFormField label={t("ui.mottoLabel")} htmlFor="motto">
                <Input
                  id="motto"
                  value={settings.motto || ""}
                  onChange={(e) => updateSetting("motto", e.target.value)}
                  placeholder={t("ui.placeholder.motto")}
                />
              </ERPFormField>
            </ERPFormGrid>

            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-background">
                  {settings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.logoUrl} alt={t("ui.schoolLogoPreview")} className="h-full w-full object-cover" />
                  ) : (
                    <School className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">{settings.name || t("ui.schoolNamePreview")}</p>
                  <p className="text-sm text-muted-foreground">{settings.motto || t("ui.mottoPreview")}</p>
                  <p className="text-sm text-muted-foreground">{settings.address || t("ui.addressPreview")}</p>
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
            title={t("ui.currencyInfo")}
            description={t("ui.currencyInfoDesc")}
          >
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("ui.currencyLabel")}>
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

              <ERPFormField label={t("ui.currencySymbolLabel")} error={errors.currencySymbol}>
                <Input
                  value={settings.currencySymbol}
                  onChange={(e) => updateSetting("currencySymbol", e.target.value)}
                  placeholder={settings.currencySymbol}
                  className="w-32"
                  aria-invalid={Boolean(errors.currencySymbol)}
                />
              </ERPFormField>

              <ERPFormField
                label={t("ui.taxRateLabel")}
                helperText={t("ui.taxHelp")}
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
              <h4 className="mb-2 text-sm font-medium">{t("ui.currencyPreview")}</h4>
              <div className="flex flex-wrap items-center gap-4 text-lg">
                <span className="font-semibold">
                  {settings.currencySymbol}1,000.00
                </span>
                <span className="text-muted-foreground">
                  {t("ui.feeExample")}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("ui.taxInclusive")} {settings.currencySymbol}{(1000 + (1000 * settings.taxRate) / 100).toFixed(2)}
              </p>
            </div>
          </ERPFormSection>
        </TabsContent>

        {/* Date & Time Tab */}
        <TabsContent value="datetime" className="space-y-4">
          <ERPFormSection
            title={t("dateTimeFormat")}
            description={t("configureHowDatesDisplayed")}
          >
            <ERPFormGrid cols={2}>
              <ERPFormField
                label={t("ui.dateFormatLabel")}
                helperText={t("visualFormatOnly")}
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
                        {t(`ui.dateFormats.${format.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label={t("ui.timeFormatLabel")}>
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
                        {t(`ui.${format.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label={t("ui.timezoneLabel")}>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => updateSetting("timezone", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Dhaka">Asia/Dhaka ({t("ui.timezoneDhaka")})</SelectItem>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata ({t("ui.timezoneKolkata")})</SelectItem>
                    <SelectItem value="Asia/Karachi">Asia/Karachi ({t("ui.timezoneKarachi")})</SelectItem>
                    <SelectItem value="UTC">{t("ui.utc")}</SelectItem>
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label={t("ui.firstDayLabel")}>
                <Select
                  value={settings.firstDayOfWeek}
                  onValueChange={(value) => updateSetting("firstDayOfWeek", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">{t("ui.sunday")}</SelectItem>
                    <SelectItem value="monday">{t("ui.monday")}</SelectItem>
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label={t("ui.academicYearLabel")}>
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
                        {t(`ui.months.${month}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>

              <ERPFormField label={t("ui.gradingLabel")}>
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
                        {t(`ui.${system.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
            </ERPFormGrid>

            <div className="rounded-lg bg-muted p-4">
              <h4 className="mb-2 text-sm font-medium">{t("ui.datePreview")}</h4>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{previewDate}</span>
                <span className="text-muted-foreground">
                  {t("ui.currentDate")} ({settings.dateFormat})
                </span>
              </div>
              <div className="mt-2 flex items-center gap-4">
                <span className="font-semibold">{previewTime}</span>
                <span className="text-muted-foreground">
                  {t("ui.currentTime")} ({settings.timeFormat}, {settings.timezone})
                </span>
              </div>
              <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Globe className="h-4 w-4" />
                  {t("ui.calendarPrefs")}
                </div>
                <p className="mt-2 text-muted-foreground">
                  {t("ui.weekStarts")} {settings.firstDayOfWeek}. {t("ui.yearBegins")} {settings.academicYearStart}. {t("ui.gradingUses")} {settings.gradingSystem}.
                </p>
              </div>
            </div>
          </ERPFormSection>
        </TabsContent>
        <TabsContent value="payment_methods" className="space-y-4">
          <PaymentMethodsSettingsSection
            settings={settings}
            onChange={updateSetting}
          />
        </TabsContent>
        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettingsSection />
        </TabsContent>
      </Tabs>
      </form>
    </div>
  );
}
