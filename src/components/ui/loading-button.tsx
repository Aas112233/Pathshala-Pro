"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * LoadingButton — drop-in replacement for `Button` that:
 *
 * 1. Shows an inline spinner while `loading` is true (with optional loading text).
 * 2. Automatically disables itself while loading → prevents duplicate presses.
 * 3. Sets `aria-busy` for assistive technology.
 *
 * Pair with `useSubmitGuard()` (src/hooks/use-submit-guard.ts) for full
 * double-click protection — the guard blocks re-entry even before React
 * re-renders with the new disabled state.
 *
 * Example:
 *   <LoadingButton
 *     loading={isPending}
 *     loadingText="Saving..."
 *     onClick={() => run(() => saveStudent(data))}
 *   >
 *     Save Student
 *   </LoadingButton>
 */
export interface LoadingButtonProps
    extends Omit<React.ComponentProps<typeof Button>, "disabled"> {
    /** Shows the spinner and disables the button when true. */
    loading?: boolean;
    /** Text shown while loading (defaults to the button's children). */
    loadingText?: React.ReactNode;
    /** Extra disable condition (e.g. form invalid). */
    disabled?: boolean;
    /** Keep the button width stable while text changes (recommended for CTAs). */
    keepWidth?: boolean;
}

export function LoadingButton({
    loading = false,
    loadingText,
    disabled = false,
    keepWidth = false,
    className,
    children,
    onClick,
    type = "button",
    ...props
}: LoadingButtonProps) {
    const isBlocked = disabled || loading;

    return (
        <Button
            type={type}
            disabled={isBlocked}
            aria-busy={loading || undefined}
            onClick={onClick}
            className={cn(keepWidth && "relative", className)}
            {...props}
        >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
            <span className={cn(keepWidth && loading && "opacity-90")}>
                {loading && loadingText !== undefined ? loadingText : children}
            </span>
        </Button>
    );
}