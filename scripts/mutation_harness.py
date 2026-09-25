"""A mutation-testing harness for this project's TypeScript modules.

Breaks production code on purpose, runs one test file, and reports which tests
notice. A mutation nothing catches is a hole in the suite; a mutation everything
catches is a suite that is not discriminating.

## Why this is one shared implementation

The harness has lied twice already, in two different ways, and both times a
*caught* mutation and a *survivor* were indistinguishable:

  1. `subprocess.run([...], shell=True)` on Windows — a list with `shell=True`
     does not run the command, so every mutation looked caught.
  2. Reading the first `N passed` in vitest's output — that is the
     `Test Files  1 passed (1)` line, not `Tests  43 passed (43)`, so a failing
     run parsed as "0 passed, 0 failed".

Two copies of a harness is two places for that to happen again. There is one
copy, and it asserts a green baseline before it believes anything.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
PROJECT_ROOT = Path(__file__).resolve().parent.parent


class HarnessError(RuntimeError):
    """The harness could not do its job. Never confused with a test result."""


def _run_test_file(test: str) -> tuple[int, int, list[str]]:
    """Returns (passed, failed, failing test names).

    `failed` is -1 when no test summary could be read at all, which is reported
    rather than silently treated as zero failures.
    """
    result = subprocess.run(
        f"npx vitest run {test} 2>&1",
        shell=True,
        cwd=str(PROJECT_ROOT),
        capture_output=True,
    )
    out = ANSI.sub("", result.stdout.decode("utf-8", errors="replace"))

    failing = re.findall(r"^\s*[×x]\s+(.+?)(?:\s+\d+ms)?$", out, re.MULTILINE)

    # The "Tests" line specifically. See the module docstring.
    summary = next(
        (line for line in out.splitlines() if line.strip().startswith("Tests ")), ""
    )
    if not summary:
        print("  --- no `Tests` summary line; raw tail follows ---")
        for line in out.splitlines()[-25:]:
            print(f"  | {line}")
        return 0, -1, failing

    passed = re.search(r"(\d+) passed", summary)
    failed = re.search(r"(\d+) failed", summary)
    return (
        int(passed.group(1)) if passed else 0,
        int(failed.group(1)) if failed else 0,
        failing,
    )


def _read(path: Path) -> bytes:
    """Read the file as bytes.

    Bytes, not text, and this is not fussiness. Python's text mode translates
    newlines on both read and write: `read_text` turns CRLF into LF and
    `write_text` turns LF back into CRLF on Windows. A harness built on text mode
    therefore *reports* a byte-identical restore while silently rewriting every
    line ending in the file it was testing — which is exactly what happened the
    first time this harness ran, on two files, without a single warning.
    """
    return path.read_bytes()


def _write(path: Path, data: bytes) -> None:
    path.write_bytes(data)


def run_mutations(
    *,
    label: str,
    target: str,
    test: str,
    mutations: list[tuple[str, str, str]],
) -> int:
    """Apply each mutation in turn and report what caught it.

    `mutations` is a list of `(label, find, replace)`. `find` must match exactly
    once in the target file, so a stale mutation is reported instead of silently
    doing nothing.
    """
    target_path = PROJECT_ROOT / target
    original = _read(target_path)

    print(f"### {label}")
    print(f"    target: {target}")
    print(f"    test:   {test}\n")

    survivors: list[str] = []

    try:
        print("=== BASELINE (unmutated) ===")
        passed, failed, names = _run_test_file(test)
        if failed != 0 or passed == 0:
            for name in names:
                print(f"    failed: {name}")
            raise HarnessError(
                f"Baseline is not green ({passed} passed, {failed} failed). Every "
                "mutation below would be meaningless, so none was run."
            )
        baseline = passed
        print(f"  {baseline} passed, 0 failed\n")

        for name, find, replace in mutations:
            source = _read(target_path).decode("utf-8")
            occurrences = source.count(find)
            if occurrences != 1:
                print(f"=== {name} ===")
                print(
                    f"  SKIPPED: the anchor matched {occurrences} times, expected exactly 1. "
                    "The mutation is stale.\n"
                )
                survivors.append(f"{name} (stale anchor)")
                continue

            if find == replace:
                raise HarnessError(f"Mutation {name!r} replaces text with itself.")

            _write(target_path, source.replace(find, replace, 1).encode("utf-8"))

            passed, failed, names = _run_test_file(test)
            if failed < 0:
                survivors.append(f"{name} (unreadable result)")
                print(f"=== {name} ===")
                print("  *** UNKNOWN ***: the test run produced no readable summary.\n")
            elif failed > 0:
                print(f"=== {name} ===")
                print(f"  CAUGHT: {passed} passed, {failed} failed (baseline {baseline})")
                for caught in names:
                    print(f"    - {caught}")
                print()
            else:
                survivors.append(name)
                print(f"=== {name} ===")
                print(
                    f"  *** SURVIVED ***: {passed} passed, 0 failed. "
                    "Nothing in the suite depends on this.\n"
                )

            _write(target_path, original)
    finally:
        _write(target_path, original)

    restored = _read(target_path) == original
    print("=== RESTORE ===")
    print(f"  byte-identical to the pre-run file: {restored}")
    if not restored:
        raise HarnessError("The target file was not restored. Fix it before continuing.")

    print(f"\n=== RESULT: {len(mutations) - len(survivors)}/{len(mutations)} caught ===")
    for name in survivors:
        print(f"  survivor: {name}")

    return 1 if survivors else 0


def main(
    *,
    label: str,
    target: str,
    test: str,
    mutations: list[tuple[str, str, str]],
) -> int:
    try:
        return run_mutations(label=label, target=target, test=test, mutations=mutations)
    except HarnessError as error:
        print(f"\nHARNESS FAILURE: {error}")
        return 2


if __name__ == "__main__":
    sys.exit("Import this module from a per-target mutation script.")
