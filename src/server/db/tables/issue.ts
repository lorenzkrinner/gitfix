import { index, integer, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { repositories } from "./repository";
import { ISSUE_STATUSES } from "~/lib/constants/db";
import type { IssueTriageResult } from "~/lib/types/issue";

export const issues = pgTable(
  "issue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    githubIssueNumber: integer("github_issue_number").notNull(),
    githubIssueId: text("github_issue_id").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    url: text("url").notNull(),
    status: text("status", { enum: ISSUE_STATUSES }).notNull().default("analyzing"),
    triageResult: jsonb("triage_result").$type<IssueTriageResult>(),
    fixSummary: text("fix_summary"),
    issueComment: text("issue_comment"),
    prUrl: text("pr_url"),
    prNumber: integer("pr_number"),
    branchName: text("branch_name"),
    retryCount: integer("retry_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => ({
    repositoryIdIdx: index("issue_repository_id_idx").on(t.repositoryId),
    githubIssueIdIdx: index("issue_github_issue_id_idx").on(t.githubIssueId),
    statusIdx: index("issue_status_idx").on(t.status),
  }),
);

export type InsertIssue = typeof issues.$inferInsert;
export type Issue = typeof issues.$inferSelect;