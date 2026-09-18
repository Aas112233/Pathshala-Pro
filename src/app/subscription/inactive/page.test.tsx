import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import Page from "./page";
const mocks = vi.hoisted(() => ({ logout: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ logout: mocks.logout }) }));
vi.mock("sonner", () => ({ toast: { info: mocks.info, error: mocks.error } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const show = () => render(<NextIntlClientProvider locale="en" messages={messages}><Page /></NextIntlClientProvider>);
describe("restricted subscription page", () => {
  it("shows renewal guidance and logs out rather than linking back into a redirect loop", async () => {
    show();
    expect(screen.getByText(/Ask your institute administrator/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
  }, 15000);
  it("keeps a still-suspended tenant on the notice page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { isBlocked: true } }) }));
    show();
    fireEvent.click(screen.getByRole("button", { name: "Check renewal status" }));
    await waitFor(() => expect(mocks.info).toHaveBeenCalledWith(messages.subscription.inactive.stillInactive));
  }, 15000);
  it("surfaces status-check errors without unlocking access", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ success: false, message: "Service unavailable" }) }));
    show();
    fireEvent.click(screen.getByRole("button", { name: "Check renewal status" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Service unavailable"));
  });
});
