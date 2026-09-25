import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdleSessionGuard } from "./idle-session-guard";

const auth = vi.hoisted(() => ({ user: { id: "u1", tenantId: "t1" } as any, logout: vi.fn() }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    const strings: Record<string, string> = {
      idleTitle: "Are you still there?",
      idleDescription: "Inactive warning",
      idleCountdown: `Signing out in ${vars?.seconds} seconds…`,
      idleStay: "Stay signed in",
      idleSignOut: "Sign out",
    };
    return strings[key] ?? key;
  },
}));

function renderGuard() {
  return render(<IdleSessionGuard idleMs={5000} warningMs={3000} />);
}

async function advance(ms: number) {
  // Extra flush covers AppModal's rAF mount chain (stubbed to setTimeout).
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await vi.advanceTimersByTimeAsync(50);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(cb, 0));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  auth.user = { id: "u1", tenantId: "t1" } as any;
  auth.logout.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("IdleSessionGuard", () => {
  it("shows the warning after the idle timeout with a live countdown", async () => {
    renderGuard();
    expect(screen.queryByText("Are you still there?")).toBeNull();
    await advance(5000);
    expect(screen.getByText("Are you still there?")).toBeTruthy();
    expect(screen.getByText("Signing out in 3 seconds…")).toBeTruthy();
    await advance(1000);
    expect(screen.getByText("Signing out in 2 seconds…")).toBeTruthy();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("signs out when the countdown reaches zero", async () => {
    renderGuard();
    await advance(5000);
    expect(screen.getByText("Are you still there?")).toBeTruthy();
    await advance(3000);
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it("dismisses the warning on user activity", async () => {
    renderGuard();
    await advance(5000);
    expect(screen.getByText("Are you still there?")).toBeTruthy();
    await act(async () => {
      window.dispatchEvent(new MouseEvent("mousedown"));
    });
    // AppModal plays a 200ms close animation before unmounting.
    await advance(300);
    expect(screen.queryByText("Are you still there?")).toBeNull();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("stays signed in after verifying the server session", async () => {
    renderGuard();
    await advance(5000);
    expect(screen.getByText("Are you still there?")).toBeTruthy();
    await act(async () => {
      screen.getByText("Stay signed in").click();
    });
    expect(fetch).toHaveBeenCalledWith("/api/auth/session", { credentials: "include" });
    // AppModal plays a 200ms close animation before unmounting.
    await advance(300);
    expect(screen.queryByText("Are you still there?")).toBeNull();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("signs out from Stay when the server session is already dead", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    renderGuard();
    await advance(5000);
    expect(screen.getByText("Are you still there?")).toBeTruthy();
    await act(async () => {
      screen.getByText("Stay signed in").click();
    });
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it("never warns without a signed-in user", async () => {
    auth.user = null;
    renderGuard();
    await advance(30000);
    expect(screen.queryByText("Are you still there?")).toBeNull();
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
