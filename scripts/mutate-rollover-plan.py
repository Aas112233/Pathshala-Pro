"""Mutations for src/lib/rollover-plan.ts.

Each one breaks a decision the wizard's correctness rests on. See
`mutation_harness.py` for the harness itself.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mutation_harness import main  # noqa: E402

MUTATIONS = [
    (
        "M1  the year boundary allows a target that starts on the same day",
        "  if (targetStart <= sourceStart) {",
        "  if (targetStart < sourceStart) {",
    ),
    (
        "M2  the match key stops matching, so a re-run duplicates instead of updating",
        "  const targetByClass = new Map(params.target.map((row) => [row.classId, row]));",
        "  const targetByClass = new Map(params.target.map((row) => [row.classId + \"x\", row]));",
    ),
    (
        "M3  the target is assumed to end up with a promotion rule",
        "  const willHaveActiveRule = [...targetRulesAfterRun.values()].some((row) => row.isActive);",
        "  const willHaveActiveRule = [...targetRulesAfterRun.values()].some((row) => row.isActive) || true;",
    ),
    (
        "M4  an unrequested configuration reports rows it will never write",
        """  // Not requested means nothing to do, and reporting rows here would let a UI
  // that renders `created` show writes that will never happen.
  if (!params.requested) return diff;""",
        "  if (false) return diff;",
    ),
    (
        "M5  a year that already existed is claimed to have been cloned",
        """      clonedFromId: target.mode === "CREATE" ? source.id : null,""",
        "      clonedFromId: source.id,",
    ),
    (
        "M6  a differing row is reported as identical, so the update never happens",
        """    if (fields.length === 0) {""",
        "    if (true) {",
    ),
]


if __name__ == "__main__":
    sys.exit(
        main(
            label="rollover plan (roadmap item 16)",
            target="src/lib/rollover-plan.ts",
            test="src/lib/rollover-plan.test.ts",
            mutations=MUTATIONS,
        )
    )
