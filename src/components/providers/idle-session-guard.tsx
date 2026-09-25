"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlarmClock, Loader2, LogIn, LogOut } from "lucide-react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";

export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export const IDLE_WARNING_MS = 60 * 1000;

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "wheel"] as const;
const PUBLIC_PATHS = ["/login", "/register", "/onboarding", "/verify"];

interface IdleSessionGuardProps {
  idleMs?: number;
  warningMs?: number;
}

/**
 * Signs idle users out after `idleMs` of no interaction, with a `warningMs`
 * countdown modal offering Stay signed in / Sign out. Mounted once in the
 * root layout; only active while a user session exists.
 */
export function IdleSessionGuard({
  idleMs = IDLE_TIMEOUT_MS,
  warningMs = IDLE_WARNING_MS,
}: IdleSessionGuardProps) {
  const t = useTranslations("auth");
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const warningRef = useRef(false);
  const secondsRef = useRef(0);
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (warningRef.current) {
      warningRef.current = false;
      setWarningOpen(false);
    }
  }, []);

  // Any interaction means the user is back.
  useEffect(() => {
    const onActivity = () => markActive();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, onActivity, { passive: true })
    );
    return () =>
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, onActivity)
      );
  }, [markActive]);

  // Navigation counts as activity.
  useEffect(() => {
    markActive();
  }, [pathname, markActive]);

  useEffect(() => {
    if (!user) {
      warningRef.current = false;
      setWarningOpen(false);
      return;
    }
    const isPublicPath = PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );
    if (isPublicPath) return;

    const timer = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (!warningRef.current && idleFor >= idleMs) {
        warningRef.current = true;
        secondsRef.current = Math.max(1, Math.ceil(warningMs / 1000));
        setSecondsLeft(secondsRef.current);
        setWarningOpen(true);
      } else if (warningRef.current) {
        secondsRef.current -= 1;
        if (secondsRef.current <= 0) {
          warningRef.current = false;
          setWarningOpen(false);
          void logoutRef.current();
        } else {
          setSecondsLeft(secondsRef.current);
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [user, pathname, idleMs, warningMs]);

  const handleStay = useCallback(async () => {
    setVerifying(true);
    try {
      // Server session may already be dead (password changed elsewhere,
      // single-session login on another device): only stay if it is alive.
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) {
        await logoutRef.current();
        return;
      }
    } catch {
      // Offline or transient network failure: keep the local session and
      // restart the idle clock instead of signing the user out.
    } finally {
      setVerifying(false);
    }
    markActive();
  }, [markActive]);

  if (!user) return null;

  return (
    <AppModal
      isOpen={warningOpen}
      onClose={() => void handleStay()}
      title={t("idleTitle")}
      description={t("idleDescription")}
      icon={<AlarmClock className="h-5 w-5 text-primary" />}
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void logoutRef.current()}
            disabled={verifying}
            className="h-9 gap-1.5 text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("idleSignOut")}
          </Button>
          <Button
            size="sm"
            onClick={() => void handleStay()}
            disabled={verifying}
            className="h-9 gap-1.5 text-xs"
          >
            {verifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogIn className="h-3.5 w-3.5" />
            )}
            {t("idleStay")}
          </Button>
        </div>
      }
    >
      <div className="py-2 text-center">
        <p className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground">
          {secondsLeft}s
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t("idleCountdown", { seconds: secondsLeft })}
        </p>
      </div>
    </AppModal>
  );
}
