"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin } from "@/hooks/use-queries";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLogin();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await loginMutation.mutateAsync({ email, password });

      if (!result.error) {
        // Use auth context login - this will persist to localStorage
        login(result.data.token, result.data.user.tenantId, result.data.user);

        toast.success("Login successful!");
        router.push("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8 shadow-lg">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
            Pathshala Pro
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your school management portal
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="admin@demohighschool.edu"
              disabled={isLoading}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Enter your password"
              disabled={isLoading}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Demo Credentials */}
        <div className="rounded-lg bg-muted p-4 text-xs">
          <p className="font-medium text-muted-foreground">Demo Credentials:</p>
          <p className="mt-1 text-foreground">
            <span className="font-mono">admin@demohighschool.edu</span>
          </p>
          <p className="text-foreground">
            <span className="font-mono">password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
