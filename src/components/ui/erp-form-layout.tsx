"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/** Section container for ERP forms (e.g. "Personal Details", "Academic Info", "Fee Configuration") */
export function ERPFormSection({
  title,
  description,
  children,
  className,
  headerAction,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-card p-5 shadow-none space-y-4",
        className
      )}
    >
      {(title || description || headerAction) && (
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/50">
          <div className="space-y-0.5">
            {title && (
              <h4 className="text-sm font-semibold tracking-tight text-foreground">
                {title}
              </h4>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** Responsive grid for form inputs (1, 2, 3, or 4 columns) */
export function ERPFormGrid({
  cols = 2,
  children,
  className,
}: {
  cols?: 1 | 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}) {
  const colClasses = {
    1: "grid grid-cols-1 gap-4",
    2: "grid grid-cols-1 md:grid-cols-2 gap-4",
    3: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
    4: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
  };

  return <div className={cn(colClasses[cols], className)}>{children}</div>;
}

/** Single form field with label, required asterisk, optional icon slot, helper text, and error */
export function ERPFormField({
  label,
  required,
  error,
  helperText,
  children,
  className,
  htmlFor,
  action,
}: {
  label?: ReactNode;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label
            htmlFor={htmlFor}
            className="text-xs font-semibold text-foreground/90 flex items-center gap-1"
          >
            {label}
            {required && <span className="text-rose-500 font-bold">*</span>}
          </Label>
          {action}
        </div>
      )}
      <div className="relative">{children}</div>
      {error ? (
        <span className="text-[11px] font-medium text-rose-500 animate-fadeIn">
          {error}
        </span>
      ) : helperText ? (
        <span className="text-[11px] text-muted-foreground">{helperText}</span>
      ) : null}
    </div>
  );
}

/** Sticky or standard form actions row */
export function ERPFormActions({
  children,
  className,
  sticky = false,
}: {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 pt-4",
        sticky &&
          "sticky bottom-0 z-10 border-t border-border/80 bg-background/95 backdrop-blur-md py-3 -mx-6 px-6",
        className
      )}
    >
      {children}
    </div>
  );
}
