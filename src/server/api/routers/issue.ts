import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { issues } from "~/server/db/tables/issue";
import type { IssueStatus } from "~/lib/types/issue";
import { repositories } from "~/server/db/tables/repository";

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
});
