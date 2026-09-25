import { describe, expect, it } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import type { PreflightFinding, PreflightReport } from "@/hooks/use-exams";
import { RolloverPreflightPanel } from "./rollover-preflight-panel";

/**
 * The pre-flight panel's translation fallback.
 *
 * This panel guards two P0 operations — the year-end promotion and the year
 * close — and it renders its findings from a runtime `code`, so it is invisible
 * to the repository-wide literal-key scanner. It shipped for as long as it has
 * with no `promotions.preflight.codes` namespace in any locale, which is why
 * `preflight-i18n.test.ts` exists.
 *
 * The behaviour pinned here is the *fallback*, and it was wrong until now.
 * The panel used to wrap `t()` in a `try/catch` on the belief that next-intl
 * throws on a missing key. It does not: it reports through `onError` and returns
 * the key path, so the `catch` was dead and an untranslated code rendered
 * `promotions.preflight.codes.X` on screen — a string that tells an operator
 * nothing at the exact moment they are deciding whether to freeze a year.
 */

function localeMessages(locale: string): typeof messages {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), `src/messages/${locale}.json`), "utf8")
  );
}

function finding(overrides: Partial<PreflightFinding> = {}): PreflightFinding {
  return {
    code: "CLASS_WITHOUT_NEXT_CLASS",
    severity: "blocker",
    subject: { kind: "class", id: "cls-5", label: "Class 5" },
    params: {
      className: "Class 5",
      classNumber: 5,
      higherClassName: "Class 6",
      higherClassNumber: 6,
    },
    message: "English fallback that must not be shown when a translation exists.",
    ...overrides,
  };
}

function report(overrides: Partial<PreflightReport> = {}): PreflightReport {
  const blockers = overrides.blockers ?? [finding()];
  return {
    canProceed: blockers.length === 0,
    blockers,
    warnings: [],
    counts: { blockers: blockers.length, warnings: 0 },
    countsByCode: {},
    truncatedCodes: [],
    ...overrides,
  };
}

function renderPanel(ui: React.ReactElement, locale: string = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={localeMessages(locale)}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("RolloverPreflightPanel — the translation fallback", () => {
  it("renders the translated sentence and the remedy for a known code", () => {
    const { container } = renderPanel(
      <RolloverPreflightPanel report={report()} scope="promotion" />
    );
    const text = container.textContent ?? "";

    // The interpolated translation, not the module's English.
    expect(text).toContain("Class 5");
    expect(text).not.toContain("English fallback that must not be shown");

    // And the remedy line, which is looked up separately.
    expect(text).toContain(messages.promotions.preflight.fixes.CLASS_WITHOUT_NEXT_CLASS);
  });

  it("falls back to the server's English for a code with no translation", () => {
    const unknown = finding({
      code: "A_CODE_THAT_DOES_NOT_EXIST",
      message: "Server-side English for a code with no translation.",
    });

    const { container } = renderPanel(<RolloverPreflightPanel report={report({ blockers: [unknown] })} />);
    const text = container.textContent ?? "";

    // The fallback is reached by asking, not by catching...
    expect(text).toContain("Server-side English for a code with no translation.");
    // ...so the key path never reaches the operator.
    expect(text).not.toContain("codes.A_CODE_THAT_DOES_NOT_EXIST");
  });

  it("renders no remedy line at all when the code has no translation", () => {
    const unknown = finding({
      code: "A_CODE_THAT_DOES_NOT_EXIST",
      message: "Server-side English.",
    });

    const { container } = renderPanel(
      <RolloverPreflightPanel report={report({ blockers: [unknown] })} />
    );

    expect(container.textContent ?? "").not.toContain("fixes.A_CODE_THAT_DOES_NOT_EXIST");
  });

  it("shows the blocked verdict while a blocker stands", () => {
    const { container } = renderPanel(<RolloverPreflightPanel report={report()} />);
    const text = container.textContent ?? "";

    expect(text).toContain(messages.promotions.preflight.blocked);
    expect(text).toContain(messages.promotions.preflight.resolveFirst);
  });

  it("says the checks passed when nothing blocks and nothing warns", () => {
    const { container } = renderPanel(<RolloverPreflightPanel report={report({ blockers: [] })} />);

    expect(container.textContent ?? "").toContain(messages.promotions.preflight.passed);
  });

  it("translates the finding in every locale", () => {
    for (const locale of ["en", "ur", "hi", "bn"] as const) {
      const localised = localeMessages(locale);
      const { container, unmount } = renderPanel(
        <RolloverPreflightPanel report={report()} />,
        locale
      );
      const text = container.textContent ?? "";

      expect(text, locale).toContain(localised.promotions.preflight.blocked);
      expect(text, locale).not.toContain("promotions.preflight.");
      expect(text, locale).not.toContain("codes.");

      if (locale !== "en") {
        expect(text, locale).not.toContain(messages.promotions.preflight.blocked);
      }
      unmount();
    }
  });

  it("warns that a truncated scan cannot support a clean verdict", () => {
    // A partial report that renders as a clean one is worse than no report,
    // because the operator closes the year on it.
    const { container } = renderPanel(
      <RolloverPreflightPanel report={report({ blockers: [] })} scanTruncated />
    );

    expect(container.textContent ?? "").toContain(messages.promotions.preflight.studentsTruncated);
  });
});
