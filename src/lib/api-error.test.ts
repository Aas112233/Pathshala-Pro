import { describe, it, expect } from "vitest";
import { z, ZodError } from "zod";
import { NextRequest } from "next/server";
import { ApiError, handleApiError } from "./api-error";
import { safeParseBody } from "./api-response";

describe("API Error Handler & Failsafe Mapping", () => {
  it("translates ApiError instances into correct status code and JSON response", async () => {
    const notFoundError = ApiError.notFound("Student record not found");
    const res404 = handleApiError(notFoundError);
    expect(res404.status).toBe(404);
    const body404 = await res404.json();
    expect(body404.error).toBe(true);
    expect(body404.message).toBe("Student record not found");

    const conflictError = ApiError.conflict("User already exists", [
      { field: "email", code: "duplicate", message: "Email is registered" },
    ]);
    const res409 = handleApiError(conflictError);
    expect(res409.status).toBe(409);
    const body409 = await res409.json();
    expect(body409.details[0].field).toBe("email");
  });

  it("translates Zod validation errors into 422 Unprocessable Entity with details", async () => {
    const testSchema = z.object({
      email: z.string().email("Invalid email format"),
      age: z.number().min(18, "Must be at least 18"),
    });

    const parseResult = testSchema.safeParse({
      email: "invalid-email",
      age: 15,
    });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const res422 = handleApiError(parseResult.error);
      expect(res422.status).toBe(422);
      const json = await res422.json();
      expect(json.error).toBe(true);
      expect(json.message).toContain("email: Invalid email format");
      expect(json.message).toContain("age: Must be at least 18");
      expect(json.details.length).toBe(2);
      expect(json.details[0].field).toBe("email");
      expect(json.details[1].field).toBe("age");
    }
  });

  it("translates SyntaxError (malformed JSON) into 400 Bad Request", async () => {
    let syntaxError: SyntaxError;
    try {
      JSON.parse("{ invalid json");
      throw new Error("Should not reach here");
    } catch (e) {
      syntaxError = e as SyntaxError;
    }

    const res400 = handleApiError(syntaxError);
    expect(res400.status).toBe(400);
    const json = await res400.json();
    expect(json.error).toBe(true);
    expect(json.message).toBe("Malformed JSON in request body");
  });

  it("translates Prisma P2002 unique constraint violations into 409 Conflict", async () => {
    const mockPrismaUniqueError = {
      code: "P2002",
      meta: { target: ["rollNumber", "tenantId"] },
      message: "Unique constraint failed",
    };

    const res409 = handleApiError(mockPrismaUniqueError);
    expect(res409.status).toBe(409);
    const json = await res409.json();
    expect(json.error).toBe(true);
    expect(json.message).toContain("rollNumber, tenantId");
    expect(json.details[0].code).toBe("UNIQUE_CONSTRAINT");
  });

  it("translates Prisma P2025 record not found into 404 Not Found", async () => {
    const mockPrismaNotFoundError = {
      code: "P2025",
      meta: { cause: "Record to update not found." },
      message: "Record not found",
    };

    const res404 = handleApiError(mockPrismaNotFoundError);
    expect(res404.status).toBe(404);
    const json = await res404.json();
    expect(json.error).toBe(true);
    expect(json.message).toBe("Record to update not found.");
  });

  it("translates Prisma P2003 foreign key constraint into 400 Bad Request", async () => {
    const mockPrismaFkError = {
      code: "P2003",
      meta: { field_name: "classId" },
      message: "Foreign key constraint failed",
    };

    const res400 = handleApiError(mockPrismaFkError);
    expect(res400.status).toBe(400);
    const json = await res400.json();
    expect(json.error).toBe(true);
    expect(json.details[0].field).toBe("classId");
  });

  it("safely falls back to 500 without leaking raw internal stack", async () => {
    const unexpectedError = new Error("Database network socket hangup");
    const res500 = handleApiError(unexpectedError, "Failed to execute database operation");
    expect(res500.status).toBe(500);
    const json = await res500.json();
    expect(json.error).toBe(true);
    expect(json.message).toBe("Failed to execute database operation");
  });
});

describe("safeParseBody Request Payload Validator", () => {
  const schema = z.object({
    name: z.string().min(2),
    amount: z.number().positive(),
  });

  it("successfully parses valid JSON matching the schema", async () => {
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      body: JSON.stringify({ name: "Tuition Fee", amount: 1500 }),
    });

    const result = await safeParseBody(req, schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Tuition Fee");
      expect(result.data.amount).toBe(1500);
    }
  });

  it("returns 422 errorResponse when payload fails schema validation", async () => {
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      body: JSON.stringify({ name: "A", amount: -10 }),
    });

    const result = await safeParseBody(req, schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorResponse.status).toBe(422);
      const json = await result.errorResponse.json();
      expect(json.error).toBe(true);
      expect(json.details.length).toBe(2);
    }
  });
});
