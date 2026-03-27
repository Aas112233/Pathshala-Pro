import { clearAuthCookie } from "@/lib/auth-cookies";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST() {
  try {
    const response = successResponse({ success: true }, "Logout successful");
    clearAuthCookie(response);
    return response;
  } catch (error) {
    return errorResponse("Internal server error", 500);
  }
}
