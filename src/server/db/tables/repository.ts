import { boolean, index, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

export const repositories = pgTable(
  "repository",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id"),
    githubRepoId: text("github_repo_id").notNull(),
    fullName: text("full_name").notNull(),
    installationId: text("installation_id").notNull(),
    mode: text("mode").$type<"auto" | "approval">().notNull().default("approval"),
    maxRetries: integer("max_retries").notNull().default(2),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => ({
    userIdIdx: index("user_id_idx").on(t.userId),
    orgIdIdx: index("org_id_idx").on(t.organizationId),
    githubRepoIdIdx: index("github_repo_id_idx").on(t.githubRepoId),
  }),
);
