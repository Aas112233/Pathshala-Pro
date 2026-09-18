import { describe, it, expect } from "vitest";
import { isTransientDbError, withDbRetry } from "./prisma";

describe("DB retry helper", () => {
  it("classifies transient connection codes and ignores the rest", () => {
    expect(isTransientDbError({ code: "P1001" })).toBe(true);
    expect(isTransientDbError({ code: "P2024" })).toBe(true);
    expect(isTransientDbError({ name: "PrismaClientInitializationError" })).toBe(true);
    expect(isTransientDbError({ code: "P2002" })).toBe(false);
    expect(isTransientDbError(new Error("boom"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });

  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const result = await withDbRetry(
      () => {
        calls++;
        if (calls < 3) throw { code: "P1001", message: "unreachable" };
        return Promise.resolve("ok");
      },
      { baseDelayMs: 1 }
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("rethrows non-transient errors without retrying", async () => {
    let calls = 0;
    await expect(
      withDbRetry(
        () => {
          calls++;
          throw { code: "P2002", message: "duplicate" };
        },
        { baseDelayMs: 1 }
      )
    ).rejects.toMatchObject({ code: "P2002" });
    expect(calls).toBe(1);
  });

  it("gives up after maxAttempts on persistent transient failures", async () => {
    let calls = 0;
    await expect(
      withDbRetry(
        () => {
          calls++;
          throw { code: "P2024", message: "pool timeout" };
        },
        { maxAttempts: 2, baseDelayMs: 1 }
      )
    ).rejects.toMatchObject({ code: "P2024" });
    expect(calls).toBe(2);
  });
});
