"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getSubscriptionToken } from "@inngest/realtime";
import { inngest } from "~/lib/inngest/client";
import { db } from "~/server/db";
import { issues } from "~/server/db/tables/issue";
import { REALTIME_TOPICS } from "~/lib/inngest/constants";

export async function refreshRealtimeToken(issueId: string) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    throw new Error("Unauthorized");
  }

  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    with: { repository: true },
  });

  if (issue?.repository.organizationId !== orgId) {
    throw new Error("Not authorized to access this issue");
  }

  const token = await getSubscriptionToken(inngest, {
    channel: `issue:${issueId}`,
    topics: [...REALTIME_TOPICS],
  });

  return token;
}
