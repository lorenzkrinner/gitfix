# Phase 2: Triage Agent + Real-Time Streaming

## Context

Phase 1 established the foundation: Next.js app with Clerk auth, GitHub App integration, webhook endpoint with signature verification, and a repo connection flow. Webhooks are received but event handlers are stubbed. No Inngest, no AI SDK, no issue tracking yet.

Phase 2 adds the triage agent (quick Claude Sonnet call to classify issues), a mocked fix agent, and real-time streaming via Inngest Realtime so the frontend shows live progress. The fix agent is mocked — it simulates work and publishes progress updates. The real fix agent comes in Phase 3.

**Key user decisions:**
- Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) for the triage call
- Inngest for background jobs, with Inngest Realtime for streaming to frontend
- Triage is a quick direct call inside the Inngest function, not a separate API route
- Mock fix agent publishes fake progress (reasoning, file reads, code diffs) via Inngest Realtime
- Frontend subscribes to Inngest Realtime channel and shows live updates
- When done, show a summary of what the agent did + the comment it will post to the issue
- All repo/issue access is scoped to the active Clerk organization (`orgId`), not individual users

---

## Step 1 — Install dependencies

```bash
pnpm add inngest ai @ai-sdk/anthropic
```

Inngest Realtime is included in the `inngest` package (developer preview). No extra package needed.

---

## Step 2 — Environment variables

**File:** `src/env.js`

Add to server schema:
- `ANTHROPIC_API_KEY` — for Claude Sonnet triage calls
- `INNGEST_EVENT_KEY` — optional, for Inngest Cloud (not needed in dev)
- `INNGEST_SIGNING_KEY` — optional, for Inngest Cloud

Only `ANTHROPIC_API_KEY` is strictly required for Phase 2.

---

## Step 3 — Database schema

### 3a. Issues table

**File:** `src/server/db/tables/issue.ts` (new)

```
issues table:
- id: uuid, PK
- repositoryId: uuid, FK → repositories.id
- githubIssueNumber: integer
- githubIssueId: text (GitHub's issue ID)
- title: text
- body: text (nullable)
- url: text (html_url)
- status: text — "analyzing" | "fixing" | "pr_open" | "awaiting_review" | "resolved" | "escalated" | "too_complex" | "skipped"
- triageResult: jsonb (nullable) — { classification, reasoning }
- fixSummary: text (nullable) — AI-generated summary of what was fixed
- issueComment: text (nullable) — the comment to post on the GitHub issue once approved
- prUrl: text (nullable)
- prNumber: integer (nullable)
- branchName: text (nullable)
- retryCount: integer, default 0
- startedAt: timestamp (when processing began)
- resolvedAt: timestamp (nullable)
- createdAt: timestamp
- updatedAt: timestamp
```

Indexes on: `repositoryId`, `githubIssueId`, `status`

### 3b. Issue activity table

**File:** `src/server/db/tables/issue-activity.ts` (new)

```
issue_activity table:
- id: uuid, PK
- issueId: uuid, FK → issues.id
- type: text — agentic coding event types (see list below)
- details: jsonb — type-specific data
- createdAt: timestamp
```

**Activity types** (modeled after events in an agentic coding session):

| Type | Description | Details (jsonb) |
|------|-------------|-----------------|
| `triage` | Issue classification result | `{ classification, reasoning }` |
| `reasoning` | Agent thinking/planning | `{ content }` |
| `web_search` | Agent searched the web | `{ query, results }` |
| `file_read` | Agent read a file | `{ filePath, snippet? }` |
| `file_change` | Agent modified/created a file | `{ filePath, diff }` |
| `run_command` | Agent ran a shell command | `{ command, output, exitCode }` |
| `tool_call` | Agent called a generic tool | `{ toolName, input, output }` |
| `error` | Something went wrong | `{ message, stack? }` |
| `pr_opened` | PR was created | `{ prUrl, prNumber, branchName }` |
| `ci_result` | CI check completed | `{ conclusion, details }` |
| `escalated` | Issue escalated to human | `{ reason }` |
| `comment_posted` | Comment posted on GitHub issue | `{ commentBody }` |
| `done` | Agent finished working | `{ summary, issueComment }` |

Index on: `issueId`

### 3c. Relations

**File:** `src/server/db/relations.ts`

Define Drizzle relations:
- `repositories` has many `issues`
- `issues` belongs to `repositories`
- `issues` has many `issueActivity`
- `issueActivity` belongs to `issues`

### 3d. Organization-scoped ownership

**File:** `src/server/db/tables/repository.ts`

- `organizationId` is `.notNull()` — an active Clerk organization is required
- `userId` is kept as "connected by" for audit purposes
- All authorization checks use `organizationId`, not `userId`

### 3e. Export and migrate

- Update `src/server/db/tables/index.ts` to export new tables
- Run `pnpm db:push` to sync schema

---

## Step 4 — Inngest setup

### 4a. Inngest client

**File:** `src/lib/inngest/client.ts` (new)

```typescript
import { Inngest, realtimeMiddleware } from "inngest";

export const inngest = new Inngest({
  id: "gitfix",
  middleware: [realtimeMiddleware()],
});
```

The `realtimeMiddleware()` enables `publish()` calls inside Inngest functions for streaming to the frontend.

### 4b. Inngest serve route

**File:** `src/app/api/inngest/route.ts` (new)

```typescript
import { serve } from "inngest/next";
import { inngest } from "~/lib/inngest/client";
import { triageAndFix } from "~/lib/inngest/functions/triage-and-fix";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [triageAndFix],
});
```

---

## Step 5 — Triage + mock fix Inngest function

**File:** `src/lib/inngest/functions/triage-and-fix.ts` (new)

This is a single Inngest function with multiple steps. The triage step is real (calls Claude Sonnet). The fix step is mocked (simulates work with fake progress).

### Flow:

```
Event: "issue/triage-and-fix"
Data: { issueId: string }

Step 1: "triage" (real)
  - Fetch issue from DB (title, body)
  - Call Claude Sonnet via Vercel AI SDK with triage prompt
  - Classify as: fixable | too_complex | not_actionable
  - Store triage result in DB (issue.triageResult, issue.status)
  - Log activity: { type: "triage", details: { classification, reasoning } }
  - Publish via Inngest Realtime: { type: "triage", classification, reasoning }
  - If not fixable → update status, publish done, return early

Step 2: "fix" (mocked — replaced with real agent in Phase 3)
  - Publish + log: { type: "reasoning", details: { content: "Analyzing the issue to identify affected files..." } }
  - Wait 2s (simulate)
  - Publish + log: { type: "file_read", details: { filePath: "src/utils/auth.ts" } }
  - Publish + log: { type: "file_read", details: { filePath: "src/lib/db.ts" } }
  - Wait 2s
  - Publish + log: { type: "reasoning", details: { content: "The issue is caused by a missing null check in the auth handler..." } }
  - Wait 2s
  - Publish + log: { type: "file_change", details: { filePath: "src/utils/auth.ts", diff: "..." } }
  - Publish + log: { type: "run_command", details: { command: "npm test", output: "All tests passed", exitCode: 0 } }
  - Update issue: status → "awaiting_review", fixSummary, issueComment
  - Publish + log: { type: "done", details: { summary: "...", issueComment: "..." } }
```

### Triage prompt (Claude Sonnet):

```
You are a triage agent for a GitHub issue auto-fixer. Given an issue title and body,
classify it into one of three categories:

1. "fixable" — A clear bug with enough context to attempt an automated fix.
2. "too_complex" — A large-scale architectural issue requiring significant refactoring.
3. "not_actionable" — A feature request, question, unclear report, or missing reproduction steps.

Respond with JSON: { "classification": "fixable" | "too_complex" | "not_actionable", "reasoning": "..." }
```

### Inngest Realtime channel:

The channel name will be: `issue:{issueId}` — each issue gets its own channel. The frontend subscribes to this channel when viewing an issue.

---

## Step 6 — Webhook handler updates

**File:** `src/app/api/webhooks/github/route.ts` (modify)

Update `handleIssuesEvent()` for the `"opened"` action:

1. Extract issue data from payload (number, title, body, html_url, repo full_name, installation_id)
2. Look up the repository in DB by `githubRepoId` (the `repository.id` from the webhook payload)
3. If repo not found or not active → ignore
4. Insert new issue into `issues` table with status `"analyzing"`
5. Send Inngest event: `inngest.send({ name: "issue/triage-and-fix", data: { issueId } })`
6. Return 200

---

## Step 7 — tRPC authorization & issue router

### 7a. Organization-protected procedure

**File:** `src/server/api/trpc.ts` (modify)

Add `orgProtectedProcedure` that enforces both `ctx.userId` and `ctx.orgId` are non-null. All repo and issue procedures use this instead of `protectedProcedure`.

### 7b. Issue router

**File:** `src/server/api/routers/issue.ts` (new)

All procedures use `orgProtectedProcedure` and check `repositories.organizationId === ctx.orgId`.

### Procedures:

1. **`list`** — List issues for a repository
   - Input: `{ repositoryId: string, status?: string }`
   - Returns issues ordered by `createdAt` desc
   - Validates org owns the repository via `organizationId`

2. **`get`** — Get a single issue with its activity trail
   - Input: `{ id: string }`
   - Returns issue + all `issueActivity` entries ordered by `createdAt` asc
   - Validates org owns the parent repository via `organizationId`

3. **`getRealtimeToken`** — Get a subscription token for Inngest Realtime
   - Input: `{ issueId: string }`
   - Uses Inngest's `realtime.getSubscriptionToken()` to generate a time-limited token for the `issue:{issueId}` channel
   - Validates org owns the parent repository via `organizationId`
   - Returns the token for the frontend to use

### 7c. Update repository router

**File:** `src/server/api/routers/repository.ts` (modify)

Switch all procedures from `protectedProcedure` to `orgProtectedProcedure`. Replace all `eq(repositories.userId, ctx.userId)` checks with `eq(repositories.organizationId, ctx.orgId)`.

### Register in root router:

**File:** `src/server/api/root.ts` (modify)

Add `issue: issueRouter` to the `appRouter`.

---

## Step 8 — UI: Repo detail page with issue list

**File:** `src/app/repos/[id]/page.tsx` (modify)

Replace the current JSON dump with a proper repo detail page:

- Show repo name, mode badge, active status
- Below: list of issues processed by the agent (fetched via `api.issue.list`)
- Each issue row shows: issue number, title, status badge, time ago
- Status badges with colors:
  - `analyzing` → yellow/amber
  - `fixing` → blue (animated pulse)
  - `awaiting_review` → purple
  - `resolved` → green
  - `escalated` → red
  - `too_complex` → orange
  - `skipped` → gray
- Empty state: "No issues processed yet. Issues will appear here when they are created in your GitHub repository."
- Each issue row links to `/repos/[id]/issues/[issueId]`

---

## Step 9 — UI: Issue detail page with real-time streaming

### 9a. Issue detail page (server component)

**File:** `src/app/repos/[id]/issues/[issueId]/page.tsx` (new)

- Fetch issue + activity trail via `api.issue.get`
- Fetch realtime token via `api.issue.getRealtimeToken` (if issue is in an active state)
- Render `<IssueTimeline>` client component, passing issue data, activity, and realtime token

### 9b. Issue timeline component (client component)

**File:** `src/app/repos/[id]/issues/_components/issue-timeline.tsx` (new)

This is the main streaming UI component:

1. Show issue title, number, link to GitHub
2. Show the timeline of activities:
   - Each activity entry is a card/step in a vertical timeline
   - Icons per step type (search icon for triage, file icon for file_read, code icon for fix, etc.)
   - Expandable details (reasoning text, file list, code diffs)
3. If issue is in `analyzing` or `fixing` state:
   - Subscribe to Inngest Realtime channel `issue:{issueId}` using the token
   - Show a loading/spinner state
   - As events stream in, append them to the timeline in real-time
   - When `type: "done"` event received → show the summary card
4. Summary card (shown when done):
   - "What the agent did" summary
   - "Comment to be posted" preview (the GitHub issue comment)
   - "Approve" button (future — for Phase 3/4 when we have real PRs)

### Inngest Realtime subscription (frontend):

```typescript
import { useInngestSubscription } from "inngest/react";

// Inside the component:
const { data, isConnected } = useInngestSubscription({
  channel: `issue:${issueId}`,
  token: realtimeToken,
  topics: ["triage", "reasoning", "file_read", "file_change", "run_command", "web_search", "tool_call", "error", "done"],
});
```

Each incoming event gets appended to the local timeline state, creating a live-updating UI.

---

## Step 10 — Status badge component

**File:** `src/app/repos/[id]/issues/_components/status-badge.tsx` (new)

Reusable badge component that maps issue status to a colored badge with label. Used in both the issue list and issue detail page.

---

## Files to create (8 new files):

| File | Purpose |
|------|---------|
| `src/server/db/tables/issue.ts` | Issues table schema |
| `src/server/db/tables/issue-activity.ts` | Issue activity table schema |
| `src/lib/inngest/client.ts` | Inngest client with realtime middleware |
| `src/app/api/inngest/route.ts` | Inngest serve route |
| `src/lib/inngest/functions/triage-and-fix.ts` | Triage + mock fix function |
| `src/server/api/routers/issue.ts` | Issue tRPC router |
| `src/app/repos/[id]/issues/[issueId]/page.tsx` | Issue detail page |
| `src/app/repos/[id]/issues/_components/issue-timeline.tsx` | Real-time timeline component |
| `src/app/repos/[id]/issues/_components/status-badge.tsx` | Status badge component |

## Files to modify (6 files):

| File | Change |
|------|--------|
| `src/env.js` | Add `ANTHROPIC_API_KEY` |
| `src/server/db/tables/index.ts` | Export new tables |
| `src/server/db/tables/repository.ts` | Make `organizationId` not null |
| `src/server/db/relations.ts` | Add relations |
| `src/server/api/trpc.ts` | Add `orgProtectedProcedure` |
| `src/server/api/routers/repository.ts` | Switch to `orgProtectedProcedure`, use `orgId` for all auth checks |
| `src/server/api/root.ts` | Register issue router |
| `src/app/api/webhooks/github/route.ts` | Implement `handleIssuesEvent` |
| `src/app/repos/[id]/page.tsx` | Replace JSON dump with issue list UI |

---

## Verification

1. **DB schema**: Run `pnpm db:push`, verify tables in Drizzle Studio (`pnpm db:studio`)
2. **Inngest dev server**: Run `npx inngest-cli@latest dev` alongside `pnpm dev`, verify functions appear in Inngest dashboard
3. **Webhook → triage flow**: Create an issue in a connected GitHub repo → verify it appears in DB with status `analyzing` → verify triage runs and classifies it → verify status updates to `fixing` or `too_complex`/`skipped`
4. **Real-time streaming**: Open the issue detail page while the mock fix is running → verify timeline updates appear in real-time
5. **Summary display**: After mock fix completes → verify summary card shows with "what was done" and "comment preview"
6. **Org scoping**: Verify that switching orgs in Clerk only shows repos/issues for that org
7. **Type check**: `pnpm typecheck` passes
8. **Lint**: `pnpm lint` passes
