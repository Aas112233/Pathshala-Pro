import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number,
  currency: string = "BDT",
  locale: string = "en-BD"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(
  date: Date | string,
  locale: string = "en-BD"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(
  date: Date | string,
  locale: string = "en-BD"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Format student name with optional second-language (Bengali) name.
 * Output: "Abdul Karim - আব্দুল করিম" or just "Abdul Karim" if no Bn name exists.
 */
export function formatStudentName(
  firstName: string,
  lastName: string,
  firstNameBn?: string | null,
  lastNameBn?: string | null
): string {
  const enName = `${firstName} ${lastName}`.trim();
  const bnName = [firstNameBn, lastNameBn].filter(Boolean).join(" ").trim();
  return bnName ? `${enName} - ${bnName}` : enName;
}

/**
 * Fuzzy match test and score calculation.
 * Returns a score >= 0 if matching (higher score = better match), or -1 if no match.
 * Handles:
 * 1. Exact match / exact substring (Highest score)
 * 2. Prefix matching (High score)
 * 3. Token-based out-of-order matching (e.g. "Karim Abdul" matches "Abdul Karim")
 * 4. Subsequence matching (e.g. "akr" matches "Abdul Karim")
 * 5. Typo tolerance (Levenshtein distance <= 1 for short words, <= 2 for words >= 6 chars)
 */
export function fuzzyMatch(pattern: string, text: string): { matches: boolean; score: number } {
  if (!pattern || !pattern.trim()) return { matches: true, score: 100 };
  if (!text) return { matches: false, score: -1 };

  const p = pattern.trim().toLowerCase();
  const t = text.toLowerCase();

  // 1. Exact match
  if (t === p) return { matches: true, score: 1000 };

  // 2. Starts with query
  if (t.startsWith(p)) return { matches: true, score: 800 - p.length };

  // 3. Substring match
  const substrIdx = t.indexOf(p);
  if (substrIdx !== -1) {
    return { matches: true, score: 600 - substrIdx };
  }

  // 4. Multi-token matching (all tokens must match in any order)
  const pTokens = p.split(/\s+/).filter(Boolean);
  const tTokens = t.split(/[\s,•\-_/()]+/).filter(Boolean);

  if (pTokens.length > 1) {
    let allTokensMatched = true;
    const tokenScore = 400;

    for (const pt of pTokens) {
      const matchFound = tTokens.some((tt) => {
        if (tt.startsWith(pt)) return true;
        if (tt.includes(pt)) return true;
        // Minor typo tolerance on individual alpha tokens (1 edit distance), but digits must match exactly
        const isNumeric = /^\d+$/.test(pt);
        if (!isNumeric && pt.length >= 3 && Math.abs(pt.length - tt.length) <= 1) {
          return levenshteinDistance(pt, tt) <= 1;
        }
        return false;
      });

      if (!matchFound) {
        allTokensMatched = false;
        break;
      }
    }

    if (allTokensMatched) {
      return { matches: true, score: tokenScore };
    }
    // If multi-token search did not match all tokens, do not do loose subsequence on whole text
    return { matches: false, score: -1 };
  }

  // 5. Subsequence matching for single token / initials (e.g. "akr" for "Abdul Karim")
  let pIdx = 0;
  let tIdx = 0;
  let consecutiveMatches = 0;
  let subseqScore = 200;

  while (pIdx < p.length && tIdx < t.length) {
    if (p[pIdx] === t[tIdx]) {
      pIdx++;
      consecutiveMatches++;
      subseqScore += consecutiveMatches * 5;
    } else {
      consecutiveMatches = 0;
    }
    tIdx++;
  }

  if (pIdx === p.length) {
    return { matches: true, score: subseqScore };
  }

  // 6. Typo tolerance on whole string or individual target tokens
  // Allow 1 typo for queries 3-5 chars, 2 typos for queries >= 6 chars
  const maxDistance = p.length >= 6 ? 2 : p.length >= 3 ? 1 : 0;
  if (maxDistance > 0) {
    // Check against individual tokens first (common for names like "Tareeq" vs "Tariq")
    for (const tt of tTokens) {
      if (Math.abs(p.length - tt.length) <= maxDistance) {
        const dist = levenshteinDistance(p, tt);
        if (dist <= maxDistance) {
          return { matches: true, score: 100 - dist * 20 };
        }
      }
    }
  }

  return { matches: false, score: -1 };
}

/**
 * Filter and rank items using fuzzy matching.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string
): T[] {
  if (!query || !query.trim()) return items;

  const scored: Array<{ item: T; score: number }> = [];

  for (const item of items) {
    const text = getText(item);
    const result = fuzzyMatch(query, text);
    if (result.matches) {
      scored.push({ item, score: result.score });
    }
  }

  // Sort descending by match score
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

/**
 * Standard Levenshtein Distance implementation (Wagner–Fischer)
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val: number;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }

  return row[b.length];
}
