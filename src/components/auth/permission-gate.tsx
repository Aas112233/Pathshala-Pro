"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, PermissionAction } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PermissionGateProps {
  module: string;
  action?: PermissionAction;
  children: React.ReactNode;
}

export function NotAuthorizedScreen() {
  const t = useTranslations("common");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
      <div className="rounded-full bg-destructive/10 p-6 mb-6">
        <ShieldAlert className="h-16 w-16 text-destructive" strokeWidth={1.5} />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
        Access Denied
      </h1>
      <p className="text-muted-foreground max-w-md mb-8">
        You don&apos;t have the necessary permissions to view this page or perform this action. 
        Please contact your system administrator if you believe you should have access.
      </p>
      <Link href="/">
        <Button variant="default" size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}

export function PermissionGate({
  module,
  action = "read",
  children,
}: PermissionGateProps) {
  const { user, isLoading } = useAuth();

  // If auth is still loading, just render nothing (or a loader)
  if (isLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading permissions...</div>;
  }

  // Not logged in or no permission object
  if (!user) {
    return <NotAuthorizedScreen />;
  }

  // Super Admin bypass
  if (user.role === "SUPER_ADMIN") {
    return <>{children}</>;
  }

  const isAllowed = hasPermission(user.permissions, module, action);

  if (!isAllowed) {
    // If it's a page gate (action = read), return full screen. 
    // If it's just meant for a button, it wouldn't be used like this (typically we just conditionally render the button).
    return <NotAuthorizedScreen />;
  }

  return <>{children}</>;
}
