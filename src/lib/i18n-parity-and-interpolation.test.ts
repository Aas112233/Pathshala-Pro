// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Advanced Level i18n Parity, Formatting, & Dead-Key Guard Suite.
 * Catches any missing translation key, interpolation variable mismatch,
 * or broken t("...") call before runtime across all 4 supported locales:
 * 🇬🇧 en (English)
 * 🇵🇰 ur (Urdu - RTL)
 * 🇮🇳 hi (Hindi)
 * 🇧🇩 bn (Bengali)
 */

function loadLocale(lang: string): Record<string, any> {
  const filePath = path.join(process.cwd(), `src/messages/${lang}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function extractAllKeys(obj: Record<string, any>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(extractAllKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function extractVariables(str: string): string[] {
  const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g);
  return matches ? matches.map((m) => m.replace(/[{}]/g, "")).sort() : [];
}

function getNestedValue(obj: Record<string, any>, keyPath: string): any {
  const parts = keyPath.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[p];
  }
  return cur;
}

describe("Advanced i18n & Translation Parity Test Suite", () => {
  const en = loadLocale("en");
  const ur = loadLocale("ur");
  const hi = loadLocale("hi");
  const bn = loadLocale("bn");

  const locales = [
    { code: "ur", data: ur, name: "Urdu" },
    { code: "hi", data: hi, name: "Hindi" },
    { code: "bn", data: bn, name: "Bengali" },
  ];

  const enKeys = extractAllKeys(en);

  it("en.json has valid keys and structure", () => {
    expect(enKeys.length).toBeGreaterThan(500);
  });

  for (const locale of locales) {
    it(`guarantees 100% key parity for ${locale.name} (${locale.code}) against en.json`, () => {
      const missingKeys: string[] = [];

      for (const key of enKeys) {
        const val = getNestedValue(locale.data, key);
        if (val === undefined || val === null) {
          missingKeys.push(key);
        }
      }

      if (missingKeys.length > 0) {
        throw new Error(
          `Locale [${locale.code}] is missing ${missingKeys.length} keys:\n` +
            missingKeys.slice(0, 20).join("\n") +
            (missingKeys.length > 20 ? `\n... and ${missingKeys.length - 20} more` : "")
        );
      }

      expect(missingKeys).toEqual([]);
    });

    it(`guarantees interpolation variable parity for ${locale.name} (${locale.code})`, () => {
      const varMismatches: Array<{ key: string; enVars: string[]; targetVars: string[] }> = [];

      for (const key of enKeys) {
        const enVal = getNestedValue(en, key);
        const targetVal = getNestedValue(locale.data, key);

        if (typeof enVal === "string" && typeof targetVal === "string") {
          const enVars = extractVariables(enVal);
          const targetVars = extractVariables(targetVal);

          if (enVars.join(",") !== targetVars.join(",")) {
            varMismatches.push({ key, enVars, targetVars });
          }
        }
      }

      if (varMismatches.length > 0) {
        throw new Error(
          `Locale [${locale.code}] has ${varMismatches.length} interpolation variable mismatches:\n` +
            varMismatches.map((m) => `${m.key} -> en:[${m.enVars}] vs ${locale.code}:[${m.targetVars}]`).join("\n")
        );
      }

      expect(varMismatches).toEqual([]);
    });
  }

  it("common namespace contains mandatory UI fallback keys across all 4 locales", () => {
    const requiredCommonKeys = [
      "required",
      "pleaseFillRequired",
      "validationFailed",
      "save",
      "cancel",
      "delete",
      "edit",
      "create",
    ];

    const allLocales = [en, ur, hi, bn];
    for (const loc of allLocales) {
      for (const reqKey of requiredCommonKeys) {
        expect(loc.common?.[reqKey]).toBeDefined();
        expect(typeof loc.common[reqKey]).toBe("string");
        expect(loc.common[reqKey].length).toBeGreaterThan(0);
      }
    }
  });

  it("paymentMethods settings namespace is 100% complete across all 4 locales", () => {
    const allLocales = [en, ur, hi, bn];
    for (const loc of allLocales) {
      expect(loc.settings?.paymentMethods?.title).toBeDefined();
      expect(loc.settings?.paymentMethods?.description).toBeDefined();
      expect(loc.settings?.paymentMethods?.modal?.titleAdd).toBeDefined();
      expect(loc.settings?.paymentMethods?.modal?.nameLabel).toBeDefined();
      expect(loc.settings?.paymentMethods?.modal?.codeLabel).toBeDefined();
    }
  });
});

/**
 * Layout-shell key guard.
 *
 * The sidebar, the document-title updater and the notification tabs all
 * translate with the ROOT translator (`useTranslations()` — no namespace), so
 * every key they reference must exist as a top-level message path.
 *
 * Without this guard a missing key is invisible until runtime, where next-intl
 * renders the raw key path into the UI and logs MISSING_MESSAGE. That is exactly
 * what shipped with the Cash Deposits nav entry: `titleKey: "nav.deposits"` was
 * added to SIDEBAR_NAV before the key existed in the locale files.
 */
describe("Layout shell message-key guard (root translator)", () => {
  const shellLocales = [
    { code: "en", data: loadLocale("en") },
    { code: "ur", data: loadLocale("ur") },
    { code: "hi", data: loadLocale("hi") },
    { code: "bn", data: loadLocale("bn") },
  ];

  /** Components that resolve messages with the namespace-less translator. */
  const ROOT_TRANSLATOR_FILES = [
    "src/components/layout/sidebar.tsx",
    "src/components/layout/page-title-updater.tsx",
    "src/components/layout/header-notification-center.tsx",
  ];

  function collectLiteralKeys(): Map<string, string[]> {
    const found = new Map<string, string[]>();

    for (const rel of ROOT_TRANSLATOR_FILES) {
      const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");

      source.split(/\r?\n/).forEach((line, index) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // skip comments

        const callRe = /\bt\(\s*["']([A-Za-z][\w.]*)["']/g;
        let match: RegExpExecArray | null;
        while ((match = callRe.exec(line)) !== null) {
          const key = match[1];
          const hits = found.get(key) ?? [];
          hits.push(`${rel}:${index + 1}`);
          found.set(key, hits);
        }
      });
    }

    return found;
  }

  it('every t("...") literal in the layout shell resolves in all 4 locales', () => {
    const literalKeys = collectLiteralKeys();
    expect(literalKeys.size).toBeGreaterThan(0);

    const problems: string[] = [];
    for (const [key, where] of literalKeys) {
      for (const locale of shellLocales) {
        if (getNestedValue(locale.data, key) === undefined) {
          problems.push(`[${locale.code}] missing "${key}"  <- ${where.join(", ")}`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("every SIDEBAR_NAV labelKey/titleKey resolves in all 4 locales", async () => {
    const { SIDEBAR_NAV } = await import("@/lib/constants");

    const problems: string[] = [];
    for (const group of SIDEBAR_NAV) {
      const keys = [group.labelKey, ...group.items.map((item) => item.titleKey)];
      for (const key of keys) {
        for (const locale of shellLocales) {
          if (getNestedValue(locale.data, key) === undefined) {
            problems.push(`[${locale.code}] missing "${key}"`);
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });
});

/**
 * Repository-wide key guard.
 *
 * Scans every non-test source file for `t("literal")` calls and `titleKey` /
 * `labelKey` literals, resolving each against the namespaces that file actually
 * declares via `useTranslations(...)`.
 *
 * This is the safety net that makes removing the (unreachable)
 * `t("key") || "fallback"` pattern safe: without it, a key that exists in no
 * locale would silently render as a raw key path at runtime.
 */
describe("Repository-wide message-key guard", () => {
  const guardLocales = [
    { code: "en", data: loadLocale("en") },
    { code: "ur", data: loadLocale("ur") },
    { code: "hi", data: loadLocale("hi") },
    { code: "bn", data: loadLocale("bn") },
  ];

  function collectSourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        collectSourceFiles(full, out);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  /** Namespaces declared in a file ("" = root translator). */
  function declaredNamespaces(source: string): Set<string> {
    const namespaces = new Set<string>();
    const re = /(?:useTranslations|getTranslations)\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source)) !== null) {
      namespaces.add(match[1] ?? match[2] ?? "");
    }
    return namespaces;
  }

  /** Variables bound to a translator in this file, e.g. `const t = useTranslations(...)`. */
  function translatorBindings(source: string): string[] {
    const names: string[] = [];
    const re = /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source)) !== null) names.push(match[1]);
    return names;
  }

  /** A key is satisfied if it resolves under ANY namespace declared in the file. */
  function resolves(key: string, namespaces: Set<string>): boolean {
    const candidates = [...namespaces].map((ns) => (ns ? `${ns}.${key}` : key));
    return candidates.some((candidate) =>
      guardLocales.every((locale) => getNestedValue(locale.data, candidate) !== undefined)
    );
  }

  it("every literal key referenced from src/ resolves in all 4 locales", () => {
    const files = collectSourceFiles(path.join(process.cwd(), "src"));
    expect(files.length).toBeGreaterThan(100);

    const problems: string[] = [];
    let checkedKeys = 0;

    for (const file of files) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
      const source = fs.readFileSync(file, "utf8");

      const bindings = translatorBindings(source);
      if (bindings.length === 0) continue;

      const namespaces = declaredNamespaces(source);
      if (namespaces.size === 0) namespaces.add("");

      const keys = new Map<string, number>();

      // t("key") / tCommon("key") / t2("key") ...
      const callRe = new RegExp(
        `\\b(?:${bindings.join("|")})\\(\\s*["']([A-Za-z][\\w.]*)["']`,
        "g"
      );
      let match: RegExpExecArray | null;
      while ((match = callRe.exec(source)) !== null) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        if (!keys.has(match[1])) keys.set(match[1], line);
      }

      // titleKey: "..." / labelKey: "..." props
      const propRe = /\b(?:titleKey|labelKey)\s*:\s*"([A-Za-z][\w.]*)"/g;
      while ((match = propRe.exec(source)) !== null) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        if (!keys.has(match[1])) keys.set(match[1], line);
      }

      for (const [key, line] of keys) {
        checkedKeys++;
        if (!resolves(key, namespaces)) {
          const nsList = [...namespaces].map((ns) => (ns ? `"${ns}"` : "root")).join(", ");
          problems.push(`${rel}:${line}  "${key}"  (namespaces: ${nsList})`);
        }
      }
    }

    // Guard against the scanner silently degrading into a no-op.
    expect(checkedKeys).toBeGreaterThan(300);
    expect(problems).toEqual([]);
  });
});
