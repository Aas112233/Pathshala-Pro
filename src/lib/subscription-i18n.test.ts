import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import ur from "@/messages/ur.json";
import hi from "@/messages/hi.json";
import bn from "@/messages/bn.json";

const keys = [
  "banner.graceTitle", "banner.graceEndsOn", "banner.graceActive",
  "banner.endingSoonTitle", "banner.endsOn", "banner.daysLeft", "banner.plan",
  "inactive.title", "inactive.message", "inactive.supportHeading",
  "inactive.supportText", "inactive.backToLogin",
] as const;

describe("Subscription translations", () => {
  it.each(Object.entries({ en, ur, hi, bn }))(
    "resolves every banner and inactive-page message in %s",
    (locale, messages) => {
      const onError = vi.fn();
      const t = createTranslator({ locale, messages, namespace: "subscription", onError });
      for (const key of keys) {
        expect(t.has(key)).toBe(true);
        const text = t(key, { date: "2030-01-15", days: "7", plan: "Standard" });
        expect(text).not.toBe(`subscription.${key}`);
        expect(text.length).toBeGreaterThan(0);
      }
      expect(t("banner.endsOn", { date: "2030-01-15" })).toContain("2030-01-15");
      expect(t("banner.daysLeft", { days: "7" })).toContain("7");
      expect(t("banner.plan", { plan: "Standard" })).toContain("Standard");
      expect(onError).not.toHaveBeenCalled();
    }
  );
});
