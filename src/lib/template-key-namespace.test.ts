import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import en from "@/messages/en.json";

/**
 * The general template-key guard.
 *
 * `next-intl` does not throw on a missing message — it reports through `onError`
 * and returns the raw key path as the string, exit zero. A repository-wide
 * scanner that looks for literal `t("...")` keys cannot see a key built from a
 * template literal, because the key does not exist until runtime. That blind
 * spot is how `promotions.preflight.codes` went missing in all four locales
 * while the year-close gate rendered a blank remedy line for every blocker: the
 * one class of key the scanner could not check was the one class that was
 * missing.
 *
 * `rollover-i18n.test.ts` and `preflight-i18n.test.ts` guard the two known
 * instances by keying off the module's own runtime lists. This test guards the
 * *class*: it walks every non-test source file, finds every `` t(`…${…}`) ``
 * call site, resolves the static part of the key against the namespace the
 * calling variable was bound to, and asserts that container exists in `en`.
 *
 * It deliberately does not attempt to prove the individual keys exist — the
 * vocabulary tests do that, and only they can, because they know the runtime
 * list a code comes from. What it proves is that a namespace cannot be missing
 * entirely while nothing complains.
 */

const SRC_ROOT = path.join(process.cwd(), "src");

/** Files whose keys this test cannot resolve are listed here, with a reason. */
const KNOWN_UNRESOLVABLE: { file: string; reason: string }[] = [
  {
    file: "src/components/calendar/calendar-event-sheet.tsx",
    reason:
      "the first key segment is built from a value (`recurrence${...}`, `audience${...}`), so no static prefix exists. The segment set is fixed by the form's own option list.",
  },
  {
    file: "src/components/system-admin/tenant-module-access-panel.tsx",
    reason:
      "the key is `<moduleKey>.title`, one namespace per platform module, so the first segment is data. The module list is owned by the platform-module registry.",
  },
  {
    file: "src/components/portal/portal-view.tsx",
    reason:
      "the weekday column header is `weekdays.<lowercased day>`, keyed off the shared top-level `weekdays` namespace whose members are exactly the seven days.",
  },
];

function listFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Variable name -> namespace, for every `const x = useTranslations("ns")` in a
 * file.
 *
 * Attribution is by variable rather than by file because a file routinely holds
 * two translators — the rollover panel reads `rollover` and `weekdays`, and the
 * question bank reads the root translator *and* `common`. Attributing per file
 * would call the second one unresolvable and hide the first one's gap.
 *
 * `useTranslations()` with no argument is the root namespace, stored as "".
 */
function namespaceByVariable(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const pattern =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useTranslations\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    map.set(match[1], match[2] ?? match[3] ?? "");
  }
  return map;
}

interface Site {
  /** Project-relative file path. */
  file: string;
  /** The raw template contents, e.g. `codes.${finding.code}`. */
  template: string;
  /** The static prefix before the first interpolation, e.g. `codes.`. */
  prefix: string;
  /** The namespace the calling variable was bound to. "" is the root. */
  namespace: string;
}

function has(container: unknown, dotted: string): boolean {
  if (!dotted) return false;
  let node: unknown = container;
  for (const part of dotted.split(".")) {
    if (node === null || typeof node !== "object") return false;
    node = (node as Record<string, unknown>)[part];
    if (node === undefined) return false;
  }
  // A container must be an object with at least one entry. A string here would
  // mean the prefix resolved to a message rather than a namespace, which is a
  // different (and usually wrong) shape.
  return typeof node === "object" && node !== null && Object.keys(node).length > 0;
}

describe("every template-literal translation key has a namespace", () => {
  const files = listFiles(SRC_ROOT);
  const sites: Site[] = [];
  const unresolved: { file: string; template: string; reason: string }[] = [];

  for (const file of files) {
    const relative = path.relative(process.cwd(), file).split(path.sep).join("/");
    const source = fs.readFileSync(file, "utf8");
    const byVariable = namespaceByVariable(source);

    const callPattern = /\b([A-Za-z_$][\w$]*)\(\s*`([^`]*)`/g;
    for (const match of source.matchAll(callPattern)) {
      const callee = match[1];
      const template = match[2];
      // Not a template-literal key, or not a translator variable at all.
      if (!template.includes("${")) continue;
      if (!byVariable.has(callee)) continue;

      // The static part of the key: everything up to the last dot before the
      // first interpolation. `codes.${finding.code}` -> `codes.`
      const head = template.slice(0, template.indexOf("${"));
      const lastDot = head.lastIndexOf(".");
      const prefix = lastDot === -1 ? "" : head.slice(0, lastDot);

      if (prefix) {
        sites.push({
          file: relative,
          template,
          prefix,
          namespace: byVariable.get(callee) ?? "",
        });
      } else {
        unresolved.push({
          file: relative,
          template,
          reason: "the template has no static prefix to resolve",
        });
      }
    }
  }

  it("found template-key call sites to check in the first place", () => {
    // Guarding a scan that matched nothing would be a guard that silently
    // stopped working when a regex changed.
    expect(sites.length).toBeGreaterThan(0);
  });

  it("resolves each static prefix to a container that exists in en", () => {
    const missing = sites.filter((site) => {
      const dotted = site.namespace
        ? `${site.namespace}.${site.prefix.replace(/\.$/, "")}`
        : site.prefix.replace(/\.$/, "");
      return !has(en, dotted);
    });

    const described = missing.map(
      (site) =>
        `${site.file}: \`${site.template}\` -> ${site.namespace || "<root>"}.${site.prefix}`
    );
    expect(
      described,
      "A namespace that a template-literal key resolves into does not exist in en. " +
        "next-intl will render the raw key path instead of a message and will not throw, " +
        "so this is invisible to everything except this test. Either author the namespace, " +
        "or, if the key is genuinely not a translation key, add the site to the review list."
    ).toEqual([]);
  });

  it("has no call sites it cannot resolve", () => {
    const unexpected = unresolved.filter(
      (entry) => !KNOWN_UNRESOLVABLE.some((known) => entry.file.includes(known.file))
    );
    expect(
      unexpected.map((entry) => `${entry.file}: \`${entry.template}\` (${entry.reason})`),
      "A template-literal key this guard cannot attribute to a namespace is a gap in the " +
        "guard, not a gap in the translations. Resolve the namespace for that file."
    ).toEqual([]);
  });
});
