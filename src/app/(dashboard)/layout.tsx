import { AppShell } from "@/components/layout/app-shell";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { getSubscriptionEnforcementState } from "@/lib/subscription-service";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const auth = await getAuthContext(new NextRequest("http://localhost/", {
    headers: { cookie: cookieStore.toString() },
  }));
  if (!auth) redirect("/login?expired=1");
  if (auth.user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(auth.user.email) && !auth.isImpersonated) {
    const state = await getSubscriptionEnforcementState(auth.tenantId);
    if (state.blocked) redirect("/subscription/inactive");
  }
  return <AppShell>{children}</AppShell>;
}
