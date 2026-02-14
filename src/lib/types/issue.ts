import type { ISSUE_ACTIVITY_TYPES, ISSUE_STATUSES } from "../constants/db";

export type IssueActivityType = (typeof ISSUE_ACTIVITY_TYPES)[number];

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export type ActivityStatus = "started" | "completed" | "failed";

export type IssueTriageResult = {
  classification: string;
  reasoning: string;
};