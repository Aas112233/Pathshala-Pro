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
        // Indirect require: Node's `fs` must stay out of the bundler's static
        // module graph. This module is compiled for the browser too (the PDF
        // templates render client-side), where a bare `require("fs")` makes
        // Turbopack/webpack emit "Can't resolve 'fs'". The indirection is
        // invisible to both bundlers and only executes in Node (SSR / jsdom
        // tests); browsers take the `/fonts/` URL branch above.
        const nodeRequire = eval("require") as (id: string) => typeof import("fs");
        const fs = nodeRequire("fs");
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

  // Italic variants are aliased to the upright files on purpose: react-pdf
  // throws "Could not resolve font" for any weight/style combo without an
  // exact registration, and we ship no true italic TTFs. Aliasing keeps
  // italic-styled nodes rendering (upright) instead of failing the export.
  const upright = (regular: string, bold: string, subPath: string) => [
    { src: getFontSrc(regular, subPath), fontWeight: 400 as const },
    { src: getFontSrc(bold, subPath), fontWeight: 700 as const },
    { src: getFontSrc(regular, subPath), fontWeight: 400 as const, fontStyle: "italic" as const },
    { src: getFontSrc(bold, subPath), fontWeight: 700 as const, fontStyle: "italic" as const },
  ];

  try {
    // 1. Universal English / Latin / Numbers
    Font.register({
      family: "NotoSans",
      fonts: upright("NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSans"),
    });

    // 2. Bengali / Bangla (বাংলা) & Taka Symbol (৳)
    Font.register({
      family: "NotoSansBengali",
      fonts: upright("NotoSansBengali-Regular.ttf", "NotoSansBengali-Bold.ttf", "NotoSansBengali"),
    });

    // 3. Hindi / Devanagari (हिन्दी) & Rupee Symbol (₹)
    Font.register({
      family: "NotoSansDevanagari",
      fonts: upright("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari-Bold.ttf", "NotoSansDevanagari"),
    });

    // 4. Urdu / Arabic (اردو)
    Font.register({
      family: "NotoSansArabic",
      fonts: upright("NotoSansArabic-Regular.ttf", "NotoSansArabic-Bold.ttf", "NotoSansArabic"),
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
