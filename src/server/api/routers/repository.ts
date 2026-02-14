import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { repositories } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { Octokit } from "@octokit/rest";
import { clerkClient } from "@clerk/nextjs/server";

export const repositoryRouter = createTRPCRouter({
  getInstallationId: protectedProcedure
    .input(z.object({ owner: z.string(), repo: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = await clerkClient();

      const tokenResponse = await client.users.getUserOauthAccessToken(
        ctx.userId,
        "github",
      );

      if (!tokenResponse.data[0]?.token) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "GitHub account not connected.",
        });
      }

      const octokit = new Octokit({ auth: tokenResponse.data[0].token });

      const { data: installations } =
        await octokit.apps.listInstallationsForAuthenticatedUser();

      for (const installation of installations.installations) {
        const { data: installationRepos } =
          await octokit.apps.listInstallationReposForAuthenticatedUser({
            installation_id: installation.id,
            per_page: 100,
          });

        const match = installationRepos.repositories.find(
          (r) => r.owner.login === input.owner && r.name === input.repo,
        );

        if (match) {
          return {
            installationId: String(installation.id),
            installed: true,
          };
        }
      }

      return {
        installationId: null,
        installed: false,
      };
    }),

  listAvailable: protectedProcedure.query(async ({ ctx }) => {
    const client = await clerkClient();

    const tokenResponse = await client.users.getUserOauthAccessToken(
      ctx.userId,
      "github",
    );

    if (!tokenResponse.data[0]?.token) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "GitHub account not connected. Please connect your GitHub account in settings.",
      });
    }

    const octokit = new Octokit({ auth: tokenResponse.data[0].token });

    const installedRepoMap = new Map<number, string>();

    const { data: installations } =
      await octokit.apps.listInstallationsForAuthenticatedUser();

    for (const installation of installations.installations) {
      const { data: installationRepos } =
        await octokit.apps.listInstallationReposForAuthenticatedUser({
          installation_id: installation.id,
          per_page: 100,
        });

      for (const repo of installationRepos.repositories) {
        installedRepoMap.set(repo.id, String(installation.id));
      }
    }

    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
    });

    const reposWithInstallation = repos.map((repo) => {
      const installationId = installedRepoMap.get(repo.id) ?? null;
      return {
        id: String(repo.id),
        fullName: repo.full_name,
        name: repo.name,
        owner: repo.owner.login,
        private: repo.private,
        description: repo.description,
        installationId,
        appInstalled: installationId !== null,
      };
    });

    return reposWithInstallation;
  }),

  connect: protectedProcedure
    .input(
      z.object({
        githubRepoId: z.string(),
        fullName: z.string(),
        mode: z.enum(["auto", "approval"]),
        installationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.installationId === "temp") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "GitHub App not installed on this repository. Please install the app first.",
        });
      }

      const existing = await ctx.db.query.repositories.findFirst({
        where: and(
          eq(repositories.githubRepoId, input.githubRepoId),
          eq(repositories.organizationId, ctx.orgId),
          eq(repositories.isActive, true),
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Repository already connected",
        });
      }

      const [repo] = await ctx.db
        .insert(repositories)
        .values({
          userId: ctx.userId,
          organizationId: ctx.orgId,
          githubRepoId: input.githubRepoId,
          fullName: input.fullName,
          installationId: input.installationId,
          mode: input.mode,
        })
        .returning();

      return repo;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const repo = await ctx.db.query.repositories.findFirst({
        where: and(
          eq(repositories.id, input.id),
          eq(repositories.organizationId, ctx.orgId),
        ),
      });

      if (!repo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      return repo;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.repositories.findMany({
      where: and(
        eq(repositories.organizationId, ctx.orgId),
        eq(repositories.isActive, true),
      ),
      orderBy: (repos, { desc }) => [desc(repos.createdAt)],
    });
  }),
});
