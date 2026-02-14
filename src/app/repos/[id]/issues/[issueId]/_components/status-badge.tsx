import { Badge } from "~/components/ui/badge";
import type { IssueStatus } from "~/lib/types/issue";
import { cn } from "~/lib/utils";

const STATUS_CONFIG: Record<
  IssueStatus,
  { label: string; className: string }
> = {
  analyzing: {
    label: "Analyzing",
    className: "bg-amber-900 text-amber-200",
  },
  fixing: {
    label: "Fixing",
    className: "bg-blue-900 text-blue-200",
  },
  pr_open: {
    label: "PR Open",
    className: "bg-indigo-900 text-indigo-200",
  },
  awaiting_review: {
    label: "Awaiting Review",
    className: "bg-purple-900 text-purple-200",
  },
  resolved: {
    label: "Resolved",
    className: "bg-green-900 text-green-200",
  },
  escalated: {
    label: "Escalated",
    className: "bg-red-900 text-red-200",
  },
  too_complex: {
    label: "Too Complex",
    className: "bg-orange-900 text-orange-200",
  },
  skipped: {
    label: "Skipped",
    className: "bg-gray-900 text-gray-200",
  },
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="ghost" className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
