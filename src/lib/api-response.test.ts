import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  safeParseBody,
} from "@/lib/api-response";

describe("API Response Utilities & Formatting", () => {
  it("formats successResponse with standard envelope", async () => {
    const data = { id: "123", name: "Alpha School" };
    const res = successResponse(data, "Created successfully", 201);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.error).toBe(false);
    expect(json.data).toEqual(data);
    expect(json.message).toBe("Created successfully");
  });

  it("formats paginatedResponse with pagination metadata", async () => {
    const items = [{ id: 1 }, { id: 2 }];
    const pagination = {
      totalCount: 50,
      currentPage: 1,
      pageSize: 2,
      totalPages: 25,
      hasNextPage: true,
      hasPreviousPage: false,
    };
    const res = paginatedResponse(items, pagination);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual(items);
    expect(json.pagination).toEqual(pagination);
  });

  it("generates correct HTTP status codes for error helpers", async () => {
    const badReq = badRequest("Invalid payload", [{ field: "email", code: "invalid", message: "Bad email" }]);
    expect(badReq.status).toBe(400);
    const badReqJson = await badReq.json();
    expect(badReqJson.error).toBe(true);
    expect(badReqJson.details).toHaveLength(1);

    const unauth = unauthorized();
    expect(unauth.status).toBe(401);

    const forb = forbidden();
    expect(forb.status).toBe(403);

    const notFnd = notFound();
    expect(notFnd.status).toBe(404);

    const conf = conflict();
    expect(conf.status).toBe(409);

    const valErr = validationError([{ field: "code", code: "custom", message: "Required" }]);
    expect(valErr.status).toBe(422);
  });

  describe("safeParseBody", () => {
    const TestSchema = z.object({
      name: z.string().min(2),
      age: z.number().positive(),
    });

    it("successfully parses valid request body matching schema", async () => {
      const req = new NextRequest("http://localhost/api/test", {
        method: "POST",
        body: JSON.stringify({ name: "Rahim", age: 14 }),
        headers: { "Content-Type": "application/json" },
      });

      const result = await safeParseBody(req, TestSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: "Rahim", age: 14 });
      }
    });

    it("catches schema validation failures and returns formatted 400 error response", async () => {
      const req = new NextRequest("http://localhost/api/test", {
        method: "POST",
        body: JSON.stringify({ name: "R", age: -5 }),
        headers: { "Content-Type": "application/json" },
      });

      const result = await safeParseBody(req, TestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorResponse.status).toBe(422);
      }
    });

    it("catches malformed JSON syntax errors gracefully", async () => {
      const req = new NextRequest("http://localhost/api/test", {
        method: "POST",
        body: "invalid-json-string{",
        headers: { "Content-Type": "application/json" },
      });

      const result = await safeParseBody(req, TestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorResponse.status).toBe(400);
      }
    });
  });
});
