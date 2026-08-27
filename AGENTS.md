# Pathshala-Pro — School Management ERP (Multi-Tenant SaaS)

## Stack

- **Framework:** Next.js 15.4 (App Router) + React 18 + TypeScript
- **Database:** Prisma 6 + Accelerate — schema: `src/prisma/schema.prisma`
- **Auth:** NextAuth v4, JWT sessions (`jose`, `bcryptjs`), guards in `src/middleware.ts` + `src/lib/api-auth.ts`
- **UI:** Tailwind CSS v4, shadcn/ui + Radix (`src/components/ui`), lucide-react icons, sonner toasts
- **Data:** TanStack Query 5 + TanStack Table 8, react-hook-form + Zod (`src/lib/schemas`)
- **i18n:** next-intl — locales `en`, `ur` (RTL), `hi`, `bn` in `src/messages/`
- **Files:** Cloudflare R2 via AWS S3 SDK (`src/lib/r2-storage.ts`)
- **Docs/PDF:** `@react-pdf/renderer` templates in `src/lib/pdf-templates/*.tsx`; Excel via `exceljs`
- **Tests:** Vitest + Testing Library; **Deploy:** Vercel

## Commands

```bash
npm run dev          # dev server (Next.js Turbopack)
npm run build        # production build
npm run lint         # eslint
npm run test:run     # vitest (CI mode)
npm run prisma:push  # sync schema → db
npm run prisma:seed  # seed data
```

## Architecture Rules

1. **Multi-tenancy is sacred.** Every Prisma query MUST be scoped by the current tenant. Tenant context comes from `src/lib/tenant-settings.ts`; role checks from `src/lib/permissions.ts`. Cross-tenant code lives only under `src/app/system-admin/`.
2. **API routes** live at `src/app/api/<entity>/route.ts` (+ `[id]/route.ts`). Every route must verify auth + permissions before touching data (`src/lib/api-auth.ts`, responses via `src/lib/api-response.ts`, errors via `src/lib/api-error.ts`).
3. **Pages** use route group `(dashboard)` with a ViewModel hook per domain: `src/viewmodels/<domain>/use-*-view-model.ts`. Pages stay thin; logic goes in viewmodels.
4. **Validation:** all request bodies parsed with Zod schemas from `src/lib/schemas`.
5. **i18n:** any user-facing string must be added to ALL FOUR locale files (`src/messages/{en,ur,hi,bn}.json`) — no hardcoded strings.
6. **Design system & Top Sheet forms:** Follow `.agents/skills/pathshala-pro-design-system/SKILL.md`. All Add/Update forms MUST use top-slide-down drawers (`TopSheet`). Dashboards must use `ERPMetricCard` and `ERPDataTable`.
7. **CodeGraph Intelligence:** Always use CodeGraph (`codegraph explore`, `codegraph node`, `codegraph impact`) as the primary code navigation tool across the project. Sync with `npx @colbymchenry/codegraph sync`.

## Security

- Never commit secrets; `.env` stays local (see `.env.example`).
- Student/staff data is PII — never log it, never expose it in API responses without permission checks.
- Rate limiting exists in `src/lib/rate-limit.ts` — keep it on public/auth endpoints.

## Skill Routing (load when task matches)

| Task | Skill |
|---|---|
| ERP UI / Design system / Forms / Cards | `pathshala-pro-design-system` |
| Codebase navigation & intelligence | CodeGraph (`codegraph explore / node`) |
| New page/component/route | `nextjs-app-router-patterns` |
| Schema/query/migration changes | `prisma-expert` |
| Forms or validation | `zod-validation-expert` |
| UI components / styling | `shadcn`, `tailwind-patterns` |
| Performance issues | `react-best-practices`, `sql-optimization-patterns` |
| Multi-tenant isolation work | `saas-multi-tenant` |
| Auth/session changes | `auth-implementation-patterns`, `backend-security-coder` |
| Fee payment integration (PK) | `pakistan-payments-stack` |
| Tests failing | `test-fixing` |
| E2E flows (admission→fee→exam) | `e2e-testing` |
| Debugging | `systematic-debugging` |
| Claiming done | `verification-before-completion` |

## Workflow

- Always use CodeGraph first for locating symbols, dependencies, and call trees.
- Run `npm run lint` and `npm run test:run` after changes; fix before declaring done.
- Use Context7 MCP for Next.js/Prisma/TanStack docs instead of guessing APIs.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tools** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them. `codegraph_node` returns one symbol's source + callers, or reads a whole file with line numbers. If the tools are listed but deferred, load them by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` and `codegraph node <symbol-or-file>` print the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
