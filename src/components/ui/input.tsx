import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onKeyDown, onPaste, onWheel, ...props }, ref) => {
    const isNumberType =
      type === "number" ||
      props.inputMode === "numeric" ||
      props.inputMode === "decimal";

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isNumberType) {
        // Allow navigation, modifier shortcuts, functional control keys
        if (
          e.ctrlKey ||
          e.metaKey ||
          e.altKey ||
          e.key === "Backspace" ||
          e.key === "Delete" ||
          e.key === "Tab" ||
          e.key === "Enter" ||
          e.key === "Escape" ||
          e.key.startsWith("Arrow") ||
          e.key === "Home" ||
          e.key === "End"
        ) {
          onKeyDown?.(e);
          return;
        }

        // Handle single printable characters
        if (e.key.length === 1) {
          // Allow digits 0-9
          if (/^[0-9]$/.test(e.key)) {
            onKeyDown?.(e);
            return;
          }

          // Allow dot/decimal if not already present
          if (e.key === "." || e.key === ",") {
            const val = e.currentTarget.value;
            if (!val.includes(".") && !val.includes(",")) {
              onKeyDown?.(e);
              return;
            }
          }

          // Allow negative sign at the start if min is not constrained >= 0
          if (e.key === "-") {
            const minNum = props.min !== undefined ? Number(props.min) : undefined;
            if (minNum === undefined || minNum < 0) {
              const val = e.currentTarget.value;
              if (!val.includes("-") && e.currentTarget.selectionStart === 0) {
                onKeyDown?.(e);
                return;
              }
            }
          }

          // Block all alphabetical letters (including 'e', 'E'), symbols, etc.
          e.preventDefault();
          return;
        }
      }

      onKeyDown?.(e);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (isNumberType) {
        const text = e.clipboardData?.getData("text") || "";
        // If pasted text contains non-numeric characters, clean it
        if (/[^0-9.,-]/.test(text)) {
          e.preventDefault();
          const clean = text.replace(/[^0-9.,-]/g, "");
          if (clean) {
            try {
              document.execCommand("insertText", false, clean);
            } catch {
              // fallback if execCommand is unsupported
            }
          }
          onPaste?.(e);
          return;
        }
      }
      onPaste?.(e);
    };

    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === "number") {
        // Prevent accidental number changes on scroll
        e.currentTarget.blur();
      }
      onWheel?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-destructive disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onWheel={handleWheel}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
