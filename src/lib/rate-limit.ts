/**
 * Simple In-Memory Rate Limiter using a Map.
 * Note: This works correctly in a single-instance Node.js setting.
 * For scaled serverless environments (Vercel edge/lambdas), consider Upstash Redis or Vercel KV.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitMap = new Map<string, RateLimitEntry>();

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
