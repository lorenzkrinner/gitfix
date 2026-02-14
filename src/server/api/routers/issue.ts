import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { issues } from "~/server/db/tables/issue";
import { issueActivity } from "~/server/db/tables/issue-activity";
import type { IssueStatus } from "~/lib/types/issue";
import { repositories } from "~/server/db/tables/repository";
import { getInstallationOctokit } from "~/lib/github";

export const issueRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string().uuid(),
        status: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const repo = await ctx.db.query.repositories.findFirst({
        where: and(
          eq(repositories.id, input.repositoryId),
          eq(repositories.organizationId, ctx.orgId),
        ),
      });

      if (!repo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      const conditions = [eq(issues.repositoryId, input.repositoryId)];
      if (input.status) {
        conditions.push(eq(issues.status, input.status as IssueStatus));
      }

      return ctx.db.query.issues.findMany({
        where: and(...conditions),
        orderBy: [desc(issues.createdAt)],
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const issue = await ctx.db.query.issues.findFirst({
        where: eq(issues.id, input.id),
        with: {
          repository: true,
          activity: {
            orderBy: (activity, { asc }) => [asc(activity.createdAt)],
          },
        },
      });

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      if (issue.repository.organizationId !== ctx.orgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      return issue;
    }),

  approve: protectedProcedure
    .input(z.object({ issueId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const issue = await ctx.db.query.issues.findFirst({
        where: eq(issues.id, input.issueId),
        with: { repository: true },
      });

      if (!issue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      if (issue.repository.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      await ctx.db
        .update(issues)
        .set({ status: "resolved" as IssueStatus })
        .where(eq(issues.id, input.issueId));

      return { success: true };
    }),

  approveComment: protectedProcedure
    .input(z.object({ issueId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const issue = await ctx.db.query.issues.findFirst({
        where: eq(issues.id, input.issueId),
        with: { repository: true },
      });

      if (!issue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      if (issue.repository.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      if (!issue.issueComment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No comment to post",
        });
      }

      const [owner, repo] = issue.repository.fullName.split("/");
      const octokit = await getInstallationOctokit(issue.repository.installationId);

      await octokit.rest.issues.createComment({
        owner: owner!,
        repo: repo!,
        issue_number: issue.githubIssueNumber,
        body: issue.issueComment,
      });

      await ctx.db
        .update(issues)
        .set({ status: "resolved" as IssueStatus })
        .where(eq(issues.id, input.issueId));

      await ctx.db.insert(issueActivity).values({
        issueId: input.issueId,
        type: "comment_posted",
        details: { postedAt: new Date().toISOString() },
      });

      return { success: true };
    }),
});
