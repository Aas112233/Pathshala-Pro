"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, FileSpreadsheet, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExportOption {
  value: "excel" | "pdf";
  label: string;
  icon: React.ReactNode;
}

interface ExportDropdownProps {
  onExport: (type: "excel" | "pdf") => void;
  disabled?: boolean;
}

const exportOptions: ExportOption[] = [
  {
    value: "excel",
    label: "Export as Excel",
    icon: <FileSpreadsheet className="h-4 w-4" />,
  },
  {
    value: "pdf",
    label: "Export as PDF",
    icon: <FileText className="h-4 w-4" />,
  },
];

export function ExportDropdown({ onExport, disabled = false }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (value: "excel" | "pdf") => {
    onExport(value);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors",
          "hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          open && "bg-muted text-foreground"
        )}
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 min-w-[200px] rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95">
          {exportOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground focus:outline-none"
              )}
            >
              <span className="text-muted-foreground">{option.icon}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
