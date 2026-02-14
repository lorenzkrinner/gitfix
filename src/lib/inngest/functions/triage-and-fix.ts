import { eq } from "drizzle-orm";
import { inngest } from "~/lib/inngest/client";
import { db } from "~/server/db";
import { issues } from "~/server/db/tables/issue";
import { issueActivity } from "~/server/db/tables/issue-activity";
import type { ISSUE_ACTIVITY_TYPES } from "~/lib/constants/db";

type IssueActivityType = (typeof ISSUE_ACTIVITY_TYPES)[number];

type PublishFn = (msg: {
  channel: string;
  topic: string;
  data: Record<string, unknown>;
}) => Promise<Record<string, unknown>>;

type StepTools = {
  run: (id: string, fn: () => Promise<void>) => Promise<unknown>;
  sleep: (id: string, duration: string) => Promise<unknown>;
};

async function streamReasoning(
  issueId: string,
  stepId: string,
  text: string,
  publish: PublishFn,
  step: StepTools,
): Promise<void> {
  const streamId = stepId;
  const words = text.split(" ");

  await step.run(`db-${stepId}`, async () => {
    await db.insert(issueActivity).values({
      issueId,
      type: "reasoning",
      details: { content: text, streamId },
    });
  });

  let accumulated = "";
  for (let i = 0; i < words.length; i++) {
    accumulated += (i === 0 ? "" : " ") + words[i];

    await publish({
      channel: `issue:${issueId}`,
      topic: "reasoning",
      data: { type: "reasoning", content: accumulated, streamId },
    });
  }
}

async function emitActivity(
  issueId: string,
  stepId: string,
  topic: IssueActivityType,
  details: Record<string, unknown>,
  publish: PublishFn,
  step: StepTools,
): Promise<void> {
  await step.run(`db-${stepId}`, async () => {
    await db
      .insert(issueActivity)
      .values({ issueId, type: topic, details: { ...details, stepId } });
  });
  await publish({
    channel: `issue:${issueId}`,
    topic,
    data: { type: topic, stepId, ...details },
  });
}

async function emitToolActivity(
  issueId: string,
  stepId: string,
  topic: IssueActivityType,
  startDetails: Record<string, unknown>,
  fullDetails: Record<string, unknown>,
  publish: PublishFn,
  step: StepTools,
  sleepDuration = "1.5s",
): Promise<void> {
  await publish({
    channel: `issue:${issueId}`,
    topic,
    data: { type: topic, stepId, status: "started", ...startDetails },
  });

  await step.sleep(`tool-${stepId}`, sleepDuration);

  await step.run(`db-${stepId}`, async () => {
    await db.insert(issueActivity).values({
      issueId,
      type: topic,
      details: { stepId, status: "completed", ...fullDetails },
    });
  });
  await publish({
    channel: `issue:${issueId}`,
    topic,
    data: { type: topic, stepId, status: "completed", ...fullDetails },
  });
}

export const triageAndFix = inngest.createFunction(
  { id: "triage-and-fix" },
  { event: "issue/triage-and-fix" },
  async ({ event, step, publish }) => {
    const { issueId } = event.data as { issueId: string };
    const ch = `issue:${issueId}`;

    const triageResult = await step.run("triage", async () => {
      const issue = await db.query.issues.findFirst({
        where: eq(issues.id, issueId),
      });
      if (!issue) throw new Error(`Issue not found: ${issueId}`);

      const classification = "fixable" as const;
      const reasoning =
        "This is a clearly described UI bug with a specific reproduction path and " +
        "console output pointing to a stale closure in a React useEffect. The affected " +
        "files are identified (Dashboard.tsx, useAuth.ts). Classifying as fixable.";

      await db
        .update(issues)
        .set({
          triageResult: { classification, reasoning },
          status: "fixing",
        })
        .where(eq(issues.id, issueId));

      await db.insert(issueActivity).values({
        issueId,
        type: "triage",
        details: { classification, reasoning },
      });

      return { classification, reasoning };
    });

    await publish({
      channel: ch,
      topic: "triage",
      data: {
        type: "triage",
        classification: triageResult.classification,
        reasoning: triageResult.reasoning,
      },
    });

    if (triageResult.classification !== "fixable") {
      const doneSummary = `Issue classified as ${triageResult.classification as string}: ${triageResult.reasoning}`;
      await emitActivity(issueId, "done-unfixable", "done", { summary: doneSummary }, publish, step);
      return { status: triageResult.classification };
    }

    await step.sleep("pause-after-triage", "1.5s");

    await emitToolActivity(
      issueId,
      "clone-repo",
      "repo_clone",
      { repository: "owner/repo" },
      { repository: "owner/repo", path: "/tmp/gitfix/owner-repo" },
      publish,
      step,
      "2s",
    );

    await step.sleep("pause-after-clone", "1s");

    await streamReasoning(
      issueId,
      "reasoning-initial",
      "The issue describes a race condition where the dashboard displays stale user data " +
        "after switching accounts. The console output shows the useEffect closure captures " +
        "an old userId. I need to examine the Dashboard component and the useAuth hook to " +
        "understand the data flow. Let me start by reading the main component.",
      publish,
      step,
    );

    await step.sleep("pause-1", "1s");

    await emitToolActivity(
      issueId,
      "read-dashboard",
      "file_read",
      { filePath: "src/components/Dashboard.tsx" },
      { filePath: "src/components/Dashboard.tsx" },
      publish,
      step,
      "1.5s",
    );

    await step.sleep("pause-2", "0.5s");

    await emitToolActivity(
      issueId,
      "read-useauth",
      "file_read",
      { filePath: "src/hooks/useAuth.ts" },
      { filePath: "src/hooks/useAuth.ts" },
      publish,
      step,
      "1.5s",
    );

    await step.sleep("pause-3", "1s");

    await streamReasoning(
      issueId,
      "reasoning-analysis",
      "I can see the problem now. In Dashboard.tsx the useEffect calls " +
        "fetchUserStats(userId) but the dependency array only includes [session]. " +
        "When the account switches, session updates first but the userId inside the " +
        "closure is stale from the previous render. There's also no AbortController " +
        "to cancel in-flight requests when the user changes. I need to check the " +
        "fetchUserStats function to see if it supports cancellation.",
      publish,
      step,
    );

    await step.sleep("pause-4", "1.2s");

    await emitToolActivity(
      issueId,
      "read-api-client",
      "file_read",
      { filePath: "src/lib/api/client.ts" },
      { filePath: "src/lib/api/client.ts" },
      publish,
      step,
      "1s",
    );

    await step.sleep("pause-5", "0.5s");

    await emitToolActivity(
      issueId,
      "read-stats-api",
      "file_read",
      { filePath: "src/lib/api/stats.ts" },
      { filePath: "src/lib/api/stats.ts" },
      publish,
      step,
      "1s",
    );

    await step.sleep("pause-6", "1s");

    await emitToolActivity(
      issueId,
      "web-search-1",
      "web_search",
      { query: "React useEffect stale closure race condition AbortController cleanup" },
      {
        query: "React useEffect stale closure race condition AbortController cleanup",
        snippet:
          "When dealing with async operations in useEffect, always return a cleanup " +
          "function that aborts pending requests. Use an AbortController and pass its " +
          "signal to fetch(). Include all reactive values in the dependency array to " +
          "avoid stale closures. — react.dev/reference/react/useEffect",
      },
      publish,
      step,
      "2s",
    );

    await step.sleep("pause-7", "1s");

    await streamReasoning(
      issueId,
      "reasoning-plan",
      "Based on the code and the React docs, the fix requires two changes: " +
        "First, add userId to the useEffect dependency array so the effect re-runs " +
        "when the user changes. Second, add an AbortController cleanup that cancels " +
        "stale requests when userId changes or the component unmounts. The " +
        "fetchUserStats function in stats.ts already accepts an optional signal " +
        "parameter, so I just need to wire it up. Let me apply the fix.",
      publish,
      step,
    );

    await step.sleep("pause-8", "1s");

    const dashboardDiff = `@@ -23,14 +23,22 @@ export function Dashboard() {
   const { userId, session } = useAuth();
   const [stats, setStats] = useState<UserStats | null>(null);
+  const [loading, setLoading] = useState(true);

   useEffect(() => {
-    fetchUserStats(userId).then((data) => {
-      setStats(data);
-    });
-  }, [session]);
+    const controller = new AbortController();
+    setLoading(true);
+
+    fetchUserStats(userId, { signal: controller.signal })
+      .then((data) => {
+        setStats(data);
+        setLoading(false);
+      })
+      .catch((err) => {
+        if (err.name !== "AbortError") throw err;
+      });
+
+    return () => controller.abort();
+  }, [userId]);`;

    await emitToolActivity(
      issueId,
      "change-dashboard",
      "file_change",
      { filePath: "src/components/Dashboard.tsx" },
      { filePath: "src/components/Dashboard.tsx", diff: dashboardDiff },
      publish,
      step,
      "2s",
    );

    await step.sleep("pause-9", "1s");

    await emitToolActivity(
      issueId,
      "run-typecheck-1",
      "run_command",
      { command: "npx tsc --noEmit" },
      {
        command: "npx tsc --noEmit",
        output:
          "src/components/Dashboard.tsx(38,9): error TS2554: Expected 1 arguments, but got 2.\n" +
          "  fetchUserStats(userId, { signal: controller.signal })\n" +
          "                        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n" +
          "Found 1 error.",
        exitCode: 1,
      },
      publish,
      step,
      "2s",
    );

    await step.sleep("pause-10", "1s");

    await emitActivity(
      issueId,
      "error-typecheck",
      "error",
      {
        message:
          "TypeScript error: fetchUserStats() does not accept a second argument yet. " +
          "I need to update the function signature in stats.ts to accept an options " +
          "object with an AbortSignal.",
      },
      publish,
      step,
    );

    await step.sleep("pause-11", "1s");

    await streamReasoning(
      issueId,
      "reasoning-error-recovery",
      "The typecheck failed because fetchUserStats only accepts a userId parameter. " +
        "I assumed it already supported a signal option but it doesn't. I need to update " +
        "the function in src/lib/api/stats.ts to accept an optional options object " +
        "containing the AbortSignal, and pass it through to the underlying fetch call.",
      publish,
      step,
    );

    await step.sleep("pause-12", "1s");

    const statsDiff = `@@ -5,8 +5,12 @@ import { apiClient } from "./client";

-export async function fetchUserStats(userId: string) {
-  const response = await apiClient.get(\`/api/users/\${userId}/stats\`);
+interface FetchOptions {
+  signal?: AbortSignal;
+}
+
+export async function fetchUserStats(userId: string, options?: FetchOptions) {
+  const response = await apiClient.get(\`/api/users/\${userId}/stats\`, {
+    signal: options?.signal,
+  });
   return response.data as UserStats;
 }`;

    await emitToolActivity(
      issueId,
      "change-stats",
      "file_change",
      { filePath: "src/lib/api/stats.ts" },
      { filePath: "src/lib/api/stats.ts", diff: statsDiff },
      publish,
      step,
      "2s",
    );

    await step.sleep("pause-13", "1s");

    await emitToolActivity(
      issueId,
      "run-typecheck-2",
      "run_command",
      { command: "npx tsc --noEmit" },
      {
        command: "npx tsc --noEmit",
        output: "No errors found.",
        exitCode: 0,
      },
      publish,
      step,
      "2s",
    );

    await step.sleep("pause-14", "1s");

    await emitToolActivity(
      issueId,
      "run-tests",
      "run_command",
      { command: "pnpm test -- --reporter=verbose" },
      {
        command: "pnpm test -- --reporter=verbose",
        output:
          " PASS  src/components/__tests__/Dashboard.test.tsx\n" +
          "  Dashboard\n" +
          "    ✓ renders current user stats (42ms)\n" +
          "    ✓ updates stats when user changes (118ms)\n" +
          "    ✓ aborts pending request on user switch (95ms)\n" +
          "    ✓ does not flash stale data during transition (87ms)\n" +
          "\n" +
          " PASS  src/lib/api/__tests__/stats.test.ts\n" +
          "  fetchUserStats\n" +
          "    ✓ fetches stats for given user (15ms)\n" +
          "    ✓ passes abort signal to fetch (12ms)\n" +
          "    ✓ rejects with AbortError when aborted (8ms)\n" +
          "\n" +
          "Test Suites: 2 passed, 2 total\n" +
          "Tests:       7 passed, 7 total\n" +
          "Time:        1.847s",
        exitCode: 0,
      },
      publish,
      step,
      "2.5s",
    );

    await step.sleep("pause-15", "1s");

    await streamReasoning(
      issueId,
      "reasoning-final",
      "All type checks and tests pass. The fix addresses both root causes: the stale " +
        "closure (by adding userId to the dependency array instead of session) and the " +
        "race condition (by adding AbortController cleanup so in-flight requests are " +
        "cancelled when the user changes). The changes are minimal and backwards-compatible.",
      publish,
      step,
    );

    await step.sleep("pause-16", "0.5s");

    await emitToolActivity(
      issueId,
      "create-pr",
      "pr_created",
      { title: "fix: resolve stale closure race condition in Dashboard" },
      {
        title: "fix: resolve stale closure race condition in Dashboard",
        url: "https://github.com/owner/repo/pull/42",
        number: 42,
      },
      publish,
      step,
      "2s",
    );

    await step.sleep("pause-17", "1.5s");

    await emitToolActivity(
      issueId,
      "ci-check",
      "ci_status",
      { prNumber: 42 },
      { prNumber: 42, status: "passed", checks: 3, passed: 3, failed: 0 },
      publish,
      step,
      "3s",
    );

    await step.sleep("pause-18", "1s");

    const fixSummary =
      "Fixed the stale closure and race condition in the Dashboard component. " +
      "The useEffect now correctly depends on userId (not session) and uses an " +
      "AbortController to cancel in-flight requests when the user switches accounts. " +
      "Updated fetchUserStats in stats.ts to accept and forward an AbortSignal.";

    const issueComment = `## Automated Fix Applied

**Root cause:** The \`useEffect\` in \`Dashboard.tsx\` had two problems:
1. **Stale closure** — the dependency array contained \`[session]\` instead of \`[userId]\`, so the effect captured an outdated \`userId\` from a previous render.
2. **Missing cleanup** — there was no \`AbortController\` to cancel pending API calls when the user changed, causing stale data to overwrite fresh data when the old request resolved after the new one.

**Changes made:**

- **\`src/components/Dashboard.tsx\`**
  - Changed the useEffect dependency array from \`[session]\` to \`[userId]\`
  - Added \`AbortController\` that cancels pending requests on cleanup
  - Added loading state to prevent stale data flash during transitions

- **\`src/lib/api/stats.ts\`**
  - Extended \`fetchUserStats()\` to accept an optional \`{ signal?: AbortSignal }\` options object
  - Passes the signal through to the underlying API client

**Tests:** All 7 tests passing, including new tests for abort behavior and account switching.`;

    await emitActivity(
      issueId,
      "comment-drafted",
      "comment_drafted",
      { issueComment },
      publish,
      step,
    );

    await step.run("finalize-issue", async () => {
      await db
        .update(issues)
        .set({
          status: "awaiting_review",
          fixSummary,
          issueComment,
        })
        .where(eq(issues.id, issueId));

      await db.insert(issueActivity).values({
        issueId,
        type: "done",
        details: { summary: fixSummary },
      });
    });

    await publish({
      channel: ch,
      topic: "done",
      data: { type: "done", summary: fixSummary },
    });

    return { status: "awaiting_review" };
  },
);