/**
 * Safe translation helpers.
 *
 * next-intl does NOT throw when a message is missing: it reports
 * `MISSING_MESSAGE` through `onError` and returns the **key path** itself
 * (e.g. `"nav.deposits"`). That makes both of these patterns dead code:
 *
 *   t("nav.deposits") || "Cash Deposits"   // key is truthy -> fallback never runs
 *   try { t("nav.deposits") } catch { ... } // never throws
 *
 * The result is that a missing key leaks its raw key path into the UI
 * (nav labels, document title, toast messages) instead of the intended fallback.
 *
 * `t.has(key)` is the only reliable existence check, so every "optional"
 * lookup in the layout shell goes through `safeTranslate`.
 *
 * NOTE: these helpers make a missing key degrade gracefully — they do not make
 * it acceptable. `src/lib/i18n-parity-and-interpolation.test.ts` fails the build
 * when a key referenced from the layout shell is absent from any locale.
 */

export type Translator = ((key: string) => string) & {
  has: (key: string) => boolean;
};

/** Translate `key`, returning `fallback` when the message is absent. */
export function safeTranslate(t: Translator, key: string, fallback: string): string {
  try {
    return t.has(key) ? t(key) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Humanize a message key for graceful degradation, so a missing translation
 * renders as readable text instead of a raw key path.
 *
 * "nav.bulkFeeCollection" -> "Bulk Fee Collection"
 * "views.month"           -> "Month"
 */
export function humanizeKey(key: string): string {
  const leaf = key.split(".").pop() ?? key;
  const words = leaf
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!words) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
