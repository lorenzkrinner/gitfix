import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { issues } from "./issue";
import { ISSUE_ACTIVITY_TYPES } from "~/lib/constants/db";

export const issueActivity = pgTable(
  "issue_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    type: text("type", { enum: ISSUE_ACTIVITY_TYPES }).notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    issueIdIdx: index("issue_activity_issue_id_idx").on(t.issueId),
  }),
);

export type IssueActivity = typeof issueActivity.$inferSelect;
export type InsertIssueActivity = typeof issueActivity.$inferInsert;