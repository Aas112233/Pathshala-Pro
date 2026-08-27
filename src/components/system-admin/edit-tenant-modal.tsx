"use client";

import { useState, useEffect } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
            <select
              value={formData.subscriptionStatus}
              onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ACTIVE">ACTIVE (Full Subscription Paid)</option>
              <option value="TRIAL">TRIAL (30-Day Free Evaluation)</option>
              <option value="SUSPENDED">SUSPENDED (Access Blocked)</option>
              <option value="EXPIRED">EXPIRED (Renewal Required)</option>
            </select>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Operating Currency</Label>
            <select
              value={formData.currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CURRENCY_LIST.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.symbol})
                </option>
              ))}
            </select>
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
            <select
              value={formData.dateFormat}
              onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 26/08/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/26/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-08-26)</option>
            </select>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Timezone</Label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
              <option value="Asia/Dhaka">Asia/Dhaka (BST +06:00)</option>
              <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
              <option value="Asia/Riyadh">Asia/Riyadh (AST +03:00)</option>
              <option value="UTC">UTC (+00:00)</option>
            </select>
          </div>

          {/* Grading System */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Grading System</Label>
            <select
              value={formData.gradingSystem}
              onChange={(e) => setFormData({ ...formData, gradingSystem: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="GPA">GPA Scale (4.0 / 5.0)</option>
              <option value="PERCENTAGE">Percentage Only (0 - 100%)</option>
              <option value="LETTER">Letter Grades (A+, A, B, C, D, F)</option>
            </select>
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
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
