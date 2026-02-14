import { Badge } from "~/components/ui/badge";
import type { IssueStatus } from "~/lib/types/issue";
import { cn } from "~/lib/utils";

const STATUS_CONFIG: Record<
  IssueStatus,
  { label: string; className: string }
> = {
  analyzing: {
    label: "Analyzing",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  fixing: {
    label: "Fixing",
    className: "bg-blue-100 text-blue-800 border-blue-200 animate-pulse",
  },
  pr_open: {
    label: "PR Open",
    className: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  awaiting_review: {
    label: "Awaiting Review",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  resolved: {
    label: "Resolved",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  escalated: {
    label: "Escalated",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  too_complex: {
    label: "Too Complex",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  skipped: {
    label: "Skipped",
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="outline" className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
