import type { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "auth_token";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24;

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "strict",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
}

export const authCookieName = AUTH_COOKIE_NAME;
