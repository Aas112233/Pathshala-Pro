"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { TopSheet } from "@/components/ui/top-sheet";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Bell,
  Calendar,
  Pin,
  Globe,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  CalendarDays,
  FileText,
} from "lucide-react";

interface CreateNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: any;
}

const CATEGORIES = [
  { value: "GENERAL", label: "General Circular" },
  { value: "ACADEMIC", label: "Academic / Exam Schedule" },
  { value: "HOLIDAY", label: "Holiday & Vacation Notice" },
  { value: "FEE", label: "Fee Reminder & Payment Schedule" },
  { value: "EVENT", label: "Sports & Cultural Event" },
  { value: "EMERGENCY", label: "Urgent Campus Alert" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { value: "NORMAL", label: "Normal", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { value: "HIGH", label: "High", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "URGENT", label: "Urgent Alert", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
];

const AUDIENCES = [
  { value: "ALL", label: "Campus-Wide", desc: "Visible to Students, Teachers & Parents" },
  { value: "STUDENTS", label: "Students Only", desc: "Filtered to Student Profiles" },
  { value: "TEACHERS", label: "Teaching Staff", desc: "Faculty and Department Staff" },
  { value: "PARENTS", label: "Parents", desc: "Parent Portal Feed" },
];

export function CreateNoticeModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: CreateNoticeModalProps) {
  const t = useTranslations("notices");
  const isEditing = !!initialData?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "GENERAL",
    priority: "NORMAL",
    audience: "ALL",
    isPinned: false,
    isPublished: true,
    expiresAt: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        content: initialData.content || "",
        category: initialData.category || "GENERAL",
        priority: initialData.priority || "NORMAL",
        audience: initialData.audience || "ALL",
        isPinned: !!initialData.isPinned,
        isPublished: initialData.isPublished ?? true,
        expiresAt: initialData.expiresAt
          ? new Date(initialData.expiresAt).toISOString().split("T")[0]
          : "",
      });
    } else {
      setFormData({
        title: "",
        content: "",
        category: "GENERAL",
        priority: "NORMAL",
        audience: "ALL",
        isPinned: false,
        isPublished: true,
        expiresAt: "",
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error(t("requiredFields"));
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEditing ? `/api/notices/${initialData.id}` : "/api/notices";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          isEditing ? "Notice updated successfully" : "Notice published to school noticeboard"
        );
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast.error(json.error?.message || "Failed to save notice");
      }
    } catch {
      toast.error(t("networkError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Update Institutional Notice" : "Publish Institutional Notice"}
      subtitle="School Noticeboard & Circulars"
      description="Post official announcements, exam updates, fee reminders, or urgent campus circulars."
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Notice Title & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="notice-title" className="text-xs font-semibold">
              Notice Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="notice-title"
              placeholder="e.g. Annual Sports Week 2026 Schedule & Guidelines"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-10 text-sm font-semibold"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notice-category" className="text-xs font-semibold">
              Category
            </Label>
            <AppDropdown
              id="notice-category"
              value={formData.category}
              onChange={(v) => setFormData({ ...formData, category: v })}
              options={CATEGORIES}
            />
          </div>
        </div>

        {/* Priority & Target Audience */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Priority Level</Label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: p.value })}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
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
            <Label className="text-xs font-semibold">Target Audience</Label>
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCES.map((aud) => (
                <button
                  key={aud.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, audience: aud.value })}
                  className={`flex flex-col text-left p-2 rounded-lg border text-xs transition-all cursor-pointer ${
                    formData.audience === aud.value
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20 font-semibold"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{aud.label}</span>
                  <span className="text-[10px] text-muted-foreground">{aud.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-1.5">
          <Label htmlFor="notice-content" className="text-xs font-semibold">
            Notice Body / Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="notice-content"
            rows={7}
            placeholder="Type complete circular details, dates, instructions, or required student preparations..."
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="text-xs leading-relaxed"
            required
          />
        </div>

        {/* Expiry Date & Pin Option */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-lg border border-border/80 bg-muted/20">
          <div className="space-y-1.5">
            <Label htmlFor="notice-expiry" className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Optional Expiration Date
            </Label>
            <Input
              id="notice-expiry"
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Notice will auto-archive after this date.</p>
          </div>

          <div className="flex flex-col justify-center space-y-3 pt-2 sm:pt-0">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPinned"
                checked={formData.isPinned}
                onCheckedChange={(checked) => setFormData({ ...formData, isPinned: !!checked })}
              />
              <Label htmlFor="isPinned" className="text-xs font-medium cursor-pointer flex items-center gap-1">
                <Pin className="h-3 w-3 text-amber-500" /> Pin to Top of Noticeboard
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPublished"
                checked={formData.isPublished}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublished: !!checked })}
              />
              <Label htmlFor="isPublished" className="text-xs font-medium cursor-pointer flex items-center gap-1">
                <Globe className="h-3 w-3 text-emerald-500" /> Publish Immediately
              </Label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting} className="text-xs">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-6"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : isEditing ? (
              "Save Changes"
            ) : (
              "Publish Notice"
            )}
          </Button>
        </div>
      </form>
    </TopSheet>
  );
}
