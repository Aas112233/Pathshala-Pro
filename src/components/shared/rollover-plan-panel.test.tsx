import { describe, expect, it, vi } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import {
  NOT_COPIED_CONFIGURATION,
  planRollover,
  type RolloverCopyOptions,
  type RolloverFeeStructure,
  type RolloverPlan,
  type RolloverRule,
  type RolloverTimetable,
} from "@/lib/rollover-plan";
import { RolloverPlanPanel } from "./rollover-plan-panel";

/**
 * The rollover plan panel, rendered.
 *
 * Every plan here comes from `planRollover` rather than from a hand-written
 * fixture. A panel tested against a fixture proves the panel matches the
 * fixture; a panel tested against the module proves the panel matches what the
 * server will actually send, which is the only thing that matters — the wizard's
 * entire justification is that its preview describes the write truthfully.
 *
 * The load-bearing assertions are negative. A missing `rollover.*` key does not
 * throw in use-intl; it renders the raw key path, and the panel's `catch` then
 * substitutes the module's English `message`. So the tests that matter are
 * "the English fallback is not on screen" and "the raw key is not on screen",
 * not "some text appeared".
 */

const LOCALES = ["en", "ur", "hi", "bn"] as const;

const CLASSES = [
  { id: "cls-1", name: "Class 1", classNumber: 1 },
  { id: "cls-2", name: "Class 2", classNumber: 2 },
];

function rule(overrides: Partial<RolloverRule> = {}): RolloverRule {
  return {
    classId: "cls-1",
    minimumAttendance: 75,
    minimumOverallPercentage: 40,
    minimumPerSubject: 33,
    maxFailedSubjects: 0,
    allowConditionalPromotion: false,
    autoPromote: true,
    nextClassId: "cls-2",
    isActive: true,
    ...overrides,
  };
}

function fee(overrides: Partial<RolloverFeeStructure> = {}): RolloverFeeStructure {
  return {
    classId: "cls-1",
    tuitionFee: 1000,
    labFee: 100,
    computerFee: 50,
    examFee: 200,
    sportsFee: 0,
    libraryFee: 0,
    otherFee: 0,
    totalMonthlyFee: 1350,
    billingCycle: "MONTHLY",
    notes: null,
    isActive: true,
    ...overrides,
  };
}

const SOURCE = {
  id: "ay-2025",
  label: "2025-2026",
  startDate: "2025-04-01T00:00:00.000Z",
  endDate: "2026-03-31T00:00:00.000Z",
  isClosed: true,
  nonWorkingWeekdays: [0] as unknown,
};

interface PlanOverrides {
  source?: Partial<typeof SOURCE> & {
    promotionRules?: RolloverRule[];
    feeStructures?: RolloverFeeStructure[];
    timetables?: RolloverTimetable[];
  };
  target?: {
    mode: "CREATE";
    yearId: string;
    label: string;
    startDate: string;
    endDate: string;
  };
  targetPromotionRules?: RolloverRule[];
  targetFeeStructures?: RolloverFeeStructure[];
  existingYearIds?: string[];
  copy?: RolloverCopyOptions;
}

/**
 * A target that starts *before* the source, which is the headline refusal: a
 * year that does not start later is not the next year.
 *
 * The dates matter. An earlier draft used June 2025 against an April 2025
 * source, which starts later and is therefore perfectly valid — the plan came
 * back clear and every "blocked" assertion failed. The fixture has to be a
 * refusal, not a description of one.
 */
const NOT_AFTER_SOURCE = {
  mode: "CREATE" as const,
  yearId: "AY2025B",
  label: "2025-2026 (repeat)",
  startDate: "2025-03-01T00:00:00.000Z",
  endDate: "2026-02-28T00:00:00.000Z",
};

function plan(overrides: PlanOverrides = {}): RolloverPlan {
  return planRollover({
    source: {
      ...SOURCE,
      promotionRules: [rule()],
      feeStructures: [fee()],
      timetables: [],
      ...overrides.source,
    },
    target: overrides.target ?? {
      mode: "CREATE",
      yearId: "AY2026",
      label: "2026-2027",
      startDate: "2026-04-01T00:00:00.000Z",
      endDate: "2027-03-31T00:00:00.000Z",
    },
    targetPromotionRules: overrides.targetPromotionRules ?? [],
    targetFeeStructures: overrides.targetFeeStructures ?? [],
    targetTimetables: [],
    allClasses: CLASSES,
    allSections: [],
    existingYearIds: overrides.existingYearIds ?? [],
    copy: overrides.copy ?? { promotionRules: true, feeStructures: true, timetables: false },
    feeBalancePolicy: "CARRY_BALANCE",
    targetFeeBalancePolicy: null,
    sourceOutstanding: { studentCount: 0, totalBalance: 0 },
  });
}

function localeMessages(locale: string): typeof messages {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), `src/messages/${locale}.json`), "utf8")
  );
}

/**
 * Renders with the messages of the locale under test.
 *
 * An earlier draft passed the `en` bundle to every locale. Every "the
 * translation is on screen" assertion then failed, which was the right answer
 * to the wrong question — the panel was fine and the harness was lying. The
 * bundle has to follow the locale or the test proves nothing about translation.
 */
function renderPanel(ui: React.ReactElement, locale: string = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={localeMessages(locale)}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("RolloverPlanPanel — a clear plan", () => {
  it("says it is ready and does not render the module's English fallback", () => {
    const clear = plan();
    expect(clear.canProceed).toBe(true);

    const { container } = renderPanel(<RolloverPlanPanel plan={clear} />);
    const text = container.textContent ?? "";

    expect(screen.getByText(messages.rollover.ready)).toBeTruthy();
    // Nothing was blocked, so no blocker sentence is on screen...
    expect(text).not.toContain(messages.rollover.blocked);
    // ...and the panel never echoes the module's own `message` field.
    for (const finding of [...clear.blockers, ...clear.warnings]) {
      expect(text).not.toContain(finding.message);
    }
  });

  it("renders each diff row's class name, not its payload", () => {
    const clear = plan();
    const { container } = renderPanel(<RolloverPlanPanel plan={clear} />);
    const text = container.textContent ?? "";

    expect(clear.promotionRules.counts.created).toBe(1);
    expect(text).toContain("Class 1");
    // The payload is what the server is about to write. Echoing it here would
    // make this panel a second, divergent rendering of the rule form.
    expect(text).not.toContain("minimumAttendance");
    expect(text).not.toContain("1350");
  });

  it("names the changed fields of an updated row in the reader's language", () => {
    // The target already holds a rule that differs in one column.
    const updated = plan({
      targetPromotionRules: [rule({ minimumAttendance: 60 })],
    });

    const row = updated.promotionRules.updated[0];
    expect(row?.changedFields).toEqual(["minimumAttendance"]);

    const { container } = renderPanel(<RolloverPlanPanel plan={updated} />);
    const text = container.textContent ?? "";

    expect(text).toContain(messages.rollover.fields.minimumAttendance);
    // The raw column name must never reach the operator.
    expect(text).not.toContain("minimumAttendance");
  });

  it("explains a skipped row with the translated reason, not the code", () => {
    // Identical on both sides, so the run would be a no-op.
    const skipped = plan({ targetPromotionRules: [rule()] });

    const row = skipped.promotionRules.skipped[0];
    expect(row?.reason?.code).toBe("ALREADY_IDENTICAL");

    const { container } = renderPanel(<RolloverPlanPanel plan={skipped} />);
    const text = container.textContent ?? "";

    expect(text).toContain(messages.rollover.skipReasons.ALREADY_IDENTICAL);
    expect(text).not.toContain("ALREADY_IDENTICAL.");
  });

  it("reports the working-day policy the target year will run on", () => {
    const clear = plan();
    expect(clear.target.writesWorkingDayPolicy).toBe(true);

    const { container } = renderPanel(<RolloverPlanPanel plan={clear} />);
    const text = container.textContent ?? "";

    expect(text).toContain(messages.rollover.workingDayPolicyLabel);
    // Named in the reader's language, not `WEEKDAY_NAMES`' English "sunday".
    expect(text).toContain(messages.weekdays.sunday);
  });

  it("lists every exclusion the module publishes", () => {
    const clear = plan();
    const { container } = renderPanel(<RolloverPlanPanel plan={clear} />);
    const text = container.textContent ?? "";

    // The disclosure is the one thing no other screen in the product says, so
    // it is asserted entry by entry rather than by count.
    for (const entry of NOT_COPIED_CONFIGURATION) {
      expect(text, entry.key).toContain(messages.rollover.notCopied[entry.key].title);
      expect(text, entry.key).toContain(messages.rollover.notCopied[entry.key].reason);
    }
  });

  it("marks a configuration the operator declined as not requested", () => {
    const declined = plan({ copy: { promotionRules: false, feeStructures: true, timetables: false } });

    expect(declined.promotionRules.requested).toBe(false);
    expect(declined.promotionRules.counts.created).toBe(0);

    const { container } = renderPanel(<RolloverPlanPanel plan={declined} />);
    expect(container.textContent ?? "").toContain(messages.rollover.notRequested);
  });
});

describe("RolloverPlanPanel — a blocked plan", () => {
  it("renders the blocker sentence and its remedy from the code, not the English message", () => {
    const blocked = plan({ target: NOT_AFTER_SOURCE });

    expect(blocked.canProceed).toBe(false);
    const blocker = blocked.blockers.find(
      (finding) => finding.code === "TARGET_YEAR_NOT_AFTER_SOURCE"
    );
    expect(blocker).toBeDefined();

    const { container } = renderPanel(<RolloverPlanPanel plan={blocked} />);
    const text = container.textContent ?? "";

    expect(text).toContain(messages.rollover.blocked);
    expect(text).toContain(messages.rollover.resolveFirst);
    expect(text).toContain(messages.rollover.fixes.TARGET_YEAR_NOT_AFTER_SOURCE);

    // The interpolated sentence, not the module's English one.
    expect(text).toContain(blocked.source.label);
    expect(text).not.toContain(blocker!.message);

    // And the code is shown as a machine tag, which is how an operator quotes
    // the problem back to support.
    expect(text).toContain("TARGET_YEAR_NOT_AFTER_SOURCE");
  });

  it("shows the target year's own refusal when it is closed", () => {
    const blocked = planRollover({
      source: {
        ...SOURCE,
        promotionRules: [rule()],
        feeStructures: [fee()],
        timetables: [],
      },
      target: {
        mode: "EXISTING",
        academicYearId: "ay-2026",
        label: "2026-2027",
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2027-03-31T00:00:00.000Z",
        isClosed: true,
        nonWorkingWeekdays: [0],
        enrolledStudents: 0,
      },
      targetPromotionRules: [],
      targetFeeStructures: [],
      targetTimetables: [],
      allClasses: CLASSES,
      allSections: [],
      existingYearIds: ["AY2026"],
      copy: { promotionRules: true, feeStructures: true, timetables: false },
      feeBalancePolicy: "CARRY_BALANCE",
      targetFeeBalancePolicy: null,
      sourceOutstanding: { studentCount: 0, totalBalance: 0 },
    });

    const { container } = renderPanel(<RolloverPlanPanel plan={blocked} />);
    const text = container.textContent ?? "";

    expect(text).toContain(messages.rollover.fixes.TARGET_YEAR_CLOSED);
    expect(text).not.toContain(
      blocked.blockers.find((f) => f.code === "TARGET_YEAR_CLOSED")!.message
    );
  });
});

describe("RolloverPlanPanel — degradation", () => {
  it("falls back to the server's English for a code that has no translation", () => {
    // This is the path a code added to the module before its translation would
    // take. Blanking the screen that authorises a write is the one outcome the
    // panel must not have, so the fallback is asserted rather than assumed.
    const clear = plan();
    const unknown = {
      ...clear,
      warnings: [
        {
          code: "A_CODE_THAT_DOES_NOT_EXIST",
          severity: "warning" as const,
          params: {},
          message: "Server-side English for a code with no translation.",
        },
      ],
      counts: { ...clear.counts, warnings: 1 },
    } as unknown as RolloverPlan;

    const { container } = renderPanel(<RolloverPlanPanel plan={unknown} />);
    const text = container.textContent ?? "";

    expect(text).toContain("Server-side English for a code with no translation.");
    expect(text).not.toContain("rollover.codes.A_CODE_THAT_DOES_NOT_EXIST");
  });

  it("renders nothing but a skeleton while the first plan is being built", () => {
    const { container } = renderPanel(<RolloverPlanPanel plan={null} isPreviewing />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(container.textContent ?? "").not.toContain(messages.rollover.ready);
  });
});

describe("RolloverPlanPanel — the recheck affordance", () => {
  it("is offered only when the caller can refresh the plan", () => {
    const clear = plan();

    const without = renderPanel(<RolloverPlanPanel plan={clear} />);
    expect(without.queryByText(messages.rollover.recheck)).toBeNull();
    without.unmount();

    const onRecheck = vi.fn();
    renderPanel(<RolloverPlanPanel plan={clear} onRecheck={onRecheck} />);

    fireEvent.click(screen.getByText(messages.rollover.recheck));
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });
});

describe("RolloverPlanPanel — every locale renders its own text", () => {
  /** A blocked plan, so the verdict, the remedies and the exclusions all render. */
  const blocked = plan({ target: NOT_AFTER_SOURCE });

  for (const locale of LOCALES) {
    it(`[${locale}] renders translated copy and no raw key path`, () => {
      const localised = localeMessages(locale);
      const { container } = renderPanel(<RolloverPlanPanel plan={blocked} />, locale);
      const text = container.textContent ?? "";

      // The locale's own strings are on screen...
      expect(text, `${locale} verdict`).toContain(localised.rollover.blocked);
      expect(text, `${locale} remedy`).toContain(
        localised.rollover.fixes.TARGET_YEAR_NOT_AFTER_SOURCE
      );
      expect(text, `${locale} exclusion`).toContain(
        localised.rollover.notCopied.feeVouchers.title
      );
      // The timetable is copied now, so it must not be presented as an
      // exclusion. An exclusion claiming otherwise would contradict the third
      // bucket in the same panel.
      const exclusionTitles = Object.values(localised.rollover.notCopied).map(
        (entry) => entry.title
      );
      expect(exclusionTitles, `${locale} no timetable exclusion`).not.toContain(
        localised.rollover.copyTimetables
      );
      // The week the year runs on, named in this script rather than in English.
      expect(text, `${locale} weekday`).toContain(localised.weekdays.sunday);

      // ...and no key path leaked through as text, which is what use-intl does
      // with a missing message rather than throwing.
      for (const prefix of ["rollover.", "codes.", "fixes.", "notCopied.", "skipReasons."]) {
        expect(text, `${locale} leaked ${prefix}`).not.toContain(prefix);
      }

      // A locale that silently fell back to English would still pass the
      // assertions above, so this one rules it out.
      if (locale !== "en") {
        expect(text, `${locale} is English`).not.toContain(messages.rollover.blocked);
        expect(text, `${locale} is English`).not.toContain(messages.rollover.ready);
      }
    });
  }
});
