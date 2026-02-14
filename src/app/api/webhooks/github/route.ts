import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db";
import { repositories } from "~/server/db/tables/repository";
import { issues } from "~/server/db/tables/issue";
import { inngest } from "~/lib/inngest/client";

type GithubEvent =
  | "issues"
  | "pull_request"
  | "check_suite"
  | "ping"
  | (string & {});

const SUPPORTED_EVENTS: GithubEvent[] = ["issues", "pull_request", "check_suite", "ping"];

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

export async function POST(request: Request) {
  const deliveryId = request.headers.get("x-github-delivery") ?? "unknown";
  const eventType = (request.headers.get("x-github-event") ?? "unknown") as GithubEvent;
  const signature = request.headers.get("x-hub-signature-256");

  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature)) {
    console.warn("[github-webhook] invalid signature", { deliveryId, eventType });
    return respond(401, { status: "error", reason: "invalid signature" });
  }

  if (!SUPPORTED_EVENTS.includes(eventType)) {
    console.info("[github-webhook] ignoring unsupported event", { deliveryId, eventType });
    return respond(202, { status: "ignored", eventType });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error("[github-webhook] failed to parse payload", { deliveryId, eventType, error });
    return respond(400, { status: "error", reason: "invalid JSON payload" });
  }

  console.info("[github-webhook] event received", { deliveryId, eventType });

  try {
    switch (eventType) {
      case "issues":
        await handleIssuesEvent(payload);
        break;
      case "pull_request":
        await handlePullRequestEvent(payload);
        break;
      case "check_suite":
        await handleCheckSuiteEvent(payload);
        break;
      case "ping":
        // GitHub sends a ping event to validate the webhook URL.
        break;
      default:
        console.warn("[github-webhook] no handler", { deliveryId, eventType });
    }
  } catch (error) {
    console.error("[github-webhook] handler error", { deliveryId, eventType, error });
    return respond(500, { status: "error", reason: "handler failure" });
  }

  return respond(200, { status: "ok", deliveryId });
}

function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }

  const computed = `sha256=${crypto
    .createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex")}`;

  const signatureBuffer = Buffer.from(signature, "utf-8");
  const computedBuffer = Buffer.from(computed, "utf-8");

  if (signatureBuffer.length !== computedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
}

async function handleIssuesEvent(payload: unknown) {
  const issuePayload = payload as {
    action?: string;
    issue?: {
      id?: number;
      number?: number;
      title?: string | null;
      body?: string | null;
      html_url?: string;
    };
    repository?: { full_name?: string; id?: number };
    installation?: { id?: number };
  };

  const action = issuePayload.action ?? "unknown";
  console.info("[github-webhook] issues event", {
    action,
    number: issuePayload.issue?.number,
    repo: issuePayload.repository?.full_name,
  });

  switch (action) {
    case "opened": {
      const ghIssue = issuePayload.issue;
      const ghRepo = issuePayload.repository;

      if (!ghIssue?.id || !ghIssue.number || !ghIssue.title || !ghIssue.html_url || !ghRepo?.id) {
        console.warn("[github-webhook] incomplete issue payload, skipping");
        return;
      }

      const repo = await db.query.repositories.findFirst({
        where: eq(repositories.githubRepoId, String(ghRepo.id)),
      });

      if (!repo?.isActive) {
        console.info("[github-webhook] repo not connected or inactive, skipping", {
          githubRepoId: ghRepo.id,
        });
        return;
      }

      const [issue] = await db
        .insert(issues)
        .values({
          repositoryId: repo.id,
          githubIssueNumber: ghIssue.number,
          githubIssueId: String(ghIssue.id),
          title: ghIssue.title,
          body: ghIssue.body ?? null,
          url: ghIssue.html_url,
          status: "analyzing",
          startedAt: new Date(),
        })
        .returning();

      if (!issue) {
        console.error("[github-webhook] failed to insert issue");
        return;
      }

      await inngest.send({
        name: "issue/triage-and-fix",
        data: { issueId: issue.id },
      });

      console.info("[github-webhook] issue created and triage enqueued", {
        issueId: issue.id,
        githubIssueNumber: ghIssue.number,
      });
      break;
    }
    case "labeled":
      break;
    default:
      console.debug("[github-webhook] issues action not handled", { action });
  }
}

async function handlePullRequestEvent(payload: unknown) {
  const prPayload = payload as {
    action?: string;
    pull_request?: { number?: number; merged?: boolean; head?: { ref?: string } };
    repository?: { full_name?: string };
  };

  console.info("[github-webhook] pull_request event", {
    action: prPayload.action,
    number: prPayload.pull_request?.number,
    repo: prPayload.repository?.full_name,
  });

  // Pseudo code placeholder: update linked issue + audit trail.
  // if (prPayload.action === "closed" && prPayload.pull_request?.merged) {
  //   await db.update(issues).set({ status: "resolved" }).where(eq(...));
  //   await inngest.send("issue.resolved", { ... });
  // }
}

async function handleCheckSuiteEvent(payload: unknown) {
  const checkPayload = payload as {
    check_suite?: { status?: string; conclusion?: string; head_branch?: string };
    repository?: { full_name?: string };
  };

  console.info("[github-webhook] check_suite event", {
    status: checkPayload.check_suite?.status,
    conclusion: checkPayload.check_suite?.conclusion,
    branch: checkPayload.check_suite?.head_branch,
    repo: checkPayload.repository?.full_name,
  });

  // Pseudo code placeholder: dispatch CI results to retry/merge workflow.
  // await inngest.send("pr.ci-completed", {
  //   repo: checkPayload.repository?.full_name,
  //   branch: checkPayload.check_suite?.head_branch,
  //   conclusion: checkPayload.check_suite?.conclusion,
  // });
}
