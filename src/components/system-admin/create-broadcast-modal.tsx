"use client";

import { useState, useEffect } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Megaphone,
  Save,
  Loader2,
  AlertTriangle,
  Building2,
  Globe2,
  Calendar,
  Eye,
  ShieldAlert,
  Server,
  Zap,
} from "lucide-react";

interface CreateBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: any;
}

const BROADCAST_CATEGORIES = [
  { value: "MAINTENANCE", label: "Scheduled Maintenance / Downtime" },
  { value: "SYSTEM_UPDATE", label: "New Feature / Platform Update" },
  { value: "BILLING_ALERT", label: "Billing & Subscription Policy" },
  { value: "URGENT_ALERT", label: "Critical System / Security Notice" },
  { value: "GENERAL", label: "General SaaS Announcement" },
];

export function CreateBroadcastModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: CreateBroadcastModalProps) {
  const isEditing = !!initialData?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantsList, setTenantsList] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "SYSTEM_UPDATE",
    priority: "HIGH",
    audience: "ALL_SCHOOLS",
    targetTenants: [] as string[],
    isPinned: true,
    isPublished: true,
    expiresAt: "",
  });

  useEffect(() => {
    async function loadTenants() {
      try {
        const res = await fetch("/api/tenants");
        const json = await res.json();
        if (json.success) setTenantsList(json.data || []);
      } catch (err) {
        console.error(err);
      }
    }
    if (isOpen) loadTenants();
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        content: initialData.content || "",
        category: initialData.category || "SYSTEM_UPDATE",
        priority: initialData.priority || "HIGH",
        audience: initialData.audience || "ALL_SCHOOLS",
        targetTenants: initialData.targetTenants || [],
        isPinned: initialData.isPinned !== undefined ? initialData.isPinned : true,
        isPublished: initialData.isPublished !== undefined ? initialData.isPublished : true,
        expiresAt: initialData.expiresAt
          ? new Date(initialData.expiresAt).toISOString().split("T")[0]
          : "",
      });
    } else {
      setFormData({
        title: "",
        content: "",
        category: "SYSTEM_UPDATE",
        priority: "HIGH",
        audience: "ALL_SCHOOLS",
        targetTenants: [],
        isPinned: true,
        isPublished: true,
        expiresAt: "",
      });
    }
  }, [initialData, isOpen]);

  const handleTenantToggle = (tenantId: string) => {
    setFormData((prev) => {
      const exists = prev.targetTenants.includes(tenantId);
      return {
        ...prev,
        targetTenants: exists
          ? prev.targetTenants.filter((id) => id !== tenantId)
          : [...prev.targetTenants, tenantId],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Please provide broadcast title and body");
      return;
    }

    if (formData.audience === "SPECIFIC_TENANTS" && formData.targetTenants.length === 0) {
      toast.error("Please select at least one school tenant to target");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEditing
        ? `/api/system-admin/notices/${initialData.id}`
        : "/api/system-admin/notices";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          isEditing ? "Broadcast updated" : "Global broadcast sent across all targeted school instances"
        );
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast.error(json.error?.message || "Failed to transmit broadcast");
      }
    } catch {
      toast.error("Network error sending broadcast");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Update Platform Broadcast" : "Broadcast Platform Announcement"}
      subtitle="SuperAdmin Global Command"
      description="Send emergency alerts, maintenance countdowns, or product updates across all 1,000+ school instances."
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="broadcast-title" className="text-xs font-semibold">
              Broadcast Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="broadcast-title"
              placeholder="e.g. Scheduled Cloud Database Upgrade - Sunday 02:00 UTC"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-10 text-sm font-semibold"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-category" className="text-xs font-semibold">
              Broadcast Type
            </Label>
            <select
              id="broadcast-category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {BROADCAST_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority & Target Audience */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Alert Severity</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "NORMAL", label: "Normal Info", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
                { value: "HIGH", label: "High Priority", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
                { value: "URGENT", label: "Urgent Banner", color: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: p.value })}
                  className={`px-2.5 py-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    formData.priority === p.value
                      ? "border-primary ring-2 ring-primary/20 shadow-xs " + p.color
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold">Target School Scope</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, audience: "ALL_SCHOOLS", targetTenants: [] })}
                className={`flex flex-col text-left p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                  formData.audience === "ALL_SCHOOLS"
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20 font-semibold"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Globe2 className="h-3.5 w-3.5" /> All Schools Globally
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  Broadcasts to every tenant instance on the platform
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, audience: "SPECIFIC_TENANTS" })}
                className={`flex flex-col text-left p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                  formData.audience === "SPECIFIC_TENANTS"
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20 font-semibold"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Building2 className="h-3.5 w-3.5" /> Specific School Tenants
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  Target selected schools only
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Tenant Picker if SPECIFIC_TENANTS */}
        {formData.audience === "SPECIFIC_TENANTS" && (
          <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Select Schools to Receive Broadcast ({formData.targetTenants.length} selected)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFormData({
                    ...formData,
                    targetTenants:
                      formData.targetTenants.length === tenantsList.length
                        ? []
                        : tenantsList.map((t) => t.tenantId),
                  })
                }
                className="text-[11px] h-6"
              >
                {formData.targetTenants.length === tenantsList.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pt-1">
              {tenantsList.map((t) => {
                const isSelected = formData.targetTenants.includes(t.tenantId);
                return (
                  <label
                    key={t.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/60 font-semibold text-indigo-700 dark:text-indigo-300"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTenantToggle(t.tenantId)}
                      className="rounded border-border text-indigo-600"
                    />
                    <span className="truncate">{t.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Broadcast Body */}
        <div className="space-y-1.5">
          <Label htmlFor="broadcast-content" className="text-xs font-semibold">
            Broadcast Announcement Message <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="broadcast-content"
            rows={5}
            placeholder="Type comprehensive platform announcement details, maintenance schedules, or action required by school administrators..."
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="text-xs leading-relaxed"
            required
          />
        </div>

        {/* Live Ribbon Preview */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-indigo-600" />
            Live School Dashboard Banner Preview
          </Label>
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              formData.priority === "URGENT"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                : formData.priority === "HIGH"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 shrink-0" />
              <div>
                <span className="font-bold">{formData.title || "Announcement Title"}</span>
                <span className="opacity-80 ml-2 text-[11px] line-clamp-1">{formData.content || "Message preview will appear here..."}</span>
              </div>
            </div>
            <Badge variant="outline" className="text-[9px] uppercase font-mono shrink-0">
              {formData.priority}
            </Badge>
          </div>
        </div>

        {/* Expiry Date */}
        <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <Label htmlFor="broadcast-expiry" className="text-xs font-semibold">
              Auto-Expire & Remove Banner
            </Label>
            <Input
              id="broadcast-expiry"
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              className="h-8 text-xs w-48"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isPublished}
              onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs font-semibold text-foreground">Activate and broadcast immediately</span>
          </label>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm text-xs h-9 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Megaphone className="h-4 w-4" />
            )}
            <span>{isEditing ? "Save Broadcast" : "Transmit Global Broadcast"}</span>
          </Button>
        </div>
      </form>
    </TopSheet>
  );
}
