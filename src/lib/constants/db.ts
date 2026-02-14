export const ISSUE_ACTIVITY_TYPES = [
  "triage",
  "reasoning",
  "web_search",
  "file_read",
  "file_change",
  "run_command",
  "tool_call",
  "error",
  "pr_opened",
  "ci_result",
  "escalated",
  "comment_posted",
  "done",
] as const;

export const ISSUE_STATUSES = [
  "analyzing",
  "fixing",
  "pr_open",
  "awaiting_review",
  "resolved",
  "escalated",
  "too_complex",
  "skipped",
] as const;

export const TRIAGE_CLASSIFICATIONS = [
  "fixable",
  "too_complex",
  "not_actionable",
] as const;