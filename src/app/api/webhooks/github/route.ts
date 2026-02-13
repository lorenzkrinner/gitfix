import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { env } from "~/env";

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
    issue?: { id?: number; number?: number; title?: string | null; html_url?: string };
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
    case "opened":
      // Pseudo code placeholder: store issue + enqueue triage workflow.
      // await db.insert(issues).values(...);
      // inngest.send("issue.triage", { issueId, github: issuePayload });
      break;
    case "labeled":
      // TODO: react to ai:* labels when business rules are ready.
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
