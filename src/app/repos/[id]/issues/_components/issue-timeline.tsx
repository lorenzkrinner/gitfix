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
  ArrowPathIcon,
  ChatBubbleLeftIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/solid";
import {
  useInngestSubscription,
  InngestSubscriptionState,
} from "@inngest/realtime/hooks";
import { CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { refreshRealtimeToken } from "~/server/actions/realtime";
import type { IssueStatus } from "~/lib/types/issue";
import type { IssueActivityType } from "~/lib/types/issue";
import type { IssueActivity } from "~/server/db/tables";
import type { Issue } from "~/server/db/tables/issue";
import { Markdown } from "~/components/ui/markdown";
import { api } from "~/trpc/react";

const ACTIVE_STATUSES: IssueStatus[] = ["analyzing", "fixing"];

const ACTIVITY_ICONS: Record<IssueActivityType, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  triage: MagnifyingGlassIcon,
  reasoning: LightBulbIcon,
  repo_clone: ArrowPathIcon,
  web_search: MagnifyingGlassIcon,
  file_read: DocumentTextIcon,
  file_change: CodeBracketIcon,
  run_command: CommandLineIcon,
  tool_call: WrenchScrewdriverIcon,
  error: ExclamationTriangleIcon,
  pr_created: CodeBracketIcon,
  ci_status: CheckCircleIcon,
  pr_merged: ArrowsRightLeftIcon,
  comment_drafted: ChatBubbleLeftIcon,
  comment_posted: ChatBubbleLeftIcon,
  escalated: ExclamationTriangleIcon,
  done: CheckCircleIcon,
};

const ACTIVITY_LABELS: Record<IssueActivityType, string> = {
  triage: "Triage",
  reasoning: "Reasoning",
  repo_clone: "Clone Repository",
  web_search: "Web Search",
  file_read: "File Read",
  file_change: "File Change",
  run_command: "Command",
  tool_call: "Tool Call",
  error: "Error",
  pr_created: "Pull Request",
  ci_status: "CI Status",
  pr_merged: "PR Merged",
  comment_drafted: "Comment Drafted",
  comment_posted: "Comment Posted",
  escalated: "Escalated",
  done: "Done",
};

export function IssueTimeline({
  issue,
  initialActivity,
  onStatusChange,
}: {
  issue: Issue;
  initialActivity: IssueActivity[];
  onStatusChange?: (status: IssueStatus, isActive: boolean, isConnected: boolean) => void;
}) {
  const [activities, setActivities] = useState<IssueActivity[]>(initialActivity);
  const [currentStatus, setCurrentStatus] = useState<IssueStatus>(issue.status);
  const [fixSummary, setFixSummary] = useState(issue.fixSummary);

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
      const streamId = typeof data.streamId === "string" ? data.streamId : null;
      const stepId = typeof data.stepId === "string" ? data.stepId : null;
      const matchId = streamId ?? stepId;

      setActivities((prev) => {
        if (matchId) {
          const idx = prev.findIndex((a) => {
            const aStreamId = typeof a.details.streamId === "string" ? a.details.streamId : null;
            const aStepId = typeof a.details.stepId === "string" ? a.details.stepId : null;
            const aMatchId = aStreamId ?? aStepId;
            return aMatchId === matchId;
          });
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx]!, details: data, createdAt: new Date() };
            return updated;
          }
        }

        const newActivity: IssueActivity = {
          issueId: issue.id,
          id: crypto.randomUUID(),
          type: topic as IssueActivityType,
          details: data,
          createdAt: new Date(),
        };
        return [...prev, newActivity];
      });

      if (topic === "done") {
        setCurrentStatus("awaiting_review");
        if (typeof data.summary === "string") setFixSummary(data.summary);      }
    }
  }, [freshData, issue.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activities.length]);

  useEffect(() => {
    onStatusChange?.(currentStatus, isActive, isConnected);
  }, [currentStatus, isActive, isConnected, onStatusChange]);

  const lastActivity = activities[activities.length - 1];
  const lastIsLoading = lastActivity?.details.status === "started";

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
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
                    {activity.details.status === "started" && (
                      <Spinner className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <ActivityDetails
                    type={activity.type}
                    details={activity.details}
                    issueId={issue.id}
                    showButton={!activities.some((a) => a.type === "comment_posted")}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {isActive && !lastIsLoading && (
          <div className="relative flex gap-4 pl-2 mt-4">
            <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background">
              <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground">
                {currentStatus === "analyzing"
                  ? "Analyzing issue..."
                  : "Fixing..."}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {fixSummary && !isActive && (
        <div className="flex flex-col gap-0 border-t py-12 mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Fix Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">{fixSummary}</p>
          </CardContent>
        </div>
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
  issueId,
  showButton,
}: {
  type: IssueActivityType;
  details: Record<string, unknown>;
  issueId: string;
  showButton: boolean;
}) {
  const isStarted = details.status === "started";
  const isFailed = details.status === "failed";

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
    case "repo_clone":
      return (
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-xs">
            {str(details.repository)}
          </code>
          {isStarted && (
            <span className="text-xs text-muted-foreground">Cloning...</span>
          )}
          {!isStarted && typeof details.path === "string" && (
            <span className="text-xs text-muted-foreground">Cloned</span>
          )}
        </div>
      );
    case "file_read":
      return (
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-xs">
            {str(details.filePath)}
          </code>
          {isStarted && (
            <span className="text-xs text-muted-foreground">Reading...</span>
          )}
        </div>
      );
    case "file_change":
      return (
        <div className="flex flex-col gap-1">
          <code className="rounded bg-muted px-2 py-1 text-xs w-fit">
            {str(details.filePath)}
          </code>
          {isStarted && (
            <span className="text-xs text-muted-foreground">Applying changes...</span>
          )}
          {!isStarted && typeof details.diff === "string" && (
            <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
              {details.diff}
            </pre>
          )}
        </div>
      );
    case "run_command":
      return (
        <div className="flex flex-col gap-1">
          <code className="rounded bg-muted px-2 py-1 text-xs w-fit">
            $ {str(details.command)}
          </code>
          {isStarted && (
            <span className="text-xs text-muted-foreground">Running...</span>
          )}
          {!isStarted && typeof details.output === "string" && (
            <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
              {details.output}
            </pre>
          )}
        </div>
      );
    case "web_search":
      return (
        <div className="flex flex-col gap-1">
          <code className="rounded bg-muted px-2 py-1 text-xs w-fit">
            {str(details.query)}
          </code>
          {isStarted && (
            <span className="text-xs text-muted-foreground">Searching...</span>
          )}
          {!isStarted && typeof details.snippet === "string" && (
            <p className="text-sm text-muted-foreground">{details.snippet}</p>
          )}
        </div>
      );
    case "pr_created":
      if (isStarted) {
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Creating pull request: {str(details.title)}
            </span>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-1">
          <span className="text-sm">{str(details.title)}</span>
          {typeof details.url === "string" && (
            <a
              href={details.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline w-fit"
            >
              #{details.number as string} — View on GitHub
            </a>
          )}
        </div>
      );
    case "ci_status":
      if (isStarted) {
        return (
          <span className="text-sm text-muted-foreground">
            Running CI checks...
          </span>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              details.status === "passed"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {details.status === "passed" ? "Passed" : "Failed"}
          </span>
          <span className="text-xs text-muted-foreground">
            {details.passed as number}/{details.checks as number} checks passed
          </span>
        </div>
      );
    case "pr_merged":
      return (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-purple-600">Pull request merged</span>
          {typeof details.url === "string" && (
            <a
              href={details.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline w-fit"
            >
              #{details.number as string} — View on GitHub
            </a>
          )}
        </div>
      );
    case "comment_drafted":
      return (
        <CommentDraftedDetails
          details={details}
          issueId={issueId}
          showButton={showButton}
        />
      );
    case "comment_posted":
      return (
        <span className="text-sm text-green-600">Comment posted to GitHub</span>
      );
    case "error":
      return (
        <p className={`text-sm ${isFailed ? "text-red-600 font-medium" : "text-red-600"}`}>
          {str(details.message)}
        </p>
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

function CommentDraftedDetails({
  details,
  issueId,
  showButton,
}: {
  details: Record<string, unknown>;
  issueId: string;
  showButton: boolean;
}) {
  const [posted, setPosted] = useState(false);

  const approveComment = api.issue.approveComment.useMutation({
    onSuccess: () => setPosted(true),
  });

  const comment = str(details.issueComment);

  return (
    <div className="flex flex-col gap-3">
      {comment && (
        <div className="rounded-lg border bg-muted/50 p-3">
          <Markdown collapsible className="text-sm">{comment}</Markdown>
        </div>
      )}
      {posted ? (
        <span className="text-sm text-green-600">Comment posted to GitHub</span>
      ) : showButton ? (
        <Button
          size="sm"
          onClick={() => approveComment.mutate({ issueId })}
          disabled={approveComment.isPending}
        >
          {approveComment.isPending ? (
            <>
              <Spinner className="size-3.5" />
              Posting...
            </>
          ) : (
            "Approve & Post Comment"
          )}
        </Button>
      ) : null}
      {approveComment.isError && (
        <p className="text-sm text-red-600">
          Failed to post comment: {approveComment.error.message}
        </p>
      )}
    </div>
  );
}
