import { spawn } from "node:child_process";

const repo = "lorenzkrinner/gitfix-testing";
const title =
  "Bug: Dashboard shows wrong user's data after switching accounts";
const body = `**Describe the bug**

When switching between accounts quickly on the dashboard, the stats and activity feed sometimes show the **previous user's data** instead of the currently logged-in user. This is intermittent — it seems to happen when the account switch and the data fetch overlap.

**To reproduce**

1. Log in as User A. Navigate to the dashboard and wait for it to load.
2. Use the account switcher to switch to User B.
3. Observe the dashboard — about 1 in 3 times, User A's stats (total projects, recent activity) still appear even though the header shows User B.
4. Navigating away and back to the dashboard fixes it.

**Expected behavior**

The dashboard should always show the currently authenticated user's data immediately after switching accounts.

**Stack trace / error**

No error is thrown — the wrong data is silently displayed. However, adding a console.log inside the useEffect in \`src/components/Dashboard.tsx\` shows that the \`userId\` captured in the closure is stale:

\`\`\`
[Dashboard] useEffect fired: userId=user_abc123   // <-- stale, should be user_xyz789
[Dashboard] fetchUserStats called with: user_abc123
\`\`\`

**Relevant code**

The issue seems to be in \`src/components/Dashboard.tsx\` around the \`useEffect\` that fetches user stats. The effect depends on \`session\` but doesn't properly include \`userId\` in its dependency array, and there's no cleanup/abort when the user changes.

The \`useAuth\` hook in \`src/hooks/useAuth.ts\` provides the current user and session info.

**Environment**

- Next.js 14.2, React 18
- Node 20
- Happens in both Chrome and Firefox
- Only in development and production, not in tests (tests mock the auth)`;

const args = [
  "issue",
  "create",
  "--repo",
  repo,
  "--title",
  title,
  "--body",
  body,
];

const proc = spawn("gh", args, { stdio: "inherit" });
proc.on("exit", (code) => process.exit(code ?? 0));
