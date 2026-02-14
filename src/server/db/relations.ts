import { relations } from "drizzle-orm";
import { repositories } from "./tables/repository";
import { issues } from "./tables/issue";
import { issueActivity } from "./tables/issue-activity";

export const repositoriesRelations = relations(repositories, ({ many }) => ({
  issues: many(issues),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [issues.repositoryId],
    references: [repositories.id],
  }),
  activity: many(issueActivity),
}));

export const issueActivityRelations = relations(issueActivity, ({ one }) => ({
  issue: one(issues, {
    fields: [issueActivity.issueId],
    references: [issues.id],
  }),
}));
