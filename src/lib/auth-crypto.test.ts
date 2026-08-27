// @vitest-environment node
import { describe, it, expect } from "vitest";
import { jwtVerify } from "jose";
import { hashPassword, verifyPassword, generateAuthToken } from "@/lib/auth";
import { getJwtSecretKey } from "@/lib/jwt";

describe("Authentication Cryptography & JWT Tokens", () => {
  describe("Password Hashing & Verification", () => {
    it("hashes plaintext passwords securely using bcrypt", async () => {
      const password = "StrongPassword123!";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2")).toBe(true); // bcrypt prefix
    });

    it("verifies matching password against generated hash", async () => {
      const password = "ValidPassword2026";
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("rejects incorrect password against generated hash", async () => {
      const password = "ValidPassword2026";
      const hash = await hashPassword(password);

      const isInvalid = await verifyPassword("WrongPassword!", hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe("JWT Token Generation & Verification", () => {
    it("generates and signs valid JWT tokens with userId, tenantId, and role", async () => {
      const userId = "usr-alpha-123";
      const tenantId = "tenant-school-456";
      const role = "ADMIN";

      const token = await generateAuthToken(userId, tenantId, role);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const { payload } = await jwtVerify(token, getJwtSecretKey());
      expect(payload.userId).toBe(userId);
      expect(payload.tenantId).toBe(tenantId);
      expect(payload.role).toBe(role);
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
    });
  });
});
