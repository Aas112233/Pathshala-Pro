# Global Super Admin (System Admin) Implementation Plan

Since Pathshala Pro is a **Multi-Tenant System** (where each school is a [Tenant](file:///d:/my%20project/PathshalaProSchoolManagementSystemERP/Pathshala-Pro/src/lib/schemas/index.ts#200-201)), the normal `SUPER_ADMIN` role we've been working with manages *one specific school*. 

To have "powerful full control over the tenants", you need a **Global Super Admin (System Admin)** panel that sits completely outside of the individual school data and manages the platform as a whole (SaaS Management).

Here is the architectural plan to implement this smoothly:

## 1. Routing & Architecture Structure

We will create an entirely separate route group for the Global Super Admin to cleanly separate it from the school-specific dashboard.

```text
src/app/
  ├── (auth)/login           # Shared login
  ├── (dashboard)/           # Tenant-specific app (admissions, attendance, etc.)
  └── (system-admin)/        # THE GLOBAL ADMIN PANEL
      ├── layout.tsx         # A distinct, dark-themed System Admin layout
      ├── page.tsx           # Global Analytics & SaaS Metrics
      ├── tenants/           # Manage Schools (CRUD, Suspension, Upgrades)
      └── billing/           # Track SaaS subscriptions & revenue
```

## 2. Database Adjustments (Prisma)

Currently, the [User](file:///d:/my%20project/PathshalaProSchoolManagementSystemERP/Pathshala-Pro/src/components/providers/auth-provider.tsx#7-16) model requires a `tenantId`. A true System Admin might not belong to any specific school. 

**Option A: Virtual "SYSTEM" Tenant (Recommended & Easiest)**
We create a hardcoded [Tenant](file:///d:/my%20project/PathshalaProSchoolManagementSystemERP/Pathshala-Pro/src/lib/schemas/index.ts#200-201) with `tenantId: "SYSTEM"`. 
- Global Admins are [User](file:///d:/my%20project/PathshalaProSchoolManagementSystemERP/Pathshala-Pro/src/components/providers/auth-provider.tsx#7-16) records attached to the `"SYSTEM"` tenant.
- Their `role` will be explicitly `"SYSTEM_ADMIN"`.

**Option B: Separate Table (Most Secure, More Work)**
Create a separate `PlatformAdmin` table entirely disconnected from [Tenant](file:///d:/my%20project/PathshalaProSchoolManagementSystemERP/Pathshala-Pro/src/lib/schemas/index.ts#200-201) and [User](file:///d:/my%20project/PathshalaProSchoolManagementSystemERP/Pathshala-Pro/src/components/providers/auth-provider.tsx#7-16).

**We will proceed with Option A** as it lets us reuse our authentication systems.

```prisma
// Example Prisma Extension Needed (if any)
model Tenant {
  // Existing fields...
  subscriptionStatus String   @default("TRIAL") // "TRIAL", "ACTIVE", "SUSPENDED"
  planType           String   @default("BASIC") // "BASIC", "PRO", "ENTERPRISE"
  billingCycle       String   @default("YEARLY")
  maxStudents        Int      @default(500)
}
```

## 3. Security & Middleware Authorization

We will intercept traffic in our Middleware ([src/middleware.ts](file:///d:/my%20project/PathshalaProSchoolManagementSystemERP/Pathshala-Pro/src/middleware.ts)) and Auth checks.

1. **Login Hook:** When `role === "SYSTEM_ADMIN"` logs in, automatically redirect them to `/system-admin` instead of the standard `/` dashboard.
2. **Strict Route Protection:** Any route under `/system-admin` must verify `user.role === "SYSTEM_ADMIN"`. The `SUPER_ADMIN` (school owner) will be blocked from accessing this.
3. **Data Fetching:** System Admin APIs will dynamically omit the `where: { tenantId }` filters that are currently hardcoded in our standard APIs. They will perform universal `.findMany()` queries.

## 4. Core Features of the Global Panel

### A. Tenants (Schools) Management UI
- **List All Tenants:** A data-table showing all registered schools, their contact info, and current active status.
- **Actions:** 
  - **Suspend/Activate:** Instantly lock a school out of the system if subscription fails.
  - **Impersonate:** "Login as School Owner" to provide direct customer support (bypasses password).
  - **Create New Tenant:** Onboard a new school, assign their `tenantId`, and automatically generate their `SUPER_ADMIN` user credentials.

### B. SaaS Analytics & Metrics
- Total Schools Registered.
- Total Active Students across the entire platform.
- Total SaaS Revenue/Subscriptions.
- Server Resource Usage / Database Size Monitoring.

### C. Subscription & Billing Control
- Upgrade a school from "Free Tier" to "Premium".
- Increase `maxStudents` quotas for specific tenants.
- View payment histories from schools paying you for the software.

## 5. UI / UX Design Approach

To visually separate the **System Admin Panel** from the **School Panel**:
- The System Admin sidebar will have a distinct UI (e.g., a dark/inverted color scheme, or a different accent color like Purple/Indigo).
- It will heavily utilize charts (Recharts) to visualize platform growth.
- It will have "Danger Zones" for destructive actions (like dropping a Tenant and wiping all their data).

---

### Do you want me to start implementing this?
If you approve this plan, my immediate next steps will be:
1. Creating the [(system-admin)](file:///d:/my%20project/PathshalaProSchoolManagementSystemERP/Pathshala-Pro/src/lib/api-client.ts#194-196) route folder structure and unique Layout.
2. Building the **Tenants Table** to list all schools in your database.
3. Adapting `/api/auth/login` to redirect `SYSTEM_ADMIN` roles properly.
