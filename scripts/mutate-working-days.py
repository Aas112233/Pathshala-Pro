"""Mutations for the working-days arithmetic and the endpoint that declares it.

Two targets, because the endpoint is a thin rendering of the module and the
interesting failures live on both sides of that line.

See `mutation_harness.py` for the harness. This file used to carry its own copy
of it; the copy silently rewrote the line endings of every file it touched while
reporting a byte-identical restore, which is one reason there is now only one
harness.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mutation_harness import main  # noqa: E402

MODULE_MUTATIONS = [
    (
        "W1  the weekend is hardcoded to Sunday again",
        "    if (nonWorkingSet.has(weekday)) {",
        "    if (weekday === 0) {",
    ),
    (
        "W2  a holiday is tested before the weekly day off, so it is excluded twice",
        """    if (nonWorkingSet.has(weekday)) {
      weekendDays++;
      continue;
    }
    if (holidayDates.has(day)) {
      holidayWorkingDays++;
      continue;
    }""",
        """    if (holidayDates.has(day)) {
      holidayWorkingDays++;
      continue;
    }
    if (nonWorkingSet.has(weekday)) {
      weekendDays++;
      continue;
    }""",
    ),
    (
        "W3  a holiday range is not clamped to the requested range",
        """    for (let day = Math.max(from, start); day <= Math.min(to, end); day++) {
      holidayDates.add(day);
    }""",
        """    for (let day = from; day <= to; day++) {
      holidayDates.add(day);
    }""",
    ),
]

API_MUTATIONS = [
    (
        "A1  PUT no longer checks the year is open",
        "    await assertAcademicYearOpen(tenantId, id);",
        "    void assertAcademicYearOpen;",
    ),
    (
        "A2  an undeclared year reports a zeroed calendar instead of null",
        "      calendar: null,",
        """      calendar: {
        students: { totalCalendarDays: 0, weekendDays: 0, holidayWorkingDays: 0, holidayCalendarDays: 0, workingDays: 0 },
        staff: { totalCalendarDays: 0, weekendDays: 0, holidayWorkingDays: 0, holidayCalendarDays: 0, workingDays: 0 },
      },""",
    ),
    (
        "A3  a corrupt stored policy is repaired with a default weekend",
        """    policy = readWorkingDayPolicy(year.nonWorkingWeekdays);
  } catch (error) {""",
        """    policy = readWorkingDayPolicy(year.nonWorkingWeekdays);
  } catch (error) {
    policy = { nonWorkingWeekdays: [0] as Weekday[] };
  }
  if (1 === 2) {""",
    ),
    (
        "A4  the weekend is hardcoded to Sunday in the route",
        "    nonWorkingWeekdays: params.nonWorkingWeekdays,",
        "    nonWorkingWeekdays: [0] as Weekday[],",
    ),
]


if __name__ == "__main__":
    status = main(
        label="working-days module",
        target="src/lib/working-days.ts",
        test="src/lib/working-days.test.ts",
        mutations=MODULE_MUTATIONS,
    )
    status |= main(
        label="working-days endpoint",
        target="src/app/api/academic-years/[id]/working-days/route.ts",
        test="src/lib/academic-year-working-days-api.test.ts",
        mutations=API_MUTATIONS,
    )
    sys.exit(status)
