export default function LoginPage() {
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
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="admin@school.edu"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
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
              type="password"
              placeholder="Enter your password"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <button className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
