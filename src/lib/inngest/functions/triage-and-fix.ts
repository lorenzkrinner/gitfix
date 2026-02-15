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

async function streamText(
  issueId: string,
  stepId: string,
  topic: IssueActivityType,
  content: string,
  publish: PublishFn,
  step: StepTools,
  extras: Record<string, unknown> = {},
  thinkDuration?: string,
): Promise<void> {
  const streamId = stepId;
  const splitByLines = topic === "file_change";
  const chunks = splitByLines ? content.split("\n") : content.split(" ");
  const contentKey = splitByLines ? "diff" : "content";

  await publish({
    channel: `issue:${issueId}`,
    topic,
    data: { type: topic, [contentKey]: "", streamId, status: "started", ...extras },
  });

  if (thinkDuration) {
    await step.sleep(`think-${stepId}`, thinkDuration);
  }

  let accumulated = "";
  let i = 0;
  while (i < chunks.length) {
    const separator = splitByLines ? "\n" : " ";
    accumulated += (i === 0 ? "" : separator) + chunks[i];

    await publish({
      channel: `issue:${issueId}`,
      topic,
      data: { type: topic, [contentKey]: accumulated, streamId, status: "started", ...extras },
    });

    i++;
  }

  const completedExtras: Record<string, unknown> = { ...extras };
  if (thinkDuration) {
    completedExtras.durationSeconds = Math.max(1, Math.round(parseFloat(thinkDuration)));
  }

  await step.run(`db-${stepId}`, async () => {
    await db.insert(issueActivity).values({
      issueId,
      type: topic,
      details: { [contentKey]: content, streamId, status: "completed", ...completedExtras },
    });
  });

  await publish({
    channel: `issue:${issueId}`,
    topic,
    data: { type: topic, [contentKey]: content, streamId, status: "completed", ...completedExtras },
  });
}

async function emitActivity(
  issueId: string,
  stepId: string,
  topic: IssueActivityType,
  details: Record<string, unknown>,
  publish: PublishFn,
  step: StepTools,
  sleepDuration?: string,
): Promise<void> {
  if (sleepDuration) {
    await publish({
      channel: `issue:${issueId}`,
      topic,
      data: { type: topic, stepId, status: "started", ...details },
    });

    await step.sleep(`sleep-${stepId}`, sleepDuration);
  }

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

    await publish({
      channel: ch,
      topic: "triage",
      data: { type: "triage", status: "started" },
    });

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

    await step.sleep("pause-after-triage", "0.5s");

    // Clone the repository — slower operation (4s)
    await emitToolActivity(
      issueId,
      "clone-repo",
      "repo_clone",
      { repository: "owner/repo" },
      { repository: "owner/repo", path: "/tmp/lorenzkrinner/gitfix-issues" },
      publish,
      step,
      "4s",
    );

    await step.sleep("pause-after-clone", "1s");

    await streamText(
      issueId,
      "reasoning-initial",
      "reasoning",
      "The issue describes a race condition where the dashboard displays stale user data " +
        "after switching accounts. The console output shows the useEffect closure captures " +
        "an old userId. I need to examine the Dashboard component and the useAuth hook to " +
        "understand the data flow. The reproduction steps mention that switching between " +
        "two accounts rapidly causes the old account's stats to flash briefly before being " +
        "replaced. This is a classic symptom of an uncontrolled async operation inside a " +
        "React effect — the fetch for the previous user resolves after the fetch for the " +
        "new user and overwrites the state. I should also check whether the API client " +
        "supports request cancellation via AbortSignal, because that will determine " +
        "the shape of the fix. Let me start by reading the main component.",
      publish,
      step,
      {},
      "0.5s",
    );

    await step.sleep("pause-1", "0.5s");

    // File reads — quick (0.4s)
    await emitToolActivity(
      issueId,
      "read-dashboard",
      "file_read",
      { filePath: "src/components/Dashboard.tsx" },
      { filePath: "src/components/Dashboard.tsx" },
      publish,
      step,
      "0.4s",
    );

    await step.sleep("pause-2", "0.3s");

    await emitToolActivity(
      issueId,
      "read-useauth",
      "file_read",
      { filePath: "src/hooks/useAuth.ts" },
      { filePath: "src/hooks/useAuth.ts" },
      publish,
      step,
      "0.4s",
    );

    await step.sleep("pause-3", "0.5s");

    await streamText(
      issueId,
      "reasoning-analysis",
      "reasoning",
      "I can see the problem now. In Dashboard.tsx the useEffect on line 27 calls " +
        "fetchUserStats(userId) but the dependency array only includes [session]. " +
        "When the account switches, session updates first but the userId inside the " +
        "closure is stale from the previous render. There's also no AbortController " +
        "to cancel in-flight requests when the user changes. Looking at the " +
        "component lifecycle: session changes trigger a re-render, the new render " +
        "produces a new userId, but the old effect closure still holds the previous " +
        "userId. The effect doesn't re-run because its dependency is session (an " +
        "object reference that may or may not have changed by this point). Meanwhile " +
        "the in-flight request for the old userId can resolve at any time — if it " +
        "resolves after a newer request, it silently overwrites the correct data. " +
        "I need to check the fetchUserStats function to see if it already supports " +
        "cancellation via an AbortSignal parameter.",
      publish,
      step,
      {},
      "1s",
    );

    await step.sleep("pause-4", "0.5s");

    await emitToolActivity(
      issueId,
      "read-api-client",
      "file_read",
      { filePath: "src/lib/api/client.ts" },
      { filePath: "src/lib/api/client.ts" },
      publish,
      step,
      "0.3s",
    );

    await step.sleep("pause-5", "0.3s");

    await emitToolActivity(
      issueId,
      "read-stats-api",
      "file_read",
      { filePath: "src/lib/api/stats.ts" },
      { filePath: "src/lib/api/stats.ts" },
      publish,
      step,
      "0.3s",
    );

    await step.sleep("pause-6", "0.5s");

    // Web search — streamed results
    const webSearchResults =
      "### React useEffect cleanup patterns\n\n" +
      "When dealing with async operations in `useEffect`, always return a cleanup " +
      "function that aborts pending requests. Use an `AbortController` and pass its " +
      "signal to `fetch()`. Include all reactive values in the dependency array to " +
      "avoid stale closures.\n\n" +
      "**Key takeaways:**\n" +
      "- Create an `AbortController` at the start of each effect invocation\n" +
      "- Pass `controller.signal` to every async call (fetch, axios, etc.)\n" +
      "- Return `() => controller.abort()` as the cleanup function\n" +
      "- Include all values read inside the effect in the dependency array\n\n" +
      "*Source: [react.dev/reference/react/useEffect](https://react.dev/reference/react/useEffect)*";

    await streamText(
      issueId,
      "web-search-1",
      "web_search",
      webSearchResults,
      publish,
      step,
      { query: "React useEffect stale closure race condition AbortController cleanup" },
      "2s",
    );

    await step.sleep("pause-7", "0.5s");

    await streamText(
      issueId,
      "reasoning-plan",
      "reasoning",
      "Based on the code and the React docs, the fix requires two changes. " +
        "First, add userId to the useEffect dependency array so the effect re-runs " +
        "when the user changes — this eliminates the stale closure entirely because " +
        "each effect invocation will capture the current userId. Second, add an " +
        "AbortController cleanup function that cancels in-flight requests whenever " +
        "userId changes or the component unmounts. This prevents the race condition " +
        "where an old response overwrites fresh data. The fetchUserStats function in " +
        "stats.ts already accepts an optional signal parameter, so I just need to " +
        "create the controller in the effect, pass controller.signal to the fetch, " +
        "and return a cleanup that calls controller.abort(). I'll also add a " +
        "loading state so the UI doesn't flash stale data during the transition " +
        "between users. Let me apply the fix now.",
      publish,
      step,
      {},
      "0.5s",
    );

    await step.sleep("pause-8", "0.5s");

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

    await streamText(
      issueId,
      "change-dashboard",
      "file_change",
      dashboardDiff,
      publish,
      step,
      { filePath: "src/components/Dashboard.tsx" },
    );

    await step.sleep("pause-9", "0.5s");

    // Typecheck — moderate (3s)
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
      "3s",
    );

    await step.sleep("pause-10", "0.5s");

    await streamText(
      issueId,
      "error-typecheck",
      "text_generated",
      "TypeScript error: fetchUserStats() does not accept a second argument yet. " +
      "I need to update the function signature in stats.ts to accept an options " +
      "object with an AbortSignal.",
      publish,
      step,
      {},
    );

    await step.sleep("pause-11", "0.5s");

    await streamText(
      issueId,
      "reasoning-error-recovery",
      "reasoning",
      "The typecheck failed because fetchUserStats only accepts a single userId " +
        "parameter — I incorrectly assumed it already had a signal option. Looking " +
        "at the error on line 38 of Dashboard.tsx, TypeScript reports 'Expected 1 " +
        "arguments, but got 2' for the call fetchUserStats(userId, { signal: " +
        "controller.signal }). I need to update the function signature in " +
        "src/lib/api/stats.ts to accept an optional second parameter — an options " +
        "object with an AbortSignal field. Then I need to forward that signal to " +
        "the underlying apiClient.get() call. The apiClient is built on fetch, so " +
        "it should already support passing a signal in the request config. Let me " +
        "verify the apiClient interface and make the change.",
      publish,
      step,
      {},
      "2s",
    );

    await step.sleep("pause-12", "0.5s");

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

    await streamText(
      issueId,
      "change-stats",
      "file_change",
      statsDiff,
      publish,
      step,
      { filePath: "src/lib/api/stats.ts" },
    );

    await step.sleep("pause-13", "0.5s");

    // Typecheck — moderate (3s)
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
      "3s",
    );

    await step.sleep("pause-14", "0.5s");

    // Test suite — longer (4s)
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
      "4s",
    );

    await step.sleep("pause-15", "0.5s");

    await streamText(
      issueId,
      "reasoning-final",
      "reasoning",
      "All type checks and tests pass. The fix addresses both root causes: the stale " +
        "closure (by changing the dependency array from [session] to [userId] so the " +
        "effect always captures the current user) and the race condition (by creating " +
        "an AbortController in the effect and returning a cleanup function that calls " +
        "controller.abort(), which cancels any in-flight request when the userId " +
        "changes or the component unmounts). The stats.ts change is additive — the " +
        "new options parameter is optional, so all existing call sites continue to " +
        "work without modification. The loading state prevents the brief flash of " +
        "stale data that the reporter described. All 7 tests pass including the new " +
        "ones that verify abort behavior and account switching. The changes are " +
        "minimal, backwards-compatible, and directly address the reported symptoms.",
      publish,
      step,
      {},
      "3s",
    );

    await step.sleep("pause-16", "0.5s");

    // Create PR — moderate (2.5s)
    const prUrl = "https://github.com/owner/repo/pull/42";

    await emitToolActivity(
      issueId,
      "create-pr",
      "pr_created",
      { title: "fix: resolve stale closure race condition in Dashboard" },
      {
        title: "fix: resolve stale closure race condition in Dashboard",
        url: prUrl,
        number: 42,
      },
      publish,
      step,
      "2.5s",
    );

    await step.sleep("pause-17", "1s");

    // CI checks — longer (5s)
    await emitToolActivity(
      issueId,
      "ci-check",
      "ci_status",
      { prNumber: 42 },
      { prNumber: 42, status: "passed", checks: 3, passed: 3, failed: 0 },
      publish,
      step,
      "5s",
    );

    await step.sleep("pause-18", "0.5s");

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
      { content: issueComment, prUrl },
      publish,
      step,
      "5s",
    );

    await step.sleep("pause-19", "0.5s");

    await emitActivity(
      issueId,
      "fix-summary",
      "fix_summary",
      { content: fixSummary },
      publish,
      step,
      "4s",
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
    });

    await emitActivity(issueId, "done", "done", { summary: fixSummary }, publish, step);

    return { status: "awaiting_review" };
  },
);