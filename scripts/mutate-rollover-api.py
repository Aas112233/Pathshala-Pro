"""Mutations for the rollover endpoint and its loader/writer.

Two targets: the route decides whether to act, the roster decides what to write.
A suite that only covers one of them would leave the other unguarded.

See `mutation_harness.py` for the harness.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mutation_harness import main  # noqa: E402

ROSTER_MUTATIONS = [
    (
        "R1  the caller is no longer required to state what to carry",
        "    if (typeof copyRaw[key] !== \"boolean\") {",
        "    if (false) {",
    ),
    (
        "R2  an undeclared working-day policy is stored as a JSON null",
        "            ? Prisma.DbNull",
        "            ? Prisma.JsonNull",
    ),
    (
        "R3  the run is no longer recorded",
        """  await tx.academicYearRollover.create({
    data: {""",
        """  if (1 === 2) await tx.academicYearRollover.create({
    data: {""",
    ),
    (
        "R4  the audit entry stops recording what the operator was told",
        "        notCopied: plan.notCopied.map((entry) => entry.key),",
        "        notCopied: [],",
    ),
]

ROUTE_MUTATIONS = [
    (
        "A1  a blocked plan is applied anyway",
        "    if (!plan.canProceed) {",
        "    if (false) {",
    ),
    (
        "A2  the rollover capability is no longer required",
        '    if (!hasRolePermission(user.role, "academic:rollover:execute")) {',
        "    if (false) {",
    ),
    (
        "A3  a dry run writes for real",
        "    if (parsed.dryRun) {",
        "    if (false) {",
    ),
    (
        "A4  a blocked dry run is reported as a failure instead of a result",
        """    if (parsed.dryRun) {
      return successResponse(""",
        """    if (parsed.dryRun) {
      if (!plan.canProceed) {
        return errorResponse("blocked", 409, []);
      }
      return successResponse(""",
    ),
]


if __name__ == "__main__":
    status = main(
        label="rollover loader and writer",
        target="src/lib/rollover-roster.ts",
        test="src/lib/academic-year-rollover-api.test.ts",
        mutations=ROSTER_MUTATIONS,
    )
    status |= main(
        label="rollover endpoint",
        target="src/app/api/academic-years/rollover/route.ts",
        test="src/lib/academic-year-rollover-api.test.ts",
        mutations=ROUTE_MUTATIONS,
    )
    sys.exit(status)
