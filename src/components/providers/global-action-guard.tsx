"use client";

import React, { useEffect, useSyncExternalStore } from "react";
import { useIsMutating } from "@tanstack/react-query";

/**
 * Global Action Guard
 *
 * Tracks all active write requests (TanStack Query mutations + HTTP POST/PUT/PATCH/DELETE).
 * While any mutation or write operation is in-flight, it renders a lightweight, non-intrusive
 * global overlay with `cursor-wait` and `pointer-events-auto` that blocks UI interactions,
 * preventing users from making concurrent edits, toggling selections, or double-submitting.
 */

let activeFetchWrites = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Hook window.fetch once on client runtime to track all HTTP write operations
if (typeof window !== "undefined" && !(window as any).__PATHSHALA_FETCH_INTERCEPTED__) {
  (window as any).__PATHSHALA_FETCH_INTERCEPTED__ = true;
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const init = args[1];
    const method = (init?.method || "GET").toUpperCase();
    const isWrite = WRITE_METHODS.has(method);

    if (isWrite) {
      activeFetchWrites++;
      notify();
    }

    try {
      return await originalFetch.apply(this, args);
    } finally {
      if (isWrite) {
        activeFetchWrites = Math.max(0, activeFetchWrites - 1);
        notify();
      }
    }
  };
}

export function useActiveFetchWrites(): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => activeFetchWrites,
    () => 0
  );
}

/** Returns true if ANY TanStack Query mutation or HTTP write request is currently in-flight */
export function useIsGlobalWriting(): boolean {
  const mutatingCount = useIsMutating();
  const fetchWrites = useActiveFetchWrites();
  return mutatingCount > 0 || fetchWrites > 0;
}

export function GlobalActionGuard() {
  const isWriting = useIsGlobalWriting();

  // Intercept and swallow keyboard interaction/shortcuts during write operations
  useEffect(() => {
    if (!isWriting) return;
    const blockKeyboard = (e: KeyboardEvent) => {
      // Allow browser devtools and page refreshes
      if (
        e.key === "F12" ||
        (e.ctrlKey && (e.key === "r" || e.key === "R")) ||
        e.key === "F5"
      ) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    };

    window.addEventListener("keydown", blockKeyboard, true);
    return () => window.removeEventListener("keydown", blockKeyboard, true);
  }, [isWriting]);

  if (!isWriting) return null;

  return (
    <div
      id="global-mutation-guard"
      aria-hidden="true"
      aria-busy="true"
      className="fixed inset-0 z-[990] pointer-events-auto cursor-wait select-none bg-background/20 backdrop-blur-[0.5px] transition-opacity duration-150 animate-in fade-in"
      style={{ touchAction: "none" }}
    >
      {/* Top micro-progress bar indicating active network save */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/20 overflow-hidden shadow-xs">
        <div className="h-full bg-primary animate-pulse w-full" />
      </div>
    </div>
  );
}
