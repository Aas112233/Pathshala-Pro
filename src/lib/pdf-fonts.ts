import { Font } from "@react-pdf/renderer";
import path from "path";

let fontsRegistered = false;

export function registerPdfFonts() {
  if (fontsRegistered) return;

  const fontDir = typeof process !== "undefined" && process.cwd
    ? path.join(process.cwd(), "public", "fonts")
    : "/fonts";

  // CDN fallbacks
  const cdnBase = "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf";

  // Helper to determine font source. Real browsers use the same-origin /fonts/
  // bundle shipped in public/fonts (no extra DNS/TLS, no CDN outage can turn
  // Bangla into tofu). Node, SSR and jsdom test envs (all expose
  // process.versions.node) use the repo file when present, else the CDN.
  const isNode =
    typeof process !== "undefined" &&
    !!(process as any).versions?.node;
  const getFontSrc = (fileName: string, subPath: string) => {
    if (!isNode && typeof window !== "undefined") {
      return `/fonts/${fileName}`;
    }
    if (typeof process !== "undefined" && typeof process.cwd === "function") {
      try {
        const fs = require("fs");
        const localPath = path.join(fontDir, fileName);
        if (fs.existsSync(localPath)) {
          return localPath;
        }
      } catch {
        // Fallback to CDN if fs fails
      }
    }
    return `${cdnBase}/${subPath}/${fileName}`;
  };

  try {
    // 1. Universal English / Latin / Numbers
    Font.register({
      family: "NotoSans",
      fonts: [
        { src: getFontSrc("NotoSans-Regular.ttf", "NotoSans"), fontWeight: 400 },
        { src: getFontSrc("NotoSans-Bold.ttf", "NotoSans"), fontWeight: 700 },
      ],
    });

    // 2. Bengali / Bangla (বাংলা) & Taka Symbol (৳)
    Font.register({
      family: "NotoSansBengali",
      fonts: [
        { src: getFontSrc("NotoSansBengali-Regular.ttf", "NotoSansBengali"), fontWeight: 400 },
        { src: getFontSrc("NotoSansBengali-Bold.ttf", "NotoSansBengali"), fontWeight: 700 },
      ],
    });

    // 3. Hindi / Devanagari (हिन्दी) & Rupee Symbol (₹)
    Font.register({
      family: "NotoSansDevanagari",
      fonts: [
        { src: getFontSrc("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari"), fontWeight: 400 },
        { src: getFontSrc("NotoSansDevanagari-Bold.ttf", "NotoSansDevanagari"), fontWeight: 700 },
      ],
    });

    // 4. Urdu / Arabic (اردو)
    Font.register({
      family: "NotoSansArabic",
      fonts: [
        { src: getFontSrc("NotoSansArabic-Regular.ttf", "NotoSansArabic"), fontWeight: 400 },
        { src: getFontSrc("NotoSansArabic-Bold.ttf", "NotoSansArabic"), fontWeight: 700 },
      ],
    });

    // Disable hyphenation for non-Latin complex scripts
    Font.registerHyphenationCallback((word) => [word]);

    fontsRegistered = true;
  } catch (error) {
    console.error("[PDF Font Registration] Failed to register custom fonts:", error);
  }
}

// Auto-register upon import
registerPdfFonts();

/**
 * Script coverage table, in resolution priority order.
 *
 * Each Noto Sans script font also carries basic Latin, so choosing the
 * complex-script family renders a mixed "Rahim / \u09B0\u09B9\u09BF\u09AE" document correctly,
 * whereas choosing NotoSans drops every non-Latin glyph (tofu). Where two
 * scripts genuinely co-occur, the earlier entry wins \u2014 react-pdf resolves one
 * family per node and does not fall back per glyph.
 */
const PDF_SCRIPTS = [
  { family: "NotoSansBengali", content: /[\u0980-\u09FF]/, locale: /^bn(-|$)/ },
  // U+20B9 RUPEE SIGN lives outside the Devanagari block but salary/fee
  // templates pass bare currency symbols -- without it a bare rupee picks NotoSans.
  { family: "NotoSansDevanagari", content: /[\u0900-\u097F\u20B9]/, locale: /^hi(-|$)/ },
  { family: "NotoSansArabic", content: /[\u0600-\u06FF\u0750-\u077F]/, locale: /^ur(-|$)/ },
] as const;

/**
 * Resolve the font family for a document from every text sample it will render.
 *
 * Pass the locale AND the actual payload (student names, school name, currency
 * symbol, row values) as separate arguments \u2014 never a `locale || name` chain.
 * The chain was the bug: with `locale="en"` it short-circuited to NotoSans and
 * printed Bengali student names as blank boxes, and with no locale it inspected
 * only the school name. Content is authoritative here and the locale tag is
 * merely the fallback hint for an otherwise all-Latin document.
 */
export function getPdfFontFamily(...samples: Array<string | null | undefined>): string {
  const texts = samples.filter((value): value is string => typeof value === "string" && value.length > 0);
  if (texts.length === 0) return "NotoSans";

  for (const script of PDF_SCRIPTS) {
    if (texts.some((text) => script.content.test(text))) return script.family;
  }
  for (const script of PDF_SCRIPTS) {
    if (texts.some((text) => script.locale.test(text.toLowerCase()))) return script.family;
  }

  return "NotoSans";
}

/**
 * Flatten tabular rows into a single sample string for {@link getPdfFontFamily}.
 *
 * Capped because a 5,000-row daybook only needs enough of a sample to detect
 * the script, and regex-scanning the whole table on every render is wasteful.
 */
export function pdfTextSample(
  rows: ReadonlyArray<object> | null | undefined,
  maxRows = 200,
): string {
  if (!rows || rows.length === 0) return "";
  const parts: string[] = [];
  for (const row of rows.slice(0, maxRows)) {
    if (!row) continue;
    for (const value of Object.values(row)) {
      if (typeof value === "string" && value) parts.push(value);
    }
  }
  return parts.join(" ");
}
