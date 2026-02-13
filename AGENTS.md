# GitFix — AI Bug Fixer

**Product:** SaaS platform that automatically fixes GitHub issues via AI agents
**Version:** 0.1.0 (Pre-MVP)
**Stack:** T3 App (Next.js 15, TypeScript, tRPC, Drizzle ORM, Vercel Postgres)
**Target Launch:** March 2026

## Table of Contents

1. [Product Overview](#product-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Coding Standards](#coding-standards)
6. [Database Patterns](#database-patterns)
7. [API & tRPC Patterns](#api--trpc-patterns)
8. [Product Architecture](#product-architecture)
9. [Development Phases](#development-phases)

---

## Product Overview

### What This App Does

GitFix connects to GitHub repositories via a GitHub App and automatically fixes bugs reported as GitHub issues. When a new issue is created:

1. **Triage Agent** (Claude Sonnet) evaluates if the issue is fixable
2. **Fix Agent** (GPT 5.3 Codex) reads the codebase, generates a fix, and opens a PR
3. **CI Awareness** — waits for CI checks to pass
4. **Auto-merge or Approval** — depending on repo configuration
5. **Issue Closure** — comments on the original issue confirming resolution

**Target Users:** Small to mid-size teams, open source maintainers, solo founders

**Value Prop:** Turn GitHub issues into merged PRs in minutes without human intervention

### Key Features (from PRD)

- GitHub App integration with webhooks
- AI triage (fixable / too complex / not actionable)
- Code fix generation with iterative context gathering
- PR-based workflow with branch `ai-fix/issue-{number}`
- Retry logic on CI failures (max 2 retries)
- Escalation flow when retries exhausted
- Repo-level settings (auto/approval mode, max retries, context hints)
- Notifications (in-app + email via Resend)
- Audit trail for every issue (timeline of agent actions)
- Two plans: Hobby (3 repos, 20 fixes/month, approval only) and Pro (unlimited)

**See `PRD.md` for full product requirements.**

---

## Tech Stack

### Core Framework

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Framework | Next.js | 15.2.3 | App Router, React Server Components |
| Runtime | React | 19.0.0 | Latest stable |
| Language | TypeScript | 5.8.2 | Strict mode enabled |
| Package Manager | pnpm | 10.18.3 | Required — do not use npm/yarn |

### Data & API

| Layer | Technology | Notes |
|-------|------------|-------|
| Database | Vercel Postgres | Serverless PostgreSQL via `postgres` driver |
| ORM | Drizzle ORM | 0.41.0 — schema in `src/server/db/schema.ts` |
| API Layer | tRPC | 11.0.0 — type-safe API without code generation |
| Validation | Zod | 3.24.2 — runtime type validation |
| Data Transform | SuperJSON | 2.2.1 — serialize dates, maps, sets, etc. |

### Integrations (Planned)

| Service | Purpose | Status |
|---------|---------|--------|
| Clerk | Authentication (GitHub OAuth) | Phase 1 |
| GitHub App | Webhooks, repo access, PRs | Phase 1 |
| Vercel AI SDK + Claude | Triage agent (Sonnet) | Phase 2 |
| Vercel AI SDK + OpenAI | Fix agent (GPT 5.3 Codex) | Phase 3 |
| Inngest | Background jobs & durable workflows | Phase 1 |
| Resend | Email notifications | Phase 4 |
| Stripe | Billing (Hobby/Pro plans) | Phase 5 |

### Tooling

| Tool | Purpose |
|------|---------|
| ESLint | Linting with Next.js config + Drizzle plugin |
| Prettier | Code formatting with Tailwind plugin |
| Tailwind CSS | Utility-first CSS framework (v4) |
| Drizzle Kit | Database migrations and schema management |
| Turbopack | Fast dev server (`next dev --turbo`) |

---

## Project Structure

```
/Users/lorenzkrinner/dev/gitfix/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── _components/          # Shared React components
│   │   ├── api/trpc/[trpc]/      # tRPC API route handler
│   │   ├── layout.tsx            # Root layout with TRPCReactProvider
│   │   └── page.tsx              # Home page
│   ├── server/
│   │   ├── api/
│   │   │   ├── root.ts           # Main tRPC router (combines all routers)
│   │   │   ├── trpc.ts           # tRPC context, middleware, procedures
│   │   │   └── routers/          # Feature-specific tRPC routers
│   │   │       └── post.ts       # Example router (to be replaced)
│   │   └── db/
│   │       ├── index.ts          # Drizzle client instance
│   │       └── schema.ts         # Database schema (tables, indexes)
│   ├── trpc/
│   │   ├── query-client.ts       # React Query client config
│   │   ├── react.tsx             # Client-side tRPC provider
│   │   └── server.ts             # Server-side tRPC caller
│   ├── styles/
│   │   └── globals.css           # Global styles + Tailwind imports
│   └── env.js                    # Environment variable validation (Zod)
├── public/                       # Static assets
├── drizzle.config.ts             # Drizzle Kit configuration
├── next.config.js                # Next.js configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── .env                          # Local environment variables (gitignored)
├── .env.example                  # Example environment variables
├── PRD.md                        # Product Requirements Document
└── CLAUDE.md                     # This file
```

### Path Aliases

- `~/*` maps to `./src/*` (configured in `tsconfig.json`)
- Example: `import { db } from "~/server/db"`

### File Naming Conventions

- React components: PascalCase (e.g., `UserProfile.tsx`)
- Utilities and helpers: camelCase (e.g., `formatDate.ts`)
- API routers: lowercase (e.g., `post.ts`, `repository.ts`)
- Database schema: lowercase (e.g., `schema.ts`)

---

## Development Workflow

### Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL

# Start development server (with Turbopack)
pnpm dev

# Run type checking
pnpm typecheck

# Run linter
pnpm lint

# Format code
pnpm format:write
```

### Database Workflow

```bash
# Generate migration from schema changes
pnpm db:generate

# Push schema directly to database (no migration files)
pnpm db:push

# Run migrations
pnpm db:migrate

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

### Pre-commit Checklist

Before committing code, ensure:

1. **Type check passes:** `pnpm typecheck`
2. **Linter passes:** `pnpm lint`
3. **Code is formatted:** `pnpm format:write`
4. **Database schema is synced:** If you changed `schema.ts`, run `pnpm db:push` or `pnpm db:generate`

You can run all checks at once:

```bash
pnpm check  # Runs lint + typecheck
```

### Git Workflow

- Main branch: `main`
- Use conventional commit messages:
  - `feat: add triage agent endpoint`
  - `fix: handle missing issue body`
  - `refactor: extract GitHub API client`
  - `docs: update CLAUDE.md with new patterns`

---

## Coding Standards

### TypeScript

- **Strict mode enabled** — no implicit `any`, enforce null checks
- **No unchecked indexed access** — `tsconfig.json` has `noUncheckedIndexedAccess: true`
- Always define explicit return types for public functions
- Use Zod schemas for runtime validation (especially API inputs)
- Prefer `type` over `interface` unless you need declaration merging

### React & Next.js

- Use **React Server Components** by default
- Add `"use client"` directive only when necessary (client state, browser APIs, event handlers)
- Prefer **Server Actions** over API routes for mutations (when appropriate)
- Use **Next.js metadata API** for SEO (`export const metadata`)
- Avoid inline styles — use Tailwind classes
- Keep components small and focused (single responsibility)

### Naming Conventions

- **Components:** PascalCase (`IssueList.tsx`)
- **Hooks:** camelCase with `use` prefix (`useRepoSettings.ts`)
- **Utilities:** camelCase (`formatTimestamp.ts`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Types:** PascalCase (`type Repository = ...`)

### Code Organization

- **Colocate** related files (component + types + tests)
- **Barrel exports** for public APIs (`index.ts` re-exporting)
- **Avoid deep nesting** — max 3 levels in `src/app`
- **Separate concerns:** business logic in `/server`, UI in `/app`

### Error Handling

- Use **Zod** for input validation in tRPC procedures
- Use **TRPCError** for API errors with proper error codes
- Handle errors at boundaries (page/component level)
- Log errors with context (user ID, repo ID, issue number)

### Comments

- **Avoid obvious comments** — code should be self-documenting
- **Document why, not what** — explain decisions, not mechanics
- Use **TSDoc** for public APIs and complex functions
- Add **TODO comments** with context: `// TODO(lorenz): Implement retry logic after CI integration`

---

## Database Patterns

### Schema Definition (Drizzle ORM)

All tables use a multi-project schema pattern with the `gitfix_` prefix:

```typescript
import { pgTableCreator } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `gitfix_${name}`);

export const repositories = createTable(
  "repository",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    organizationId: d.text().notNull(),
    githubRepoId: d.text().notNull(),
    fullName: d.text().notNull(), // e.g., "owner/repo"
    mode: d.text().$type<"auto" | "approval">().notNull().default("approval"),
    maxRetries: d.integer().notNull().default(2),
    isActive: d.boolean().notNull().default(true),
    createdAt: d.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("org_id_idx").on(t.organizationId),
    index("github_repo_id_idx").on(t.githubRepoId),
  ],
);
```

### Key Patterns

- **UUIDs for primary keys** — `d.uuid().primaryKey().defaultRandom()`
- **Timestamps:** Use `withTimezone: true` and `$defaultFn` for createdAt, `$onUpdate` for updatedAt
- **Enums as text with type safety:** `d.text().$type<"auto" | "approval">()`
- **Indexes:** Add indexes for foreign keys and frequently queried fields
- **Soft deletes:** Use `isActive` or `deletedAt` instead of hard deletes
- **JSON fields:** Use `d.jsonb()` for structured data (e.g., `triageResult`, `activityDetails`)

### Database Client

Located at `src/server/db/index.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });
```

- Use `db` singleton from `~/server/db`
- Never create new database connections in route handlers
- Use Drizzle query builder, avoid raw SQL unless necessary

---

## API & tRPC Patterns

### tRPC Context

Defined in `src/server/api/trpc.ts`:

```typescript
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db,
    ...opts,
  };
};
```

**To add authentication:**

```typescript
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const { userId, orgId } = await auth(); // Clerk or similar
  return {
    db,
    userId,
    orgId,
    ...opts,
  };
};
```

### Creating Routers

Example from PRD — a repository router:

```typescript
// src/server/api/routers/repository.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const repositoryRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.repositories.findMany({
      where: (repos, { eq }) => eq(repos.isActive, true),
      orderBy: (repos, { desc }) => [desc(repos.createdAt)],
    });
  }),

  connect: publicProcedure
    .input(
      z.object({
        githubRepoId: z.string(),
        fullName: z.string(),
        mode: z.enum(["auto", "approval"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const repo = await ctx.db.insert(repositories).values({
        organizationId: ctx.orgId, // From auth context
        githubRepoId: input.githubRepoId,
        fullName: input.fullName,
        mode: input.mode,
      });
      return repo;
    }),

  updateSettings: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        mode: z.enum(["auto", "approval"]).optional(),
        maxRetries: z.number().min(0).max(2).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      return ctx.db
        .update(repositories)
        .set(updates)
        .where(eq(repositories.id, id));
    }),
});
```

### Registering Routers

In `src/server/api/root.ts`:

```typescript
import { createTRPCRouter } from "~/server/api/trpc";
import { repositoryRouter } from "~/server/api/routers/repository";
import { issueRouter } from "~/server/api/routers/issue";

export const appRouter = createTRPCRouter({
  repository: repositoryRouter,
  issue: issueRouter,
});

export type AppRouter = typeof appRouter;
```

### Client Usage

In React Server Components:

```typescript
import { api } from "~/trpc/server";

export default async function DashboardPage() {
  const repos = await api.repository.list();
  return <RepoList repos={repos} />;
}
```

In Client Components:

```typescript
"use client";

import { api } from "~/trpc/react";

export function ConnectRepoButton() {
  const utils = api.useUtils();
  const connect = api.repository.connect.useMutation({
    onSuccess: () => {
      utils.repository.list.invalidate();
    },
  });

  return (
    <button
      onClick={() =>
        connect.mutate({
          githubRepoId: "123456",
          fullName: "acme/api",
          mode: "approval",
        })
      }
    >
      Connect Repo
    </button>
  );
}
```

---

## Product Architecture

### System Flow

```
GitHub Issue Created
  ↓
Webhook → /api/webhooks/github
  ↓
Inngest Event: issue.triage
  ↓
Triage Agent (Claude Sonnet)
  → Fixable? → issue.fix
  → Too Complex? → Notify owner, label issue
  → Not Actionable? → Label and skip
  ↓
Fix Agent (GPT 5.3 Codex)
  → Read codebase (GitHub API)
  → Generate fix
  → Create branch (ai-fix/issue-{number})
  → Commit changes
  → Open PR
  ↓
Webhook → check_suite.completed
  ↓
CI Pass?
  → Auto Mode: Merge PR → Close issue
  → Approval Mode: Notify owner → Wait for review
  ↓
CI Fail?
  → Retry (max 2) with error context
  → Still failing? → Escalate (label ai:needs-human)
```

### Data Model (Key Entities)

From PRD section 6:

1. **Organization** — Handled by Clerk
2. **User** — Handled by Clerk
3. **Repository** — Connected repos with mode, settings
4. **Issue** — GitHub issues being processed
5. **IssueActivity** — Audit trail (triage, file_read, fix_generated, ci_result, etc.)
6. **Notification** — In-app + email notifications

**See PRD.md section 6 for full schema details.**

### API Routes (Future)

From PRD section 7:

- `POST /api/webhooks/github` — GitHub webhook receiver
- `POST /api/webhooks/clerk` — Clerk webhook for user/org sync
- `POST /api/webhooks/stripe` — Stripe webhook for billing events
- `GET /api/repos` — List connected repositories (tRPC)
- `POST /api/repos/connect` — Connect a new repo (tRPC)
- `GET /api/issues/:id` — Issue detail with audit trail (tRPC)

### Inngest Functions (Future)

- `issue.triage` — Triage agent workflow
- `issue.fix` — Fix agent workflow
- `issue.retry` — Retry workflow on CI failure
- `issue.escalate` — Escalation flow
- `pr.ci-completed` — Handle CI results
- `pr.merged` — Post-merge actions

---

## Development Phases

### Current Status: **Phase 1 Foundation (In Progress)**

From PRD section 8, we are building the foundation:

**Phase 1 Goals:**

- [x] Initialize Next.js project with TypeScript
- [x] Deploy to Vercel
- [x] Set up Vercel Postgres with Drizzle ORM
- [x] Create base data models (to be replaced with GitFix schema)
- [ ] Set up Clerk authentication with GitHub OAuth
- [ ] Create GitHub App (dev + production)
- [ ] Implement webhook endpoint with signature verification
- [ ] Set up Inngest client and dev server
- [ ] Build repo connection flow (install → select → pick mode → done)
- [ ] Verify webhook delivery end-to-end

**Deliverable:** Issues created in connected repos appear in the database.

### Upcoming Phases

- **Phase 2:** Triage Agent (AI classification)
- **Phase 3:** Fix Agent (code generation + PR creation)
- **Phase 4:** PR Lifecycle (CI awareness, auto-merge, retries)
- **Phase 5:** Dashboard, Billing, Polish (full UI + Stripe)

**See PRD.md section 8 for detailed phase breakdown.**

---

## Important Notes

### Environment Variables

Always validate environment variables in `src/env.js` using Zod:

```typescript
server: {
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_PRIVATE_KEY: z.string().min(1),
  CLAUDE_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().min(1),
},
client: {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
}
```

Never hardcode secrets. Always use `env` object from `~/env.js`.

### Security

- **Webhook signature verification** — required for GitHub, Clerk, Stripe webhooks
- **Authentication middleware** — protect tRPC procedures that modify data
- **Rate limiting** — implement for webhook handlers and expensive operations
- **Input validation** — always use Zod schemas for all inputs
- **Secrets management** — use Vercel environment variables, never commit `.env`

### Performance

- **Use React Server Components** for data fetching (no client waterfalls)
- **Parallel queries** — use `Promise.all` in server components
- **Database indexes** — add indexes for all foreign keys and frequently queried fields
- **Caching** — use Next.js caching (`revalidate`, `cache: 'force-cache'`)
- **Lazy loading** — use dynamic imports for heavy client components

### Testing (Future)

- Unit tests: Vitest (to be added)
- E2E tests: Playwright (to be added)
- Database tests: Use separate test database with migrations
- Mocking: Mock GitHub API, Clerk, Inngest for tests

---

## Working with Claude Code

When working with this codebase:

1. **Always read files before editing** — use Read tool first
2. **Follow T3 patterns** — don't break from established conventions
3. **Update this file** when adding new patterns or architecture decisions
4. **Reference PRD.md** for product context and requirements
5. **Test database changes** — always run `pnpm db:push` or `pnpm db:generate` after schema changes
6. **Run type checking** — `pnpm typecheck` before committing
7. **Keep it simple** — avoid over-engineering, follow existing patterns

### Common Tasks

**Add a new database table:**

1. Edit `src/server/db/schema.ts`
2. Run `pnpm db:push` (or `pnpm db:generate` for migrations)
3. Update types in relevant routers

**Add a new API endpoint (tRPC):**

1. Create router in `src/server/api/routers/`
2. Register in `src/server/api/root.ts`
3. Use in components via `api.yourRouter.yourProcedure`

**Add authentication:**

1. Set up Clerk in `src/app/layout.tsx`
2. Update tRPC context in `src/server/api/trpc.ts`
3. Create protected procedure: `export const protectedProcedure = publicProcedure.use(authMiddleware)`

---

## Questions or Clarifications

If you encounter ambiguity:

- **Product questions:** Check PRD.md first
- **Technical patterns:** Follow existing code in `src/server/api/routers/post.ts` or ask
- **Architecture decisions:** Prefer simple solutions, avoid premature optimization

When in doubt, ask before implementing — the cost of clarification is low, the cost of wrong implementation is high.