"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Pencil, Trash2, Eye, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalaryLedger } from "@/types/entities";

interface SalaryActionsDropdownProps {
  salary: SalaryLedger;
  onEdit?: (salary: SalaryLedger) => void;
  onView?: (salary: SalaryLedger) => void;
  onDelete?: (salary: SalaryLedger) => void;
  onPayment?: (salary: SalaryLedger) => void;
  onGenerateSlip?: (salary: SalaryLedger) => void;
}

export function SalaryActionsDropdown({
  salary,
  onEdit,
  onView,
  onDelete,
  onPayment,
  onGenerateSlip,
}: SalaryActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = (callback?: (salary: SalaryLedger) => void) => {
    setIsOpen(false);
    callback?.(salary);
  };

  const isPaid = salary.status === "PAID" || salary.status === "PARTIAL";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Salary actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[180px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
          style={{
            position: "fixed",
            top: `${dropdownRef.current?.getBoundingClientRect().bottom || 0 + 4}px`,
            left: `${(dropdownRef.current?.getBoundingClientRect().right || 0) - 180}px`,
          }}
        >
          <div className="p-1">
            {onView && (
              <button
                onClick={() => handleAction(onView)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors"
              >
                <Eye className="h-4 w-4" />
                <span>View Details</span>
              </button>
            )}
            {onEdit && !isPaid && (
              <button
                onClick={() => handleAction(onEdit)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors"
              >
                <Pencil className="h-4 w-4" />
                <span>Edit</span>
              </button>
            )}
            {onPayment && !isPaid && (
              <button
                onClick={() => handleAction(onPayment)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span>Record Payment</span>
              </button>
            )}
            {onGenerateSlip && (
              <button
                onClick={() => handleAction(onGenerateSlip)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span>Download Slip</span>
              </button>
            )}
            {onDelete && !isPaid && (
              <button
                onClick={() => handleAction(onDelete)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            )}
            {isPaid && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                <span className="text-amber-600 font-medium">Locked</span> - Paid records cannot be modified
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
