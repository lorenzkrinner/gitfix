export const ISSUE_ACTIVITY_TYPES = [
  "triage",
  "text_generated",
  "reasoning",
  "repo_clone",
  "web_search",
  "file_read",
  "file_change",
  "run_command",
  "tool_call",
  "error",
  "pr_created",
  "ci_status",
  "pr_merged",
  "comment_drafted",
  "comment_posted",
  "escalated",
  "done",
  "fix_summary",
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