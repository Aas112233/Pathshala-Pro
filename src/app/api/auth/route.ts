// Keep the legacy /api/auth endpoint behavior identical to the hardened login route.
// Registration is intentionally handled by /api/users and requires tenant admin access.
export { POST } from "./login/route";
