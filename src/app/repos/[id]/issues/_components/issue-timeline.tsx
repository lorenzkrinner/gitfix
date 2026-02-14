"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  CommandLineIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LightBulbIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/solid";
import {
  useInngestSubscription,
  InngestSubscriptionState,
} from "@inngest/realtime/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { StatusBadge } from "./status-badge";
import { refreshRealtimeToken } from "~/server/actions/realtime";
import type { IssueStatus } from "~/lib/types/issue";
import type { IssueActivityType } from "~/lib/types/issue";
import type { IssueActivity } from "~/server/db/tables";
import type { Issue } from "~/server/db/tables/issue";

const ACTIVE_STATUSES: IssueStatus[] = ["analyzing", "fixing"];

const ACTIVITY_ICONS: Record<IssueActivityType, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  triage: MagnifyingGlassIcon,
  reasoning: LightBulbIcon,
  web_search: MagnifyingGlassIcon,
  file_read: DocumentTextIcon,
  file_change: CodeBracketIcon,
  run_command: CommandLineIcon,
  tool_call: WrenchScrewdriverIcon,
  error: ExclamationTriangleIcon,
  pr_opened: CodeBracketIcon,
  ci_result: CheckCircleIcon,
  escalated: ExclamationTriangleIcon,
  comment_posted: DocumentTextIcon,
  done: CheckCircleIcon,
};

const ACTIVITY_LABELS: Record<IssueActivityType, string> = {
  triage: "Triage",
  reasoning: "Reasoning",
  web_search: "Web Search",
  file_read: "File Read",
  file_change: "File Change",
  run_command: "Command",
  tool_call: "Tool Call",
  error: "Error",
  pr_opened: "PR Opened",
  ci_result: "CI Result",
  escalated: "Escalated",
  comment_posted: "Comment Posted",
  done: "Done",
};

export function IssueTimeline({
  issue,
  initialActivity,
}: {
  issue: Issue;
  initialActivity: IssueActivity[];
}) {
  const [activities, setActivities] = useState<IssueActivity[]>(initialActivity);
  const [currentStatus, setCurrentStatus] = useState<IssueStatus>(issue.status);
  const [fixSummary, setFixSummary] = useState(issue.fixSummary);
  const [issueComment, setIssueComment] = useState(issue.issueComment);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isActive = ACTIVE_STATUSES.includes(currentStatus);

  const refreshToken = useCallback(
    () => refreshRealtimeToken(issue.id),
    [issue.id],
  );

  const { freshData, state } = useInngestSubscription({
    refreshToken,
    enabled: isActive,
  });

  const isConnected = state === InngestSubscriptionState.Active;

  useEffect(() => {
    if (freshData.length === 0) return;

    for (const message of freshData) {
      const data = message.data as Record<string, unknown>;
      const topic = message.topic as string;

      const newActivity: IssueActivity = {
        issueId: issue.id,
        id: crypto.randomUUID(),
        type: topic as IssueActivityType,
        details: data,
        createdAt: new Date(),
      };

      setActivities((prev) => [...prev, newActivity]);

      if (topic === "done") {
        setCurrentStatus("awaiting_review");
        if (typeof data.summary === "string") setFixSummary(data.summary);
        if (typeof data.issueComment === "string") setIssueComment(data.issueComment);
      }
    }
  }, [freshData, issue.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activities.length]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">
            {issue.title}{" "}
            <span className="text-muted-foreground font-normal">
              #{issue.githubIssueNumber}
            </span>
          </h1>
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:underline"
          >
            View on GitHub
          </a>
        </div>
        <div className="flex items-center gap-2">
          {isActive && isConnected && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          <StatusBadge status={currentStatus} />
        </div>
      </div>

      <div className="relative">
        {activities.length > 0 && (
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
        )}

        <div className="flex flex-col gap-4">
          {activities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.type];
            return (
              <div key={activity.id} className="relative flex gap-4 pl-2">
                <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {ACTIVITY_LABELS[activity.type]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <ActivityDetails type={activity.type} details={activity.details} />
                </div>
              </div>
            );
          })}
        </div>

        {isActive && (
          <div className="relative flex gap-4 pl-2 mt-4">
            <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background">
              <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground">
                {currentStatus === "analyzing"
                  ? "Analyzing issue..."
                  : "Working on fix..."}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {fixSummary && !isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fix Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">{fixSummary}</p>
            {issueComment && (
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  Comment to be posted on GitHub:
                </h4>
                <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs whitespace-pre-wrap">
                  {issueComment}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activities.length === 0 && !isActive && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No activity recorded yet.
        </p>
      )}
    </div>
  );
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function ActivityDetails({
  type,
  details,
}: {
  type: IssueActivityType;
  details: Record<string, unknown>;
}) {
  switch (type) {
    case "triage":
      return (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <span className="font-medium">Classification:</span>{" "}
          {str(details.classification)}
          {typeof details.reasoning === "string" ? (
            <p className="mt-1 text-muted-foreground">{details.reasoning}</p>
          ) : null}
        </div>
      );
    case "reasoning":
      return (
        <p className="text-sm text-muted-foreground">
          {str(details.content)}
        </p>
      );
    case "file_read":
      return (
        <code className="rounded bg-muted px-2 py-1 text-xs">
          {str(details.filePath)}
        </code>
      );
    case "file_change":
      return (
        <div className="flex flex-col gap-1">
          <code className="rounded bg-muted px-2 py-1 text-xs w-fit">
            {str(details.filePath)}
          </code>
          {typeof details.diff === "string" ? (
            <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
              {details.diff}
            </pre>
          ) : null}
        </div>
      );
    case "run_command":
      return (
        <div className="flex flex-col gap-1">
          <code className="rounded bg-muted px-2 py-1 text-xs w-fit">
            $ {str(details.command)}
          </code>
          {typeof details.output === "string" ? (
            <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
              {details.output}
            </pre>
          ) : null}
        </div>
      );
    case "error":
      return (
        <p className="text-sm text-red-600">{str(details.message)}</p>
      );
    case "done":
      return (
        <p className="text-sm text-green-600">
          {str(details.summary, "Completed")}
        </p>
      );
    default:
      return (
        <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
          {JSON.stringify(details, null, 2)}
        </pre>
      );
  }
}
