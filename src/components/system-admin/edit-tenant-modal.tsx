"use client";

import { useState, useEffect } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { School, Save, Loader2 } from "lucide-react";
import { CURRENCY_LIST } from "@/lib/currencies";

interface EditTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: any;
  onSuccess?: () => void;
}

export function EditTenantModal({
  isOpen,
  onClose,
  tenant,
  onSuccess,
}: EditTenantModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    subscriptionStatus: "ACTIVE",
    currency: "PKR",
    currencySymbol: "₨",
    taxRate: 0,
    dateFormat: "DD/MM/YYYY",
    timezone: "Asia/Karachi",
    gradingSystem: "GPA",
    curriculum: "NCTB",
    maxGracePerSubject: 5,
    maxGracePerStudent: 10,
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        subscriptionStatus: tenant.subscriptionStatus || "ACTIVE",
        currency: tenant.currency || "PKR",
        currencySymbol: tenant.currencySymbol || "₨",
        taxRate: tenant.taxRate || 0,
        dateFormat: tenant.dateFormat || "DD/MM/YYYY",
        timezone: tenant.timezone || "Asia/Karachi",
        gradingSystem: tenant.gradingSystem || "GPA",
        curriculum: tenant.curriculum || "NCTB",
        maxGracePerSubject: tenant.maxGracePerSubject ?? 5,
        maxGracePerStudent: tenant.maxGracePerStudent ?? 10,
      });
    }
  }, [tenant]);

  const handleCurrencyChange = (currCode: string) => {
    const found = CURRENCY_LIST.find((c) => c.code === currCode);
    setFormData((prev) => ({
      ...prev,
      currency: currCode,
      currencySymbol: found?.symbol || "$",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("School name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.id || tenant.tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to update tenant configuration");
        return;
      }

      toast.success("School configuration updated successfully!");
      onClose();
      if (onSuccess) onSuccess();
    } catch {
      toast.error("Network error updating tenant");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tenant) return null;

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure School: ${tenant.name}`}
      subtitle={`Tenant ID: ${tenant.tenantId}`}
      description="Update core institutional metadata, active subscription status, regional currencies, and tax parameters."
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* School Name */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold">School Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-10 text-sm font-semibold"
              required
            />
          </div>

          {/* Subscription Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Subscription Status *</Label>
            <AppDropdown
              value={formData.subscriptionStatus}
              onChange={(v) => setFormData({ ...formData, subscriptionStatus: v })}
              options={[
                { value: "ACTIVE", label: "ACTIVE (Full Subscription Paid)" },
                { value: "TRIAL", label: "TRIAL (30-Day Free Evaluation)" },
                { value: "SUSPENDED", label: "SUSPENDED (Access Blocked)" },
                { value: "EXPIRED", label: "EXPIRED (Renewal Required)" }
              ]}
            />
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Operating Currency</Label>
            <AppDropdown
              value={formData.currency}
              onChange={(v) => handleCurrencyChange(v)}
              options={CURRENCY_LIST.map((cur) => ({
                value: cur.code,
                label: `${cur.name} (${cur.symbol})`
              }))}
              searchable
            />
          </div>

          {/* Tax Rate */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tax Rate (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
              className="h-10 text-sm"
            />
          </div>

          {/* Date Format */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Date Format</Label>
            <AppDropdown
              value={formData.dateFormat}
              onChange={(v) => setFormData({ ...formData, dateFormat: v })}
              options={[
                { value: "DD/MM/YYYY", label: "DD/MM/YYYY (e.g. 26/08/2026)" },
                { value: "MM/DD/YYYY", label: "MM/DD/YYYY (e.g. 08/26/2026)" },
                { value: "YYYY-MM-DD", label: "YYYY-MM-DD (e.g. 2026-08-26)" }
              ]}
            />
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Timezone</Label>
            <AppDropdown
              value={formData.timezone}
              onChange={(v) => setFormData({ ...formData, timezone: v })}
              options={[
                { value: "Asia/Karachi", label: "Asia/Karachi (PKT +05:00)" },
                { value: "Asia/Dhaka", label: "Asia/Dhaka (BST +06:00)" },
                { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +05:30)" },
                { value: "Asia/Dubai", label: "Asia/Dubai (GST +04:00)" },
                { value: "Asia/Riyadh", label: "Asia/Riyadh (AST +03:00)" },
                { value: "UTC", label: "UTC (+00:00)" }
              ]}
              searchable
            />
          </div>

          {/* Grading System */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Grading System</Label>
            <AppDropdown
              value={formData.gradingSystem}
              onChange={(v) => setFormData({ ...formData, gradingSystem: v })}
              options={[
                { value: "GPA", label: "GPA Scale (4.0 / 5.0)" },
                { value: "PERCENTAGE", label: "Percentage Only (0 - 100%)" },
                { value: "LETTER", label: "Letter Grades (A+, A, B, C, D, F)" }
              ]}
            />
          </div>

          {/* Curriculum */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Board Curriculum</Label>
            <AppDropdown
              value={formData.curriculum}
              onChange={(v) => setFormData({ ...formData, curriculum: v })}
              options={[
                { value: "NCTB", label: "Bangladesh NCTB" },
                { value: "CBSE", label: "India CBSE" },
                { value: "FBISE", label: "Pakistan FBISE" }
              ]}
            />
          </div>

          {/* Max Grace Per Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Max Grace / Subject</Label>
            <Input
              type="number"
              min="0"
              max="20"
              value={formData.maxGracePerSubject}
              onChange={(e) => setFormData({ ...formData, maxGracePerSubject: parseFloat(e.target.value) || 0 })}
              className="h-10 text-sm"
            />
          </div>

          {/* Max Grace Per Student */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Max Grace / Student</Label>
            <Input
              type="number"
              min="0"
              max="50"
              value={formData.maxGracePerStudent}
              onChange={(e) => setFormData({ ...formData, maxGracePerStudent: parseFloat(e.target.value) || 0 })}
              className="h-10 text-sm"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Save Configuration</span>
          </Button>
        </div>
      </form>
    </TopSheet>
  );
}
