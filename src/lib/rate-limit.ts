/**
 * In-Memory Rate Limiting Suite.
 *
 * 1. `rateLimit()`          — Legacy fixed-window limiter (kept for backward compatibility).
 * 2. `smartRateLimit()`     — Dynamic, adaptive limiter with named presets and
 *                             progressive penalties that tighten on repeated failures.
 * 3. `recordRateLimitFailure()` / `recordRateLimitSuccess()` — Feed outcomes back
 *                             into the limiter so it can adapt (smart backoff).
 * 4. `dedupeRequest()`      — Short-window duplicate-entry guard (blocks accidental
 *                             double-submits of the same payload/key).
 *
 * Note: Works correctly in a single-instance Node.js setting.
 * For scaled serverless environments (Vercel edge/lambdas), consider Upstash Redis or Vercel KV.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
  /** Number of consecutive failures recorded (drives adaptive penalties). */
  failures?: number;
  /** Multiplier applied to the base limit/window while penalized. */
  penaltyMultiplier?: number;
};

const rateLimitMap = new Map<string, RateLimitEntry>();

/** Tracks the last time a given request key was seen — used for duplicate prevention. */
const dedupeMap = new Map<string, number>();

// ── Legacy fixed-window limiter (unchanged public contract) ────────────────

// Default configuration: 5 attempts per 15 minutes
export function rateLimit(
  ip: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // Clean up stale entries occasionally (very lightweight sweep)
  if (Math.random() < 0.05) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt < now) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!record || record.resetAt < now) {
    // First time or window expired
    rateLimitMap.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }

  // Increment existing counter
  const newCount = record.count + 1;
  record.count = newCount;

  if (newCount > limit) {
    return { success: false, remaining: 0, reset: record.resetAt };
  }

  return { success: true, remaining: limit - newCount, reset: record.resetAt };
}

// ── Smart, dynamic, adaptive rate limiting ─────────────────────────────────

export type RateLimitPreset = "auth" | "mutation" | "read" | "public";

/**
 * Named presets tuned per endpoint class. "Smart" because the effective limit
 * automatically tightens as failures accumulate (brute-force backoff) and
 * relaxes back to normal after sustained success.
 */
export const RATE_LIMIT_PRESETS: Record<
  RateLimitPreset,
  { limit: number; windowMs: number; description: string }
> = {
  /** Credential endpoints — strict: 5 attempts / 15 min, aggressive backoff. */
  auth: { limit: 5, windowMs: 15 * 60 * 1000, description: "Login / OTP / password reset" },
  /** Write operations — moderate burst allowance per minute. */
  mutation: { limit: 30, windowMs: 60 * 1000, description: "Create / update / delete" },
  /** Read-heavy list endpoints — generous per minute. */
  read: { limit: 120, windowMs: 60 * 1000, description: "GET list / detail endpoints" },
  /** Unauthenticated public endpoints — conservative. */
  public: { limit: 30, windowMs: 60 * 1000, description: "Public / unauthenticated endpoints" },
};

export interface SmartRateLimitOptions {
  /** Endpoint class — picks a sensible default limit/window. Default: "mutation". */
  preset?: RateLimitPreset;
  /** Override the preset limit. */
  limit?: number;
  /** Override the preset window (ms). */
  windowMs?: number;
  /** Cap for the adaptive penalty multiplier (default 8x tightening). */
  maxPenaltyMultiplier?: number;
}

export interface SmartRateLimitResult {
  success: boolean;
  remaining: number;
  /** Epoch ms when the current window/penalty resets. */
  reset: number;
  /** Convenience: seconds to wait before retrying (for Retry-After headers). */
  retryAfterSeconds: number;
  /** True when an adaptive penalty (backoff) is currently active. */
  penaltyActive: boolean;
}

function sweepStaleEntries(now: number) {
  if (Math.random() >= 0.05) return;
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetAt < now) rateLimitMap.delete(key);
  }
  for (const [key, seenAt] of dedupeMap.entries()) {
    if (now - seenAt > 10 * 60 * 1000) dedupeMap.delete(key);
  }
}

/**
 * Adaptive rate limiter.
 *
 * - Starts from a preset (or explicit limit/window).
 * - Each recorded failure tightens the effective limit and extends the window
 *   (exponential backoff, capped by `maxPenaltyMultiplier`).
 * - A recorded success clears penalties (trusted client again).
 */
export function smartRateLimit(
  key: string,
  options: {
    preset?: RateLimitPreset;
    limit?: number;
    windowMs?: number;
    maxPenaltyMultiplier?: number;
  } = {}
): SmartRateLimitResult {
  const preset = RATE_LIMIT_PRESETS[options.preset ?? "mutation"];
  const baseLimit = options.limit ?? preset.limit;
  const windowMs = options.windowMs ?? preset.windowMs;
  const maxPenalty = options.maxPenaltyMultiplier ?? 8;

  const now = Date.now();
  sweepStaleEntries(now);

  const record = rateLimitMap.get(key);

  if (!record || record.resetAt < now) {
    // Fresh window — but if the client was previously penalized, keep tightening.
    const carriedMultiplier = record?.penaltyMultiplier ?? 1;
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs * carriedMultiplier,
      failures: record?.failures ?? 0,
      penaltyMultiplier: carriedMultiplier,
    });
    const effectiveLimit = Math.max(1, Math.floor(baseLimit / carriedMultiplier));
    return {
      success: true,
      remaining: effectiveLimit - 1,
      reset: now + windowMs * carriedMultiplier,
      retryAfterSeconds: 0,
      penaltyActive: carriedMultiplier > 1,
    };
  }

  const multiplier = Math.min(record.penaltyMultiplier ?? 1, maxPenalty);
  const effectiveLimit = Math.max(1, Math.floor(baseLimit / multiplier));

  const newCount = record.count + 1;
  record.count = newCount;

  if (newCount > effectiveLimit) {
    return {
      success: false,
      remaining: 0,
      reset: record.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
      penaltyActive: multiplier > 1,
    };
  }

  return {
    success: true,
    remaining: effectiveLimit - newCount,
    reset: record.resetAt,
    retryAfterSeconds: 0,
    penaltyActive: multiplier > 1,
  };
}

/**
 * Record a failed attempt (e.g. wrong password) for a key.
 * Tightens the effective limit and progressively extends the lockout window:
 *   failures=1 → 2x tighter, 2 → 4x, 3+ → capped (default 8x).
 */
export function recordRateLimitFailure(key: string, maxPenaltyMultiplier: number = 8): void {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  const failures = (record?.failures ?? 0) + 1;
  const multiplier = Math.min(Math.pow(2, failures), maxPenaltyMultiplier);

  if (!record || record.resetAt < now) {
    rateLimitMap.set(key, {
      count: 0,
      resetAt: now,
      failures,
      penaltyMultiplier: multiplier,
    });
    return;
  }

  record.failures = failures;
  record.penaltyMultiplier = multiplier;
  // Progressive lockout extension: each failure level extends the lockout
  // (2x → 30s, 4x → 60s, 8x → 120s), capped at 15 minutes.
  record.resetAt = Math.max(record.resetAt, now + Math.min(multiplier * 15 * 1000, 15 * 60 * 1000));
}

/**
 * Record a successful attempt for a key — clears penalties so limits relax
 * back to the preset baseline.
 */
export function recordRateLimitSuccess(key: string): void {
  const record = rateLimitMap.get(key);
  if (record) {
    record.failures = 0;
    record.penaltyMultiplier = 1;
  }
}

// ── Duplicate submission prevention (server-side) ──────────────────────────

/**
 * Blocks accidental duplicate submissions of the same logical request.
 * Call with a stable key (e.g. route + entity identifiers or payload hash).
 * If the same key was seen within `windowMs`, returns `false` (duplicate).
 *
 * Example:
 *   if (!dedupeRequest(`CREATE_STUDENT_${tenantId}_${body.studentId}`, 5000)) {
 *     return errorResponse("Duplicate request detected. Please wait a moment.", 409);
 *   }
 */
export function dedupeRequest(key: string, windowMs: number = 5000): boolean {
  const now = Date.now();
  sweepStaleEntries(now);

  const seenAt = dedupeMap.get(key);
  if (seenAt !== undefined && now - seenAt < windowMs) {
    return false; // duplicate within the guard window
  }
  dedupeMap.set(key, now);
  return true;
}