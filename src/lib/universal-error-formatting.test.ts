import { describe, it, expect } from "vitest";
import { formatErrorDetail } from "./api-fetch";
import { handleApiError, ApiError } from "./api-error";
import { validationError } from "./api-response";
import { z, ZodError } from "zod";

describe("Universal Error Formatting & Contract Guard Suite", () => {
  it("formats single field error detail with field, code, and message", () => {
    const detail = {
      field: "name",
      code: "too_small",
      message: "Hostel name is required",
    };

    const formatted = formatErrorDetail(detail);
    expect(formatted).toBe("[Field 'name', Code: too_small] Hostel name is required");
  });

  it("formats field without code cleanly", () => {
    const detail = {
      field: "amount",
      message: "Amount must be positive",
    };

    const formatted = formatErrorDetail(detail);
    expect(formatted).toBe("[Field 'amount'] Amount must be positive");
  });

  it("formats general code error without field cleanly", () => {
    const detail = {
      code: "ACCOUNT_NOT_FOUND",
      message: "Chart of Account 1010 not configured",
    };

    const formatted = formatErrorDetail(detail);
    expect(formatted).toBe("[Code: ACCOUNT_NOT_FOUND] Chart of Account 1010 not configured");
  });

  it("handleApiError captures Zod errors with field, code, and message in summary", async () => {
    const testSchema = z.object({
      name: z.string().min(2, "Hostel name is required"),
      capacity: z.number().min(1, "Capacity must be at least 1"),
    });

    const parsed = testSchema.safeParse({ name: "A", capacity: 0 });
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const response = handleApiError(parsed.error);
      expect(response.status).toBe(422);

      const json = await response.json();
      expect(json.error).toBe(true);
      expect(json.message).toContain("name: Hostel name is required (too_small)");
      expect(json.message).toContain("capacity: Capacity must be at least 1 (too_small)");
      expect(json.details.length).toBe(2);
      expect(json.details[0].code).toBe("too_small");
    }
  });

  it("validationError helper formats error response with status 422 and structured details", async () => {
    const res = validationError([
      { field: "rollNumber", code: "custom", message: "Roll number already assigned" },
    ]);

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.message).toContain("rollNumber: Roll number already assigned (custom)");
    expect(json.details[0].field).toBe("rollNumber");
    expect(json.details[0].code).toBe("custom");
  });
});
