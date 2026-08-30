import { jwtVerify, SignJWT } from "jose";

const DEV_FALLBACK_JWT_SECRET = "development_only_jwt_secret_change_me";
const MIN_JWT_SECRET_LENGTH = 32;

let hasWarnedAboutJwtSecret = false;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    if (process.env.NODE_ENV === "production" && secret.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET must contain at least ${MIN_JWT_SECRET_LENGTH} characters in production`);
    }
    if (process.env.NODE_ENV === "production" && secret === DEV_FALLBACK_JWT_SECRET) {
      throw new Error("The development JWT secret cannot be used in production");
    }
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }

  if (!hasWarnedAboutJwtSecret) {
    hasWarnedAboutJwtSecret = true;
    console.warn("JWT_SECRET is not set. Falling back to a development-only secret.");
  }

  return DEV_FALLBACK_JWT_SECRET;
}

export function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

export async function signFileAccessToken(key: string, tenantId: string): Promise<string> {
  return new SignJWT({ purpose: "file", key, tenantId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecretKey());
}

export async function verifyFileAccessToken(token: string, tenantId: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (payload.purpose !== "file" || payload.tenantId !== tenantId || typeof payload.key !== "string") {
      return null;
    }
    return payload.key;
  } catch {
    return null;
  }
}

/**
 * Sign a short-lived JWT for platform operations such as tenant impersonation.
 */
export async function signJwtToken(
  payload: Record<string, unknown>,
  expiresIn = "2h"
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecretKey());
}
