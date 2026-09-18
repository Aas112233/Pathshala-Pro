import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-provider";

const navigation = vi.hoisted(() => ({ pathname: "/login", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => navigation.pathname,
}));

function SessionStatus() {
  const { isLoading } = useAuth();
  return <div>{isLoading ? "Loading" : "Ready"}</div>;
}

function renderProvider() {
  return render(<AuthProvider><SessionStatus /></AuthProvider>);
}

beforeEach(() => {
  localStorage.clear();
  navigation.push.mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthProvider public onboarding", () => {
  it.each(["/login", "/onboarding", "/onboarding/", "/verify"])(
    "does not redirect logged-out visitors from %s",
    async (pathname) => {
      navigation.pathname = pathname;
      renderProvider();
      await screen.findByText("Ready");
      expect(navigation.push).not.toHaveBeenCalled();
    }
  );

  it("allows client navigation from login to onboarding after session restoration", async () => {
    navigation.pathname = "/login";
    const view = renderProvider();
    await screen.findByText("Ready");
    navigation.pathname = "/onboarding";
    view.rerender(<AuthProvider><SessionStatus /></AuthProvider>);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it.each(["/", "/students", "/system-admin", "/onboarding-private"])(
    "still redirects logged-out visitors from protected route %s",
    async (pathname) => {
      navigation.pathname = pathname;
      renderProvider();
      await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/login"));
    }
  );

  it("waits for session restoration before redirecting", async () => {
    navigation.pathname = "/students";
    let resolveSession!: (response: { ok: boolean }) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { resolveSession = resolve; })));
    renderProvider();
    expect(screen.getByText("Loading")).toBeDefined();
    expect(navigation.push).not.toHaveBeenCalled();
    await act(async () => resolveSession({ ok: false }));
    expect(navigation.push).toHaveBeenCalledWith("/login");
  });
});
