import { SystemAdminShell } from "@/components/layout/system-admin-shell";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

export const dynamic = "force-dynamic";

export default async function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const auth = await getAuthContext(new NextRequest("http://localhost/", {
    headers: { cookie: cookieStore.toString() },
  }));

  if (!auth) {
    redirect("/login?returnUrl=/system-admin&expired=1");
  }

  const isAuthorized =
    auth.user.role === "SYSTEM_ADMIN" ||
    isPlatformOwnerEmail(auth.user.email) ||
    auth.isImpersonated;

  if (!isAuthorized) {
    redirect("/");
  }

  return <SystemAdminShell>{children}</SystemAdminShell>;
}
