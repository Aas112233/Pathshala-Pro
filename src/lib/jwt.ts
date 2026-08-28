import { SignJWT } from "jose";

const DEV_FALLBACK_JWT_SECRET = "development_only_jwt_secret_change_me";

let hasWarnedAboutJwtSecret = false;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (secret) {
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
