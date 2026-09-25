// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EXIT_DOCUMENT_EXPECTATION,
  MAX_FINDINGS_PER_CODE,
  PREFLIGHT_SEVERITY,
  REQUIRED_DEMOGRAPHIC_FIELDS,
  nextHigherClass,
  runPromotionPreflight,
  runYearClosePreflight,
  summarisePreflight,
  type PreflightClass,
  type PreflightCode,
  type PreflightFinding,
  type PreflightRule,
  type PromotionPreflightInput,
  type PromotionPreflightStudent,
  type YearClosePreflightInput,
  type YearClosePreflightStudent,
} from "@/lib/rollover-preflight";

/**
 * The pre-flight gate is the last thing standing between an operator and a
 * year that has been frozen with its cohort stranded inside it, so these tests
 * are written from the failure side: every one of them describes a way the
 * rollover can go wrong in production.
 */

const FROM_YEAR = {
  id: "ay-2025",
  label: "2025-2026",
  startDate: new Date("2025-04-01"),
  isClosed: false,
};

const TO_YEAR = {
  id: "ay-2026",
  label: "2026-2027",
  startDate: new Date("2026-04-01"),
  isClosed: false,
};

const CLASS_5: PreflightClass = { id: "cls-5", name: "Class 5", classNumber: 5 };
const CLASS_6: PreflightClass = { id: "cls-6", name: "Class 6", classNumber: 6 };
const CLASS_10: PreflightClass = { id: "cls-10", name: "Class 10", classNumber: 10 };

/** The attendance requirement the fixtures use. The engine reads it off the rule. */
const MINIMUM_ATTENDANCE = 75;

function rule(overrides: Partial<PreflightRule> = {}): PreflightRule {
  return {
    classId: CLASS_5.id,
    nextClassId: CLASS_6.id,
    isActive: true,
    minimumAttendance: MINIMUM_ATTENDANCE,
    ...overrides,
  };
}

const FULL_DEMOGRAPHICS = {
  guardianName: "Karim Khan",
  guardianContact: "03001234567",
  dateOfBirth: new Date("2014-06-01"),
  gender: "MALE",
};

function student(
  overrides: Partial<PromotionPreflightStudent> = {}
): PromotionPreflightStudent {
  return {
    studentProfileId: "stu-1",
    studentId: "S001",
    studentName: "Ali Khan",
    rollNumber: "12",
    hasExamResults: true,
    demographics: { ...FULL_DEMOGRAPHICS },
    enrolledAcademicYearIds: [FROM_YEAR.id],
    ...overrides,
  };
}

function promotionInput(
  overrides: Partial<PromotionPreflightInput> = {}
): PromotionPreflightInput {
  return {
    fromYear: FROM_YEAR,
    toYear: TO_YEAR,
    fromClass: CLASS_5,
    allClasses: [CLASS_5, CLASS_6],
    rule: rule(),
    cohort: [student()],
    ...overrides,
  };
}

function codes(findings: PreflightFinding[]): PreflightCode[] {
  return findings.map((f) => f.code);
}

describe("PREFLIGHT_SEVERITY", () => {
  it("treats a broken year boundary as a blocker in every scope", () => {
    expect(PREFLIGHT_SEVERITY.SAME_ACADEMIC_YEAR).toBe("blocker");
    expect(PREFLIGHT_SEVERITY.TARGET_YEAR_NOT_AFTER_SOURCE).toBe("blocker");
  });

  it("blocks on misconfiguration that would silently graduate or overwrite", () => {
    // Each of these turns into a silent data event rather than an error.
    expect(PREFLIGHT_SEVERITY.CLASS_WITHOUT_NEXT_CLASS).toBe("blocker");
    expect(PREFLIGHT_SEVERITY.DUPLICATE_ENROLLMENT).toBe("blocker");
    expect(PREFLIGHT_SEVERITY.UNPROMOTED_STUDENT).toBe("blocker");
    expect(PREFLIGHT_SEVERITY.MISSING_ROLL_NUMBER).toBe("blocker");
  });

  it("warns rather than blocks where a human can still act later", () => {
    // A certificate can be printed after the year is frozen; a missing
    // placement can be repaired. Neither should hold the whole year hostage.
    expect(PREFLIGHT_SEVERITY.UNISSUED_EXIT_DOCUMENT).toBe("warning");
    expect(PREFLIGHT_SEVERITY.MISSING_DEMOGRAPHICS).toBe("warning");
    expect(PREFLIGHT_SEVERITY.STUDENT_WITHOUT_SESSION).toBe("warning");
    expect(PREFLIGHT_SEVERITY.STUDENT_WITHOUT_RESULTS).toBe("warning");
    // A shortfall describes something that already happened and can no longer
    // be changed, so it must never be what strands a year.
    expect(PREFLIGHT_SEVERITY.ATTENDANCE_BELOW_REQUIREMENT).toBe("warning");
  });
});

describe("nextHigherClass", () => {
  it("finds the nearest class above, not the highest one", () => {
    expect(nextHigherClass([CLASS_5, CLASS_6, CLASS_10], 5)?.id).toBe(CLASS_6.id);
  });

  it("returns null for the highest class in the school", () => {
    expect(nextHigherClass([CLASS_5, CLASS_6, CLASS_10], 10)).toBeNull();
  });

  it("ignores lower classes entirely", () => {
    expect(nextHigherClass([CLASS_5], 10)).toBeNull();
  });
});

describe("runPromotionPreflight — year boundary", () => {
  it("blocks a promotion that targets its own year, and reports nothing else", () => {
    const report = runPromotionPreflight(
      promotionInput({ toYear: { ...FROM_YEAR } })
    );

    expect(report.canProceed).toBe(false);
    // The boundary is the finding. Reporting "already enrolled in the target
    // year" for every student as well would bury it.
    expect(codes(report.blockers)).toEqual(["SAME_ACADEMIC_YEAR"]);
    expect(report.warnings).toHaveLength(0);
  });

  it("blocks a target year that starts before the source year", () => {
    const report = runPromotionPreflight(
      promotionInput({
        toYear: { ...TO_YEAR, startDate: new Date("2024-04-01") },
      })
    );

    expect(codes(report.blockers)).toEqual(["TARGET_YEAR_NOT_AFTER_SOURCE"]);
    expect(report.blockers[0].params.targetStartDate).toBe("2024-04-01");
  });

  it("blocks two distinct years that start on the same day", () => {
    const report = runPromotionPreflight(
      promotionInput({ toYear: { ...TO_YEAR, startDate: FROM_YEAR.startDate } })
    );

    expect(codes(report.blockers)).toEqual(["TARGET_YEAR_NOT_AFTER_SOURCE"]);
  });

  it("blocks when either year is closed", () => {
    const report = runPromotionPreflight(
      promotionInput({ fromYear: { ...FROM_YEAR, isClosed: true } })
    );

    expect(codes(report.blockers)).toContain("YEAR_ALREADY_CLOSED");
    expect(report.blockers.find((f) => f.code === "YEAR_ALREADY_CLOSED")?.params.year).toBe(
      FROM_YEAR.label
    );
  });

  it("accepts a healthy boundary", () => {
    const report = runPromotionPreflight(promotionInput());
    expect(report.canProceed).toBe(true);
    expect(report.counts).toEqual({ blockers: 0, warnings: 0 });
  });
});

describe("runPromotionPreflight — rule readiness", () => {
  it("blocks when the class has no rule at all", () => {
    const report = runPromotionPreflight(promotionInput({ rule: null }));

    expect(codes(report.blockers)).toEqual(["NO_PROMOTION_RULE"]);
    expect(report.blockers[0].subject).toMatchObject({ kind: "class", id: CLASS_5.id });
  });

  it("blocks when the rule exists but is switched off", () => {
    const report = runPromotionPreflight(
      promotionInput({
        rule: rule({ isActive: false }),
      })
    );

    expect(codes(report.blockers)).toEqual(["NO_PROMOTION_RULE"]);
  });

  it("blocks when the rule's next class does not exist", () => {
    const report = runPromotionPreflight(
      promotionInput({
        rule: rule({ nextClassId: "cls-ghost" }),
      })
    );

    expect(codes(report.blockers)).toEqual(["NEXT_CLASS_NOT_FOUND"]);
    expect(report.blockers[0].params.nextClassId).toBe("cls-ghost");
  });

  /**
   * The defect this check exists for: a null nextClassId is how the engine
   * spells "final class", so leaving it blank on Class 5 while Class 6 exists
   * graduates the entire class instead of erroring.
   */
  it("blocks a mid-ladder class whose next class is unconfigured", () => {
    const report = runPromotionPreflight(
      promotionInput({
        rule: rule({ nextClassId: null }),
      })
    );

    const finding = report.blockers.find((f) => f.code === "CLASS_WITHOUT_NEXT_CLASS");
    expect(finding).toBeDefined();
    expect(finding!.params).toMatchObject({
      className: "Class 5",
      higherClassName: "Class 6",
      higherClassNumber: 6,
    });
    expect(report.canProceed).toBe(false);
  });

  it("allows a null next class when the class really is the highest", () => {
    const report = runPromotionPreflight(
      promotionInput({
        fromClass: CLASS_10,
        allClasses: [CLASS_5, CLASS_6, CLASS_10],
        rule: rule({ classId: CLASS_10.id, nextClassId: null }),
        cohort: [student()],
      })
    );

    expect(report.canProceed).toBe(true);
    expect(codes(report.blockers)).not.toContain("CLASS_WITHOUT_NEXT_CLASS");
  });
});

describe("runPromotionPreflight — cohort integrity", () => {
  it("blocks an empty cohort", () => {
    const report = runPromotionPreflight(promotionInput({ cohort: [] }));

    expect(codes(report.blockers)).toEqual(["EMPTY_COHORT"]);
    expect(report.blockers[0].params.className).toBe("Class 5");
  });

  it("warns about a student whose placement came from the profile", () => {
    const report = runPromotionPreflight(
      promotionInput({
        cohort: [student({ enrolledAcademicYearIds: [] })],
      })
    );

    const warning = report.warnings.find((f) => f.code === "STUDENT_WITHOUT_SESSION");
    expect(warning).toBeDefined();
    expect(warning!.params.year).toBe(FROM_YEAR.label);
    // A legacy placement is repairable, so it must not stop the rollover.
    expect(report.canProceed).toBe(true);
  });

  it("blocks a student already placed in the target year", () => {
    const report = runPromotionPreflight(
      promotionInput({
        cohort: [student({ enrolledAcademicYearIds: [FROM_YEAR.id, TO_YEAR.id] })],
      })
    );

    const blocker = report.blockers.find((f) => f.code === "DUPLICATE_ENROLLMENT");
    expect(blocker).toBeDefined();
    expect(blocker!.params.studentName).toBe("Ali Khan");
    expect(report.canProceed).toBe(false);
  });

  it("warns about a student with no examination results", () => {
    const report = runPromotionPreflight(
      promotionInput({ cohort: [student({ hasExamResults: false })] })
    );

    expect(codes(report.warnings)).toEqual(["STUDENT_WITHOUT_RESULTS"]);
    expect(report.canProceed).toBe(true);
  });

  it("blocks a student with no roll number", () => {
    const report = runPromotionPreflight(
      promotionInput({ cohort: [student({ rollNumber: "  " })] })
    );

    expect(codes(report.blockers)).toEqual(["MISSING_ROLL_NUMBER"]);
  });

  it("warns about each missing demographic field by name", () => {
    const report = runPromotionPreflight(
      promotionInput({
        cohort: [
          student({
            demographics: {
              guardianName: "  ",
              guardianContact: null,
              dateOfBirth: null,
              gender: "MALE",
            },
          }),
        ],
      })
    );

    const warning = report.warnings.find((f) => f.code === "MISSING_DEMOGRAPHICS")!;
    const missing = String(warning.params.fields).split(", ");
    expect(missing).toEqual(
      expect.arrayContaining(["guardianName", "guardianContact", "dateOfBirth"])
    );
    // Gender was supplied, so it must not be reported as missing.
    expect(missing).not.toContain("gender");
    expect(warning.params.missingCount).toBe(REQUIRED_DEMOGRAPHIC_FIELDS.length - 1);
  });

  it("does not report a demographic as missing when it is merely falsy-looking", () => {
    const report = runPromotionPreflight(
      promotionInput({
        cohort: [student({ demographics: { ...FULL_DEMOGRAPHICS, gender: "OTHER" } })],
      })
    );

    expect(codes(report.warnings)).not.toContain("MISSING_DEMOGRAPHICS");
  });

  it("blocks a roll number shared by two students in the cohort", () => {
    const report = runPromotionPreflight(
      promotionInput({
        cohort: [
          student({ studentProfileId: "stu-1", studentId: "S001", studentName: "Ali", rollNumber: "7" }),
          student({ studentProfileId: "stu-2", studentId: "S002", studentName: "Sara", rollNumber: "7" }),
        ],
      })
    );

    const blocker = report.blockers.find((f) => f.code === "DUPLICATE_ROLL_NUMBER")!;
    expect(blocker.params.rollNumber).toBe("7");
    expect(blocker.params.count).toBe(2);
    expect(String(blocker.params.students)).toContain("Ali");
    expect(String(blocker.params.students)).toContain("Sara");
  });

  it("does not treat an empty roll number as a duplicate of another empty one", () => {
    const report = runPromotionPreflight(
      promotionInput({
        cohort: [
          student({ studentProfileId: "stu-1", rollNumber: "" }),
          student({ studentProfileId: "stu-2", studentId: "S002", rollNumber: "" }),
        ],
      })
    );

    expect(codes(report.blockers)).not.toContain("DUPLICATE_ROLL_NUMBER");
    // Each is still an individual blocker.
    expect(report.countsByCode.MISSING_ROLL_NUMBER).toBe(2);
  });

  it("accumulates every distinct problem for one student rather than stopping at the first", () => {
    const report = runPromotionPreflight(
      promotionInput({
        cohort: [
          student({
            rollNumber: "",
            hasExamResults: false,
            enrolledAcademicYearIds: [TO_YEAR.id],
            demographics: { guardianName: null },
          }),
        ],
      })
    );

    expect(codes(report.blockers)).toEqual(
      expect.arrayContaining(["MISSING_ROLL_NUMBER", "DUPLICATE_ENROLLMENT"])
    );
    expect(codes(report.warnings)).toEqual(
      expect.arrayContaining([
        "STUDENT_WITHOUT_RESULTS",
        "MISSING_DEMOGRAPHICS",
        "STUDENT_WITHOUT_SESSION",
      ])
    );
  });
});

// ---------------------------------------------------------------------------
// Year close
// ---------------------------------------------------------------------------

function closeStudent(
  overrides: Partial<YearClosePreflightStudent> = {}
): YearClosePreflightStudent {
  return {
    studentProfileId: "stu-1",
    studentId: "S001",
    studentName: "Ali Khan",
    rollNumber: "12",
    hasExamResults: true,
    demographics: { ...FULL_DEMOGRAPHICS },
    classId: CLASS_5.id,
    className: CLASS_5.name,
    enrollmentCountForYear: 1,
    promotionAction: "PROMOTED",
    certificateTypes: [],
    attendanceRate: null,
    isActive: true,
    ...overrides,
  };
}

function closeInput(
  overrides: Partial<YearClosePreflightInput> = {}
): YearClosePreflightInput {
  return {
    year: FROM_YEAR,
    allClasses: [CLASS_5, CLASS_6],
    rules: [rule()],
    students: [closeStudent()],
    ...overrides,
  };
}

describe("runYearClosePreflight", () => {
  it("clears a healthy year", () => {
    const report = runYearClosePreflight(closeInput());
    expect(report.canProceed).toBe(true);
    expect(report.counts).toEqual({ blockers: 0, warnings: 0 });
  });

  it("blocks closing a year that is already closed", () => {
    const report = runYearClosePreflight(
      closeInput({ year: { ...FROM_YEAR, isClosed: true } })
    );

    expect(codes(report.blockers)).toContain("YEAR_ALREADY_CLOSED");
  });

  /**
   * The headline failure mode: the year gets frozen while the cohort is still
   * inside it, and the year is read-only afterwards.
   */
  it("blocks a year containing a student who was never promoted", () => {
    const report = runYearClosePreflight(
      closeInput({ students: [closeStudent({ promotionAction: null })] })
    );

    const blocker = report.blockers.find((f) => f.code === "UNPROMOTED_STUDENT")!;
    expect(blocker.params.studentName).toBe("Ali Khan");
    expect(blocker.params.year).toBe(FROM_YEAR.label);
    expect(report.canProceed).toBe(false);
  });

  it("reports an unconfigured class once, not once per student in it", () => {
    const report = runYearClosePreflight(
      closeInput({
        rules: [],
        students: [
          closeStudent({ studentProfileId: "stu-1" }),
          closeStudent({ studentProfileId: "stu-2", studentId: "S002", studentName: "Sara", rollNumber: "13" }),
        ],
      })
    );

    expect(report.countsByCode.NO_PROMOTION_RULE).toBe(1);
  });

  it("ignores classes that hold no students", () => {
    const report = runYearClosePreflight(
      closeInput({
        rules: [],
        students: [closeStudent({ classId: CLASS_6.id, className: CLASS_6.name })],
      })
    );

    // Class 6 is the highest class, so a null rule is legitimate there — but
    // here it has no rule at all, which is still a blocker.
    expect(report.countsByCode.NO_PROMOTION_RULE).toBe(1);
    expect(report.blockers[0].subject.id).toBe(CLASS_6.id);
    // Class 5 holds nobody, so its missing rule is not the school's problem.
    expect(report.blockers.some((f) => f.subject.id === CLASS_5.id)).toBe(false);
  });

  it("blocks a student holding more than one enrollment for the year", () => {
    const report = runYearClosePreflight(
      closeInput({ students: [closeStudent({ enrollmentCountForYear: 2 })] })
    );

    const blocker = report.blockers.find((f) => f.code === "DUPLICATE_ENROLLMENT")!;
    expect(blocker.params.count).toBe(2);
  });

  /**
   * A student placed by their profile alone cannot be *proven* to belong to the
   * year being closed — they may equally be a new admission into a later year.
   * Blocking on that would make the close unfinishable; warning is honest.
   */
  it("warns instead of blocking when a student has no enrollment row for the year", () => {
    const report = runYearClosePreflight(
      closeInput({
        students: [
          closeStudent({ enrollmentCountForYear: 0, promotionAction: null }),
        ],
      })
    );

    expect(codes(report.warnings)).toContain("STUDENT_WITHOUT_SESSION");
    expect(codes(report.blockers)).not.toContain("UNPROMOTED_STUDENT");
    expect(report.canProceed).toBe(true);
  });

  it("does not block on an unpromoted student who already left the roster", () => {
    const report = runYearClosePreflight(
      closeInput({
        students: [closeStudent({ promotionAction: null, isActive: false })],
      })
    );

    expect(codes(report.blockers)).not.toContain("UNPROMOTED_STUDENT");
    expect(report.canProceed).toBe(true);
  });

  it("warns about an unmarked student rather than blocking the close", () => {
    const report = runYearClosePreflight(
      closeInput({ students: [closeStudent({ hasExamResults: false })] })
    );

    expect(codes(report.warnings)).toContain("STUDENT_WITHOUT_RESULTS");
    expect(report.canProceed).toBe(true);
  });

  describe("exit documents", () => {
    it("warns about a graduate who holds no leaving certificate", () => {
      const report = runYearClosePreflight(
        closeInput({
          students: [closeStudent({ promotionAction: "GRADUATED", certificateTypes: [] })],
        })
      );

      const warning = report.warnings.find((f) => f.code === "UNISSUED_EXIT_DOCUMENT")!;
      expect(warning.params.action).toBe("GRADUATED");
      expect(String(warning.params.expectedDocuments)).toContain("CHARACTER");
    });

    it("accepts any one of the documents a graduate may be given", () => {
      for (const type of EXIT_DOCUMENT_EXPECTATION.GRADUATED) {
        const report = runYearClosePreflight(
          closeInput({
            students: [closeStudent({ promotionAction: "GRADUATED", certificateTypes: [type] })],
          })
        );
        expect(codes(report.warnings)).not.toContain("UNISSUED_EXIT_DOCUMENT");
      }
    });

    it("warns about a transfer-out with no transfer certificate", () => {
      const report = runYearClosePreflight(
        closeInput({
          students: [closeStudent({ promotionAction: "TRANSFERRED", certificateTypes: [] })],
        })
      );

      expect(report.warnings.find((f) => f.code === "UNISSUED_EXIT_DOCUMENT")?.params.action).toBe(
        "TRANSFERRED"
      );
    });

    it("does not accept a character certificate in place of a transfer certificate", () => {
      const report = runYearClosePreflight(
        closeInput({
          students: [
            closeStudent({ promotionAction: "TRANSFERRED", certificateTypes: ["CHARACTER"] }),
          ],
        })
      );

      expect(codes(report.warnings)).toContain("UNISSUED_EXIT_DOCUMENT");
    });

    it("asks nothing of a student who did not leave the roster", () => {
      for (const action of ["PROMOTED", "RETAINED", "CONDITIONAL_PROMOTED", "DEMOTED"]) {
        const report = runYearClosePreflight(
          closeInput({ students: [closeStudent({ promotionAction: action })] })
        );
        expect(codes(report.warnings)).not.toContain("UNISSUED_EXIT_DOCUMENT");
      }
    });
  });

  describe("attendance", () => {
    it("warns about a student below their class requirement, and still lets the year close", () => {
      const report = runYearClosePreflight(
        closeInput({ students: [closeStudent({ attendanceRate: 68 })] })
      );

      const warning = report.warnings.find(
        (f) => f.code === "ATTENDANCE_BELOW_REQUIREMENT"
      )!;
      expect(warning.params.actual).toBe(68);
      expect(warning.params.required).toBe(MINIMUM_ATTENDANCE);
      expect(warning.params.year).toBe(FROM_YEAR.label);
      expect(warning.subject).toMatchObject({ kind: "student", id: "stu-1" });
      // The year is over and the register is closed: the shortfall is worth
      // reporting and never worth trapping the whole year for.
      expect(codes(report.blockers)).not.toContain("ATTENDANCE_BELOW_REQUIREMENT");
      expect(report.canProceed).toBe(true);
    });

    it("does not warn at exactly the requirement", () => {
      const report = runYearClosePreflight(
        closeInput({ students: [closeStudent({ attendanceRate: MINIMUM_ATTENDANCE })] })
      );

      expect(codes(report.warnings)).not.toContain("ATTENDANCE_BELOW_REQUIREMENT");
      expect(report.counts).toEqual({ blockers: 0, warnings: 0 });
    });

    /**
     * The regression that matters most. `null` means the school records no
     * attendance — and `null < 75` is `true` in JavaScript, so without the
     * guard the close would report every student in an attendance-less school
     * as a defaulter. That is the same coercion that made the seven attendance
     * surfaces disagree before `attendance-rate.ts` existed.
     */
    it("never enforces a requirement against an untracked student", () => {
      const report = runYearClosePreflight(
        closeInput({ students: [closeStudent({ attendanceRate: null })] })
      );

      expect(codes(report.warnings)).not.toContain("ATTENDANCE_BELOW_REQUIREMENT");
      expect(report.counts).toEqual({ blockers: 0, warnings: 0 });
    });

    it("skips a student whose class has no rule to take a requirement from", () => {
      const report = runYearClosePreflight(
        closeInput({
          // Class 6 is the highest class, so a null rule there is legitimate —
          // and a student in it has no bar to be judged against.
          rules: [rule({ classId: CLASS_5.id, nextClassId: CLASS_6.id })],
          students: [
            closeStudent({
              classId: CLASS_6.id,
              className: CLASS_6.name,
              attendanceRate: 10,
            }),
          ],
        })
      );

      expect(codes(report.warnings)).not.toContain("ATTENDANCE_BELOW_REQUIREMENT");
    });

    it("skips a student with no class at all", () => {
      const report = runYearClosePreflight(
        closeInput({
          students: [
            closeStudent({ classId: null, className: null, attendanceRate: 10 }),
          ],
        })
      );

      expect(codes(report.warnings)).not.toContain("ATTENDANCE_BELOW_REQUIREMENT");
    });

    /**
     * The case the check exists for. The promotion engine judges with whatever
     * attendance was on file when it ran; registers keep being marked all year,
     * so a student promoted on a partial year can finish below the bar with a
     * promotion record that says otherwise.
     */
    it("warns about an already-promoted student whose full-year rate fell below the bar", () => {
      const report = runYearClosePreflight(
        closeInput({
          students: [
            closeStudent({ promotionAction: "PROMOTED", attendanceRate: 61.5 }),
          ],
        })
      );

      const warning = report.warnings.find(
        (f) => f.code === "ATTENDANCE_BELOW_REQUIREMENT"
      )!;
      expect(warning.params.actual).toBe(61.5);
      expect(report.canProceed).toBe(true);
    });

    it("honours a class whose requirement is not the 75% default", () => {
      const report = runYearClosePreflight(
        closeInput({
          rules: [rule({ minimumAttendance: 90 })],
          students: [closeStudent({ attendanceRate: 82 })],
        })
      );

      const warning = report.warnings.find(
        (f) => f.code === "ATTENDANCE_BELOW_REQUIREMENT"
      )!;
      expect(warning.params.required).toBe(90);
      expect(warning.params.actual).toBe(82);
    });
  });

  it("blocks a roll number shared across sections of the same year", () => {
    const report = runYearClosePreflight(
      closeInput({
        students: [
          closeStudent({ studentProfileId: "stu-1", studentName: "Ali", rollNumber: "3" }),
          closeStudent({
            studentProfileId: "stu-2",
            studentId: "S002",
            studentName: "Sara",
            rollNumber: "3",
          }),
        ],
      })
    );

    expect(codes(report.blockers)).toContain("DUPLICATE_ROLL_NUMBER");
    expect(report.blockers.find((f) => f.code === "DUPLICATE_ROLL_NUMBER")?.params.className).toBe(
      `${FROM_YEAR.label} cohort`
    );
  });
});

describe("summarisePreflight", () => {
  const blocker = (code: PreflightCode, name: string): PreflightFinding => ({
    code,
    severity: PREFLIGHT_SEVERITY[code],
    subject: { kind: "student", id: name, label: name },
    params: {},
    message: name,
  });

  it("decides on blockers alone", () => {
    const report = summarisePreflight([blocker("STUDENT_WITHOUT_RESULTS", "a")]);
    expect(report.canProceed).toBe(true);
    expect(report.counts).toEqual({ blockers: 0, warnings: 1 });
  });

  it("counts every finding even when the list is truncated", () => {
    const findings = Array.from({ length: 120 }, (_, i) =>
      blocker("UNPROMOTED_STUDENT", `student-${i}`)
    );

    const report = summarisePreflight(findings);

    expect(report.counts.blockers).toBe(120);
    expect(report.countsByCode.UNPROMOTED_STUDENT).toBe(120);
    expect(report.blockers).toHaveLength(MAX_FINDINGS_PER_CODE);
    expect(report.truncatedCodes).toEqual(["UNPROMOTED_STUDENT"]);
  });

  it("truncates per code, so one noisy check cannot hide another", () => {
    const findings = [
      ...Array.from({ length: 60 }, (_, i) => blocker("UNPROMOTED_STUDENT", `a-${i}`)),
      blocker("MISSING_ROLL_NUMBER", "b"),
    ];

    const report = summarisePreflight(findings, { perCodeLimit: 5 });

    expect(report.blockers.filter((f) => f.code === "UNPROMOTED_STUDENT")).toHaveLength(5);
    expect(report.blockers.filter((f) => f.code === "MISSING_ROLL_NUMBER")).toHaveLength(1);
    expect(report.truncatedCodes).toEqual(["UNPROMOTED_STUDENT"]);
  });

  it("reports nothing truncated when everything fits", () => {
    const report = summarisePreflight([blocker("EMPTY_COHORT", "a")]);
    expect(report.truncatedCodes).toEqual([]);
  });
});
