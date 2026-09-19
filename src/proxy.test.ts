// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { generateAuthToken } from "@/lib/auth";

describe("proxy middleware redirect loop prevention and edge routing", () => {
  it("allows API routes through without redirecting", async () => {
    const request = new NextRequest("http://localhost:3000/api/students");
    const response = await proxy(request);
    expect(response.headers.get("location")).toBeNull();
  });

  describe("public path behavior (anti-loop invariants)", () => {
    it("allows unauthenticated visitor on /login without redirect", async () => {
      const request = new NextRequest("http://localhost:3000/login");
      const response = await proxy(request);
      expect(response.headers.get("location")).toBeNull();
    });

    it("NEVER unconditionally redirects from /login to dashboard even with valid token", async () => {
      const token = await generateAuthToken("user-1", "school-1", "ADMIN");
      const request = new NextRequest("http://localhost:3000/login", {
        headers: { cookie: `auth_token=${token}` },
      });
      const response = await proxy(request);
      // Crucial: Must NOT redirect to / (which was causing ERR_TOO_MANY_REDIRECTS)
      expect(response.headers.get("location")).toBeNull();
    });

    it("clears auth_token cookie when visiting /login?expired=1", async () => {
      const token = await generateAuthToken("user-1", "school-1", "ADMIN");
      const request = new NextRequest("http://localhost:3000/login?expired=1", {
        headers: { cookie: `auth_token=${token}` },
      });
      const response = await proxy(request);
      expect(response.headers.get("location")).toBeNull();
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toBeDefined();
      expect(setCookie).toMatch(/auth_token=;/i);
    });

    it("clears auth_token cookie when visiting /login?logout=1", async () => {
      const token = await generateAuthToken("user-1", "school-1", "ADMIN");
      const request = new NextRequest("http://localhost:3000/login?logout=1", {
        headers: { cookie: `auth_token=${token}` },
      });
      const response = await proxy(request);
      expect(response.headers.get("location")).toBeNull();
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toMatch(/auth_token=;/i);
    });

    it("clears invalid token on /login and allows viewing login page", async () => {
      const request = new NextRequest("http://localhost:3000/login", {
        headers: { cookie: "auth_token=invalid.jwt.token" },
      });
      const response = await proxy(request);
      expect(response.headers.get("location")).toBeNull();
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toMatch(/auth_token=;/i);
    });
  });

  describe("protected routes behavior", () => {
    it("redirects unauthenticated visitor to /login", async () => {
      const request = new NextRequest("http://localhost:3000/academic/groups");
      const response = await proxy(request);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    });

    it("allows authenticated request with valid token", async () => {
      const token = await generateAuthToken("user-1", "school-1", "ADMIN");
      const request = new NextRequest("http://localhost:3000/academic/groups", {
        headers: { cookie: `auth_token=${token}` },
      });
      const response = await proxy(request);
      expect(response.headers.get("location")).toBeNull();
    });

    it("redirects invalid token to /login?expired=1 and deletes cookie", async () => {
      const request = new NextRequest("http://localhost:3000/academic/groups", {
        headers: { cookie: "auth_token=corrupt.jwt.payload" },
      });
      const response = await proxy(request);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login?expired=1");
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toMatch(/auth_token=;/i);
    });

    it("redirects subscription-blocked sessions to /subscription/inactive", async () => {
      const token = await generateAuthToken(
        "user-1",
        "school-1",
        "ADMIN",
        undefined,
        undefined,
        true // subscriptionBlocked
      );
      const request = new NextRequest("http://localhost:3000/fees/collection", {
        headers: { cookie: `auth_token=${token}` },
      });
      const response = await proxy(request);
      expect(response.headers.get("location")).toBe("http://localhost:3000/subscription/inactive");
    });

    it("does not redirect subscription-blocked user on /subscription/inactive", async () => {
      const token = await generateAuthToken(
        "user-1",
        "school-1",
        "ADMIN",
        undefined,
        undefined,
        true // subscriptionBlocked
      );
      const request = new NextRequest("http://localhost:3000/subscription/inactive", {
        headers: { cookie: `auth_token=${token}` },
      });
      const response = await proxy(request);
      expect(response.headers.get("location")).toBeNull();
    });

    it("redirects regular school user away from /system-admin to /", async () => {
      const token = await generateAuthToken("user-1", "school-1", "ADMIN");
      const request = new NextRequest("http://localhost:3000/system-admin", {
        headers: { cookie: `auth_token=${token}` },
      });
      const response = await proxy(request);
      expect(response.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("allows SYSTEM_ADMIN to access /system-admin", async () => {
      const token = await generateAuthToken("user-admin", "platform", "SYSTEM_ADMIN");
      const request = new NextRequest("http://localhost:3000/system-admin", {
        headers: { cookie: `auth_token=${token}` },
      });
      const response = await proxy(request);
      expect(response.headers.get("location")).toBeNull();
    });
  });
});
