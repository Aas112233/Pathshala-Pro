"use client";

import { useState, useEffect } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Bell, 
  Save, 
  Loader2, 
  Pin, 
  Calendar,
  AlertTriangle,
  GraduationCap,
  Users,
  Building2,
} from "lucide-react";

interface CreateNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: any;
}

const CATEGORIES = [
  { value: "GENERAL", label: "General Announcement" },
  { value: "ACADEMIC", label: "Academic Circular" },
  { value: "EXAMINATION", label: "Exam Schedule & Info" },
  { value: "FEE_REMINDER", label: "Fee Due Reminder" },
  { value: "HOLIDAY", label: "Holiday / Vacation Notice" },
  { value: "EVENT", label: "School Function / Event" },
  { value: "URGENT_ALERT", label: "Urgent Campus Alert" },
];

const AUDIENCES = [
  { value: "ALL", label: "Entire School Community (All)", desc: "Students, Teachers, Staff & Parents" },
  { value: "TEACHERS", label: "Faculty & Teaching Staff", desc: "Teachers & Academic Coordinators only" },
  { value: "STUDENTS", label: "Students & Guardians", desc: "All enrolled students and parent accounts" },
  { value: "PARENTS", label: "Parents & Guardians", desc: "Primary guardians & fee payers" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-muted text-muted-foreground" },
  { value: "NORMAL", label: "Normal", color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  { value: "HIGH", label: "High", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { value: "URGENT", label: "Urgent", color: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
];

export function CreateNoticeModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: CreateNoticeModalProps) {
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
        isPinned: initialData.isPinned || false,
        isPublished: initialData.isPublished !== undefined ? initialData.isPublished : true,
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
      toast.error("Please provide both title and content for the notice");
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
      toast.error("Network error saving notice");
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
            <select
              id="notice-category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((cat) => (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl border border-border/80 bg-muted/20">
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

          <div className="flex flex-col justify-center space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPinned}
                onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Pin className="h-3.5 w-3.5 text-indigo-600" />
                <span>Pin notice to top of Noticeboard</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublished}
                onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">Publish immediately upon saving</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
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
              <Save className="h-4 w-4" />
            )}
            <span>{isEditing ? "Save Changes" : "Publish Notice"}</span>
          </Button>
        </div>
      </form>
    </TopSheet>
  );
}
