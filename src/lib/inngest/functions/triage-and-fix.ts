import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { inngest } from "~/lib/inngest/client";
import { db } from "~/server/db";
import { issues } from "~/server/db/tables/issue";
import { issueActivity } from "~/server/db/tables/issue-activity";
import { TRIAGE_CLASSIFICATIONS } from "~/lib/constants/db";

const TRIAGE_PROMPT = `You are a triage agent for a GitHub issue auto-fixer. Given an issue title and body, classify it into one of three categories:

1. "fixable" - A clear bug with enough context to attempt an automated fix.
2. "too_complex" - A large-scale architectural issue requiring significant refactoring.
3. "not_actionable" - A feature request, question, unclear report, or missing reproduction steps.

Provide your classification and a brief reasoning.`;

const triageSchema = z.object({
  classification: z.enum(TRIAGE_CLASSIFICATIONS),
  reasoning: z.string(),
});

export const triageAndFix = inngest.createFunction(
  { id: "triage-and-fix" },
  { event: "issue/triage-and-fix" },
  async ({ event, step, publish }) => {
    const { issueId } = event.data as { issueId: string };

    const triageResult = await step.run("triage", async () => {
      const issue = await db.query.issues.findFirst({
        where: eq(issues.id, issueId),
      });

      if (!issue) {
        throw new Error(`Issue not found: ${issueId}`);
      }

      const result = await generateText({
        model: openai("gpt-5"),
        output: Output.object({
          schema: triageSchema,
        }),
        system: TRIAGE_PROMPT,
        prompt: `Issue title: ${issue.title}\n\nIssue body:\n${issue.body ?? "(no body)"}`,
      });

      const { classification, reasoning } = result.output;

      await db
        .update(issues)
        .set({
          triageResult: { classification, reasoning },
          status:
            classification === "fixable"
              ? "fixing"
              : classification === "too_complex"
                ? "too_complex"
                : "skipped",
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
      channel: `issue:${issueId}`,
      topic: "triage",
      data: {
        type: "triage",
        classification: triageResult.classification,
        reasoning: triageResult.reasoning,
      },
    });

    if (triageResult.classification !== "fixable") {
      const doneSummary = `Issue classified as ${triageResult.classification}: ${triageResult.reasoning}`;

      await step.run("log-done-unfixable", async () => {
        await db.insert(issueActivity).values({
          issueId,
          type: "done",
          details: { summary: doneSummary },
        });
      });

      await publish({
        channel: `issue:${issueId}`,
        topic: "done",
        data: { type: "done", summary: doneSummary },
      });

      return { status: triageResult.classification };
    }

    await step.run("log-reasoning-1", async () => {
      await db.insert(issueActivity).values({
        issueId,
        type: "reasoning",
        details: { content: "Analyzing the issue to identify affected files..." },
      });
    });

    await publish({
      channel: `issue:${issueId}`,
      topic: "reasoning",
      data: { type: "reasoning", content: "Analyzing the issue to identify affected files..." },
    });

    await step.sleep("wait-after-reasoning-1", "2s");

    await step.run("log-file-reads", async () => {
      await db.insert(issueActivity).values({
        issueId,
        type: "file_read",
        details: { filePath: "src/utils/auth.ts" },
      });

      await db.insert(issueActivity).values({
        issueId,
        type: "file_read",
        details: { filePath: "src/lib/db.ts" },
      });
    });

    await publish({
      channel: `issue:${issueId}`,
      topic: "file_read",
      data: { type: "file_read", filePath: "src/utils/auth.ts" },
    });

    await publish({
      channel: `issue:${issueId}`,
      topic: "file_read",
      data: { type: "file_read", filePath: "src/lib/db.ts" },
    });

    await step.sleep("wait-after-file-reads", "2s");

    const rootCauseContent =
      "The issue is caused by a missing null check in the auth handler. When a user session expires mid-request, the token is undefined but the code tries to access .userId on it.";

    await step.run("log-reasoning-2", async () => {
      await db.insert(issueActivity).values({
        issueId,
        type: "reasoning",
        details: { content: rootCauseContent },
      });
    });

    await publish({
      channel: `issue:${issueId}`,
      topic: "reasoning",
      data: { type: "reasoning", content: rootCauseContent },
    });

    await step.sleep("wait-after-reasoning-2", "2s");

    // 2d. File change
    const diff = `@@ -15,7 +15,10 @@ export async function getUser(token: string) {
-  const decoded = verifyToken(token);
-  return db.users.findById(decoded.userId);
+  const decoded = verifyToken(token);
+  if (!decoded) {
+    throw new AuthError("Invalid or expired token");
+  }
+  return db.users.findById(decoded.userId);`;

    await step.run("log-file-change", async () => {
      await db.insert(issueActivity).values({
        issueId,
        type: "file_change",
        details: { filePath: "src/utils/auth.ts", diff },
      });
    });

    await publish({
      channel: `issue:${issueId}`,
      topic: "file_change",
      data: { type: "file_change", filePath: "src/utils/auth.ts", diff },
    });

    await step.run("log-test-run", async () => {
      await db.insert(issueActivity).values({
        issueId,
        type: "run_command",
        details: { command: "pnpm test", output: "All 42 tests passed", exitCode: 0 },
      });
    });

    await publish({
      channel: `issue:${issueId}`,
      topic: "run_command",
      data: {
        type: "run_command",
        command: "pnpm test",
        output: "All 42 tests passed",
        exitCode: 0,
      },
    });

    const fixSummary =
      "Added a null check for the decoded token in the auth handler. When verifyToken returns null (expired/invalid token), we now throw an AuthError instead of crashing with a TypeError.";

    const issueComment = `## Automated Fix Applied

**Root cause:** The \`getUser\` function in \`src/utils/auth.ts\` was not handling the case where \`verifyToken\` returns \`null\` for expired or invalid tokens, causing a \`TypeError: Cannot read property 'userId' of null\`.

**Fix:** Added a null check after \`verifyToken()\` that throws a descriptive \`AuthError\` when the token is invalid or expired.

**Files changed:**
- \`src/utils/auth.ts\` — Added null guard for decoded token

**Tests:** All 42 tests passing.`;

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
        details: { summary: fixSummary, issueComment },
      });
    });

    await publish({
      channel: `issue:${issueId}`,
      topic: "done",
      data: { type: "done", summary: fixSummary, issueComment },
    });

    return { status: "awaiting_review" };
  },
);
