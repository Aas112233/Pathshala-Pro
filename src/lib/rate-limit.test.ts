import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  rateLimit,
  smartRateLimit,
  recordRateLimitFailure,
  recordRateLimitSuccess,
  dedupeRequest,
} from "@/lib/rate-limit";

describe("Rate Limiter Engine", () => {
  const testIp = "192.168.1.100";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00Z"));
    // Stabilize the random cleanup sweep so tests are deterministic.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows initial requests within limit threshold", () => {
    const res1 = rateLimit(testIp, 3, 60000);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = rateLimit(testIp, 3, 60000);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = rateLimit(testIp, 3, 60000);
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it("blocks requests that exceed the limit", () => {
    const ip2 = "10.0.0.50";
    rateLimit(ip2, 2, 60000); // 1
    rateLimit(ip2, 2, 60000); // 2

    const blocked = rateLimit(ip2, 2, 60000); // 3 (exceeded)
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets limits when window expiration time passes", () => {
    const ip3 = "172.16.0.1";
    rateLimit(ip3, 2, 60000);
    rateLimit(ip3, 2, 60000);

    const blockedBefore = rateLimit(ip3, 2, 60000);
    expect(blockedBefore.success).toBe(false);

    // Fast-forward time past windowMs (60s)
    vi.advanceTimersByTime(65000);

    const allowedAfter = rateLimit(ip3, 2, 60000);
    expect(allowedAfter.success).toBe(true);
    expect(allowedAfter.remaining).toBe(1);
  });
});

describe("Smart Adaptive Rate Limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies the auth preset limit (5 per 15 min)", () => {
    const key = "LOGIN_1.1.1.1_user@test.com";
    const r1 = smartRateLimit(key, { preset: "auth" });
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(4);
    expect(r1.penaltyActive).toBe(false);
  });

  it("blocks beyond the preset limit and reports retryAfterSeconds", () => {
    const key = "LOGIN_1.1.1.2_brute@test.com";
    for (let i = 0; i < 5; i++) {
      expect(smartRateLimit(key, { preset: "auth" }).success).toBe(true);
    }
    const blocked = smartRateLimit(key, { preset: "auth" });
    expect(blocked.success).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tightens the effective limit as failures accumulate (adaptive backoff)", () => {
    const key = "LOGIN_2.2.2.2_victim@test.com";
    // auth preset base limit = 5.
    // 1 failure → multiplier 2 → effective limit 2.
    recordRateLimitFailure(key);
    expect(smartRateLimit(key, { preset: "auth" }).success).toBe(true); // 1/2
    expect(smartRateLimit(key, { preset: "auth" }).success).toBe(true); // 2/2
    expect(smartRateLimit(key, { preset: "auth" }).success).toBe(false); // 3 > 2

    // 2nd failure while locked out → multiplier 4, lockout extended further.
    recordRateLimitFailure(key);
    expect(smartRateLimit(key, { preset: "auth" }).success).toBe(false);

    // After the extended lockout expires, the fresh window allows only
    // floor(5 / 4) = 1 attempt (penalty carried over).
    vi.advanceTimersByTime(16 * 60 * 1000);
    const fresh = smartRateLimit(key, { preset: "auth" });
    expect(fresh.success).toBe(true);
    expect(fresh.penaltyActive).toBe(true);
    expect(fresh.remaining).toBe(0);
    expect(smartRateLimit(key, { preset: "auth" }).success).toBe(false);
  });

  it("clears penalties after a recorded success", () => {
    const key = "LOGIN_3.3.3.3_recovered@test.com";
    recordRateLimitFailure(key);
    recordRateLimitFailure(key);
    recordRateLimitSuccess(key);

    const r = smartRateLimit(key, { preset: "auth" });
    expect(r.success).toBe(true);
    expect(r.penaltyActive).toBe(false);
    expect(r.remaining).toBe(4); // back to full auth preset limit
  });
});

describe("Duplicate Request Guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows the first request and blocks an immediate duplicate", () => {
    const key = "CREATE_STUDENT_t1_s42";
    expect(dedupeRequest(key, 5000)).toBe(true);
    expect(dedupeRequest(key, 5000)).toBe(false);
  });

  it("allows the same key again after the guard window passes", () => {
    const key = "CREATE_FEE_VOUCHER_t1_v99";
    expect(dedupeRequest(key, 5000)).toBe(true);
    vi.advanceTimersByTime(6000);
    expect(dedupeRequest(key, 5000)).toBe(true);
  });

  it("treats different keys as independent requests", () => {
    expect(dedupeRequest("OP_A", 5000)).toBe(true);
    expect(dedupeRequest("OP_B", 5000)).toBe(true);
  });
});
