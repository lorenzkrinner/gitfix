# AI Bug Fixer — Product Requirements Document

**Version:** 1.0 | **Date:** February 2026 | **Status:** Draft | **Author:** Lorenz

| Field | Value |
|-------|-------|
| Tech Stack | Next.js, TypeScript, Vercel, Clerk, Inngest, Claude API |
| Target Launch | March 2026 |

---

## 1. Product Overview

### 1.1 Summary

AI Bug Fixer is a SaaS platform that connects to GitHub repositories and automatically fixes bugs reported as issues. When a new issue is created, a lightweight AI triage agent evaluates whether it is something the system can handle. If yes, a code-fixing agent analyzes the codebase, generates a fix, opens a pull request, and either auto-merges or waits for human approval depending on the repository configuration.

### 1.2 Target Users

- Small to mid-size engineering teams (1–20 developers)
- Open source maintainers overwhelmed with bug reports
- Solo founders and indie hackers who want to spend less time on bug triage

### 1.3 Core Value Proposition

Turn GitHub issues into merged pull requests without human intervention — or with minimal review. Reduce time-to-fix from days to minutes.

---

## 2. System Architecture

### 2.1 Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js (App Router) | TypeScript throughout |
| Hosting | Vercel | Serverless functions + edge |
| AI | Vercel AI SDK + Claude API | Primary model for code generation |
| Auth | Clerk | GitHub OAuth for login + org management |
| GitHub Integration | GitHub App | Webhooks, repo access, PRs, issue comments |
| Background Jobs | Inngest | Durable workflows for long-running agent tasks |
| Database | Vercel Postgres | Repo configs, fix history, audit logs |
| Notifications | In-app + Email (Resend) | Slack as future addition |
| Payments | Stripe | hobby and Pro tiers |

### 2.2 High-Level Flow

The system follows a linear pipeline triggered by GitHub webhooks, with branching logic for complexity assessment and approval modes:

- **Step 1 — Webhook Received:** A new issue is created in a connected repo. GitHub sends a webhook to the app.
- **Step 2 — Triage Agent:** A lightweight AI evaluates the issue. Classifies it as Fixable, Too Complex, or Not Actionable.
- **Step 3 — Fix Agent:** If fixable, the agent reads the relevant codebase, generates a fix, creates a branch, commits changes, and opens a PR.
- **Step 4 — CI Awareness:** The system waits for CI checks to complete on the PR before proceeding.
- **Step 5 — Mode-Dependent Resolution:** In Auto Mode, the PR auto-merges on CI pass. In Approval Mode, the owner is notified and the agent waits for a human review.
- **Step 6 — Issue Closure:** On merge, the agent comments on the original issue confirming resolution and closes it.

### 2.3 Retry & Escalation Flow

If CI fails after the agent's fix, the agent receives the CI error output as additional context and retries. Maximum retries: 2 (configurable per repo, 0–2). If all retries are exhausted:

- The PR is labeled `ai:needs-human`
- The owner is notified via configured channels (in-app + email)
- The issue is labeled `ai:escalated`
- The agent adds a comment to the PR explaining what it tried and where it failed

---

## 3. Core Features

### 3.1 GitHub App Integration

Users install the GitHub App on selected repositories. The app requests permissions for issues (read), pull requests (read/write), contents (read/write), checks (read), and webhooks. Webhook events subscribed: `issues.opened`, `issues.labeled`, `pull_request.closed`, `check_suite.completed`.

### 3.2 AI Triage Agent

The triage agent is triggered on every new issue in connected repos. It performs a lightweight, fast evaluation (single AI call, no repo reading required) and classifies the issue into one of three categories:

- **Fixable:** A clear bug with enough context for the agent to attempt a fix.
- **Too Complex:** A large-scale architectural issue that requires significant refactoring or spans too many concerns.
- **Not Actionable:** A feature request, question, unclear report, or missing reproduction steps.

The triage decision is logged in the audit trail. Labels are not used as the source of truth for filtering — the AI decides.

**Complexity handling by plan:** On the hobby plan, issues triaged as "Too Complex" are skipped, and the owner is notified with the issue labeled `ai:too-complex`. On the Pro plan, the agent attempts the fix anyway with best-effort execution, but flags the resulting PR as high-complexity for careful review.

### 3.3 Code Fix Agent

The fix agent reads the issue title, body, labels, and any stack traces or file references. It then fetches relevant files from the repository via the GitHub API. The context-gathering strategy is iterative:

- Start with files explicitly mentioned in the issue or stack trace
- Follow imports and references to gather related files
- For large codebases, use file-tree heuristics to find relevant code

If the agent realizes mid-task that the bug is larger than initially assessed, it can bail out (hobby plan) or flag as high-complexity (Pro plan). The agent outputs a set of file changes: additions, modifications, and deletions.

### 3.4 PR Workflow

The agent always uses a PR-based workflow, never direct commits. This ensures an audit trail and lets CI run before any code is merged.

- **Branch:** `ai-fix/issue-{number}`
- **Commit:** Descriptive message referencing the issue number
- **PR Body:** Summary of changes, reasoning, and link to original issue
- **Label:** `ai-generated`

**Auto Mode:** The system waits for CI to pass, then auto-merges the PR and comments on the original issue confirming resolution.

**Approval Mode:** The system notifies the repo owner via configured channels. The agent waits for a human review. On merge, it comments on the issue confirming resolution.

### 3.5 Notifications

**MVP Channels:**

- In-app notifications (bell icon in dashboard)
- Email notifications via Resend

**Post-MVP:**

- Slack integration (webhook-based, per-org configuration)

**Notification Triggers:**

- Issue picked up by agent
- PR opened
- Fix merged (auto mode)
- PR awaiting review (approval mode)
- CI failure / retry initiated
- Escalation to human after max retries
- Issue marked as too complex

---

## 4. User Interface

### 4.1 Information Architecture

| Page | Purpose |
|------|---------|
| Dashboard (Home) | Activity feed (3 most recent) + full repo list |
| All Activity | Expandable page showing complete activity history |
| Repo Detail | Issues handled by agent for this repo + repo settings |
| Issue Detail | Full audit trail / timeline of agent actions |
| Settings: Account | Profile, email, notification preferences |
| Settings: Organization | Team members, GitHub App installation |
| Settings: Billing | Plan management, usage, payment method |
| Settings: Usage & Stats | Issues handled, success rate, avg time to fix |
| Onboarding | Connect repos, configure modes, go live |

### 4.2 Dashboard (Home)

The home page is designed for at-a-glance awareness. At the top, it displays the three most recent activities across all connected repos (e.g., "Fixed #42 in acme/api", "Escalated #18 in acme/web"). An "Expand" link navigates to a dedicated All Activity page showing the full history.

Below the activity preview, the page shows a list of all connected repositories. Each repo card displays the repo name, its current mode (Auto/Approval), a brief status summary (e.g., "3 fixed this week, 1 pending review"), and a link to the repo detail page.

### 4.3 Connecting a Repository

Connecting a repo should be as simple as possible. The user clicks "Connect Repo," sees a list of all repos accessible through their GitHub App installation, selects a repo, picks a mode (Auto or Approval), and confirms. No additional configuration is required at this step — advanced settings are available later on the repo settings page.

### 4.4 Repo Detail — Issue List

Clicking into a repo from the dashboard shows a table of all issues the agent has processed. The table includes the issue number, title, status badge, time to fix, and date.

**Issue Statuses:**

| Status | Description |
|--------|-------------|
| Analyzing | Triage agent is evaluating the issue |
| Fixing | Fix agent is generating a code fix |
| PR Open | PR created, waiting for CI checks |
| Awaiting Review | Approval mode: waiting for human review |
| Resolved | PR merged and issue closed |
| Escalated | Retries exhausted, needs human intervention |
| Too Complex | Triaged as beyond automated capability |
| Skipped | Not actionable (feature request, question, etc.) |

**Quick Actions:** Users can perform quick actions directly from the issue list without navigating to GitHub: retry a failed fix, dismiss an issue, or view the PR on GitHub.

Filters are available for status and date range.

### 4.5 Issue Detail — Audit Trail

The issue detail page shows a full timeline of every action the agent took, presented chronologically with timestamps and durations. Each step is expandable for additional detail.

**Timeline Steps:**

- Issue Received — timestamp, issue content preview
- Triage Decision — classification result and agent reasoning
- Files Analyzed — list of files the agent read for context
- Fix Generated — summary of changes with diff preview
- PR Opened — link to the GitHub PR
- CI Result — pass or fail, including retry attempts if applicable
- Review Status — who approved and when (approval mode)
- Resolution — merged and closed, or escalated with explanation

### 4.6 Repo-Level Settings

Each repository has its own settings that override organization defaults. This allows teams to use different configurations for different repos (e.g., auto mode for an internal tool, approval mode for a production API).

- Mode: Auto or Approval (toggle)
- Max Retries: 0, 1, or 2
- Notification Preferences: which events trigger notifications
- Context Hints: optional hobby-text field for users to provide context (e.g., "This repo uses Python 3.11 with Django" or "Ignore issues labeled wontfix")

### 4.7 Settings: Usage & Stats

A dedicated page within settings that shows key metrics to help users understand the value the tool is providing and monitor usage against their plan limits:

- Issues handled this month (and historical trend)
- Success rate: percentage of issues resolved vs. escalated
- Average time to fix
- Breakdown by repo
- Plan usage: fixes used vs. limit (hobby plan)

### 4.8 Onboarding Flow

After signing up with Clerk (GitHub OAuth), the user is guided through a minimal onboarding:

1. Install the GitHub App on your account or organization
2. Select repos to connect (simple list, pick and confirm)
3. Choose a mode for each repo (Auto or Approval)
4. (Optional) Test run — pick a past closed issue and simulate the agent flow as a dry run
5. Go live

---

## 5. Plans & Pricing (not fixed yet, open to changes since still in development)

### 5.1 Hobby Plan

- Up to 3 connected repositories
- 20 fixes per month
- Approval mode only (no auto-merge)
- "Too complex" issues are skipped
- Email + in-app notifications
- Community support

### 5.2 Pro Plan

- Unlimited repositories
- Unlimited fixes
- Auto mode + approval mode
- "Too complex" issues are attempted (best effort)
- Priority AI processing
- Slack integration (post-MVP)
- Priority support

**Target price:** $29–49/month per organization (to be validated).

---

## 6. Data Model

The following outlines the core entities and their key fields. This is a simplified representation; the actual schema will include additional indexes, constraints, and audit fields.

### 6.1 Organization

Handled by clerk

### 6.2 User

Handled by clerk

### 6.3 Repository

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organizationId | FK | Belongs to organization |
| githubRepoId | String | GitHub repository ID |
| name / fullName | String | Repo name and full name (owner/repo) |
| installationId | String | GitHub App installation ID |
| mode | Enum | auto \| approval |
| maxRetries | Integer | 0, 1, or 2 (default 2) |
| isActive | Boolean | Whether agent is active for this repo |

### 6.4 Issue

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| repositoryId | FK | Belongs to repository |
| githubIssueNumber | Integer | GitHub issue number |
| title / body / url | String | Issue content and link |
| status | Enum | analyzing \| fixing \| pr_open \| awaiting_review \| resolved \| escalated \| too_complex \| skipped |
| triageResult | JSON | Agent triage reasoning and classification |
| prUrl / prNumber | String | GitHub PR link and number |
| branchName | String | e.g., gitfix/issue-42 |
| retryCount | Integer | Number of retries attempted |
| startedAt / resolvedAt | Timestamp | Processing timestamps |

### 6.5 Issue Activity

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| issueId | FK | Belongs to issue |
| step | Enum | triage \| file_read \| fix_generated \| pr_opened \| ci_result \| retry \| merged \| escalated \| comment_posted |
| details | JSON | Step-specific data (reasoning, diffs, errors) |
| timestamp | Timestamp | When this step occurred |

### 6.6 Notification

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId / orgId | FK | Recipient and org context |
| type | String | Notification category |
| title / body | String | Notification content |
| issueId | FK | Related issue (optional) |
| read | Boolean | Whether notification has been read |
| channel | Enum | in_app \| email |
| createdAt | Timestamp | When notification was created |

---

## 7. API Routes

### 7.1 Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/webhooks/github | GitHub webhook receiver (issues, PRs, checks) |
| POST | /api/webhooks/clerk | Clerk webhook for user/org sync |
| POST | /api/webhooks/stripe | Stripe webhook for billing events |

### 7.2 Authenticated API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/repos | List connected repositories |
| POST | /api/repos/connect | Connect a new repo (select + mode) |
| PATCH | /api/repos/:id/settings | Update repo settings |
| GET | /api/repos/:id/issues | List issues for a repo |
| GET | /api/issues/:id | Issue detail with audit trail |
| POST | /api/issues/:id/retry | Manual retry trigger |
| GET | /api/activity | Global activity feed |
| GET | /api/notifications | User notifications |
| POST | /api/notifications/:id/read | Mark notification as read |
| GET | /api/stats | Usage stats for billing and dashboard |

### 7.3 Inngest Functions

| Event | Description |
|-------|-------------|
| issue.triage | Triage agent workflow: classify the issue |
| issue.fix | Fix agent workflow: read code, generate fix, open PR |
| issue.retry | Retry workflow: re-analyze with CI error context |
| issue.escalate | Escalation: label issue, notify owner |
| pr.ci-completed | Handle CI results: merge or retry |
| pr.merged | Post-merge: comment on issue, update status |

---

## 8. Development Phases

### Phase 1: Foundation

**Goal:** Skeleton app with auth, GitHub App, and webhook pipeline.

- Initialize Next.js project with TypeScript, deploy to Vercel
- Set up Clerk authentication with GitHub OAuth
- Create GitHub App (dev + production) with required permissions
- Implement webhook endpoint with signature verification
- Set up Vercel Postgres with Drizzle ORM
- Create base data models (Organization, User, Repository, Issue)
- Set up Inngest client and dev server
- Build basic repo connection flow (install GitHub App → select repo → pick mode → done)
- Verify webhook delivery end-to-end

*Deliverable: Issues created in connected repos appear in the database.*

### Phase 2: Triage Agent

**Goal:** AI triage that classifies issues and logs decisions.

- Integrate Vercel AI SDK with Claude
- Build triage prompt (issue title + body → fixable / too complex / not actionable)
- Create Inngest function for issue.triage
- Store triage results in Issue record + AuditLog
- Build basic issue list UI (repo detail page) with status badges
- Test with 10+ real GitHub issues from various repos

*Deliverable: Issues are auto-classified and visible in the UI with triage reasoning.*

### Phase 3: Fix Agent

**Goal:** Agent reads repo code, generates a fix, and opens a PR.

- Build repo file fetching via GitHub API (tree + blob endpoints)
- Implement context-gathering strategy: parse issue for file paths and stack traces, fetch referenced files and imports, build condensed codebase context
- Build fix generation prompt (issue + code context → file changes)
- Implement branch creation, file commit, and PR creation via GitHub API
- Create Inngest function for issue.fix with complexity bail-out logic
- Add audit log entries for each step
- Build issue detail page with timeline / audit trail
- Test with real bugs across different languages and frameworks

*Deliverable: Agent opens real PRs that fix real bugs. Full audit trail visible in UI.*

### Phase 4: PR Lifecycle & Modes

**Goal:** Full PR lifecycle with auto/approval modes, CI awareness, and retries.

- Handle check_suite.completed webhook for CI pass/fail
- Implement auto-merge on CI pass (auto mode)
- Implement review notification flow (approval mode)
- Handle pull_request.closed webhook: comment on issue, update status
- Build retry logic: on CI fail → re-analyze with error context → push new commit
- Implement max retries (2) with escalation to human
- Build repo settings page (mode toggle, retry config, context hints)
- Build notification system (in-app + email via Resend)

*Deliverable: Full loop works: issue → triage → fix → PR → CI → merge/escalate → issue closed.*

### Phase 5: Dashboard, Billing & Polish

**Goal:** Complete UI, billing integration, onboarding, and production readiness.

- Build dashboard home: 3 most recent activities + repo list below
- Build expandable All Activity page
- Build organization and account settings pages
- Build Usage & Stats page (issues handled, success rate, avg time to fix)
- Integrate Stripe: hobby and Pro plans, checkout flow, customer portal
- Implement plan limits (repo count, fix count, feature gating for complexity)
- Build onboarding flow (install → select repos → pick modes → test run → go live)
- Error handling, rate limiting, loading/empty/error states throughout UI

*Deliverable: Shippable MVP ready for beta users.*

---

## 9. Post-MVP Roadmap

- Slack integration for notifications
- Support for additional models for issue fixing
- Multi-language and framework-specific agent improvements
- Codebase indexing with embeddings for better context retrieval on large repos
- Agent memory: learns from past fixes and patterns in the same repo
- Monorepo support
- Manual issue submission: paste a bug description directly, agent fixes it
- Analytics dashboard with deeper insights (fix quality scoring, time trends)
- Team collaboration features (assign reviewers, internal comments on fixes)

---

## 10. Open Questions

- Pricing validation: is $29–49/month the right range for the Pro plan? Sounds good.
- Model selection: Claude as primary, but should there be fallback options or model selection per repo? -> Sonnet for issue traige, codex gpt 5.3 for fixes
- Rate limiting: how to handle bursts of issues (e.g., a major release creates 50 bug reports at once)? -> Queue them, one at a time, only set to fixing if no oveload on ingest
- Security: how to handle repos with secrets, environment variables, or sensitive code? -> Their fault, we will not take their secrets, but still their fault
- Supported languages: should the MVP target specific languages/frameworks, or be language-agnostic from day one? -> Language agnostic
- Testing: should the agent also generate tests for its fixes? -> It should generate tests (if necessary) and run existing tests, I believe it make the most sense for the tests to live in a dedicated .gitfix/tests folder