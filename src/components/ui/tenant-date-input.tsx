"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import {
  DEFAULT_TENANT_SETTINGS,
  formatDateWithSettings,
  formatDigitRunDate,
  parseDateWithSettings,
} from "@/lib/tenant-settings";
import { cn } from "@/lib/utils";

interface TenantDateInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "placeholder"> {
  /** ISO yyyy-mm-dd (or ""/undefined) — the same wire format native date inputs use. */
  value?: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  /**
   * Explicit format override. Used by setup flows (onboarding / institute
   * creation) where the tenant — and its API-stored format — does not exist
   * yet and the format being picked must apply immediately.
   */
  dateFormat?: string;
}

/**
 * Tenant-aware date field. Renders the tenant's API-configured date format
 * (DD/MM/YYYY by default) as editable text and reports ISO yyyy-mm-dd —
 * so it is a drop-in replacement for `<input type="date">`, whose rendering
 * follows the browser locale and can never follow the tenant setting.
 */
export function TenantDateInput({
  value = "",
  onChange,
  className,
  placeholder,
  dateFormat: dateFormatOverride,
  onBlur,
  ...rest
}: TenantDateInputProps) {
  const t = useTranslations("common");
  const { settings } = useTenantSettings();
  const dateFormat =
    dateFormatOverride || settings.dateFormat || DEFAULT_TENANT_SETTINGS.dateFormat;

  const toDisplay = (iso: string) => (iso ? formatDateWithSettings(iso, settings) : "");
  const [text, setText] = useState(() => toDisplay(value ?? ""));
  const [invalid, setInvalid] = useState(false);

  // Sync when the ISO value or the active format changes externally
  // (resets, records loading, or a setup wizard switching formats).
  useEffect(() => {
    setText(toDisplay(value ?? ""));
    setInvalid(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, settings, dateFormat]);

  const commit = (next: string) => {
    // Digit-run shortcut: a completed 8-digit run typed without separators
    // ("31122026") is formatted in place before validation.
    const trimmed = next.trim();
    if (/^\d{8}$/.test(trimmed)) {
      const formatted = formatDigitRunDate(trimmed, dateFormat);
      const iso = formatted ? parseDateWithSettings(formatted, settings) : "";
      if (iso) {
        setText(formatted);
        setInvalid(false);
        if (iso !== value) onChange(iso);
        return;
      }
      // Invalid run (e.g. 32132026) falls through to the invalid flag below.
    }
    setText(next);
    if (!next.trim()) {
      setInvalid(false);
      if (value) onChange("");
      return;
    }
    const iso = parseDateWithSettings(next, settings);
    if (iso) {
      setInvalid(false);
      if (iso !== value) onChange(iso);
    } else {
      // Flag only full-length input — partial typing is not an error yet.
      setInvalid(next.trim().length >= dateFormat.length);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Revert unparseable text to the last committed value.
    if (text.trim() && !parseDateWithSettings(text, settings)) {
      setText(toDisplay(value ?? ""));
      setInvalid(false);
    }
    onBlur?.(e);
  };

  const externalInvalid =
    (rest as Record<string, unknown>)["aria-invalid"] === true ||
    (rest as Record<string, unknown>)["aria-invalid"] === "true";

  return (
    <Input
      {...rest}
      type="text"
      inputMode={/[A-Za-z]/.test(dateFormat) ? "text" : "numeric"}
      maxLength={dateFormat.length}
      value={text}
      onChange={(e) => commit(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder ?? dateFormat}
      aria-invalid={invalid || externalInvalid}
      title={invalid ? t("invalidDate") : undefined}
      className={cn((invalid || externalInvalid) && "border-destructive", className)}
    />
  );
}
