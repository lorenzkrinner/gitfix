"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/solid";
import {
  useInngestSubscription,
  InngestSubscriptionState,
} from "@inngest/realtime/hooks";
import { CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { refreshRealtimeToken } from "~/server/actions/realtime";
import type { IssueStatus } from "~/lib/types/issue";
import type { IssueActivityType } from "~/lib/types/issue";
import type { IssueActivity } from "~/server/db/tables";
import type { Issue } from "~/server/db/tables/issue";
import { Shimmer } from "~/components/ai-elements/shimmer";
import ReasoningDetails from "./activity/reasoning-details";
import DiffViewer from "./activity/diff-viewer";
import CollapsibleOutput from "./activity/collabsible-output";
import { DraftComment } from "./activity/draft-comment";
import { Spinner } from "~/components/ui/spinner";
import { Separator } from "~/components/ui/separator";
import Link from "next/link";

const ACTIVE_STATUSES: IssueStatus[] = ["analyzing", "fixing"];

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
        if (typeof data.summary === "string") setFixSummary(data.summary);
        if (data.status === "completed" || !data.status) {
          setCurrentStatus("awaiting_review");
        }
      }
    }
  }, [freshData, issue.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activities.length]);

  useEffect(() => {
    onStatusChange?.(currentStatus, isActive, isConnected);
  }, [currentStatus, isActive, isConnected, onStatusChange]);

  const lastActivity = activities[activities.length - 1];
  const lastIsLoading =
    lastActivity?.details.status === "started" ||
    lastActivity?.details.status === "streaming";

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <div className="flex flex-col gap-3">
          {activities.map((activity) => {
            const alreadyApproved = ["resolved", "escalated", "too_complex", "skipped"].includes(currentStatus);
            return (
              <ActivityDetails
                key={activity.id}
                type={activity.type}
                details={activity.details}
                issueId={issue.id}
                alreadyApproved={alreadyApproved}
                activity={activity}
              />
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

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function Time({ date }: { date: Date }) {
  return (
    <span className="text-xs text-muted-foreground">
      {date.toLocaleTimeString()}
    </span>
  );
}

function ActivityDetails({
  type,
  details,
  issueId,
  alreadyApproved,
  activity,
}: {
  type: IssueActivityType;
  details: Record<string, unknown>;
  issueId: string;
  alreadyApproved: boolean;
  activity: IssueActivity;
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
      return <ReasoningDetails details={details} />;
    case "repo_clone":
      return (
        <div className="w-full flex gap-1 text-sm justify-between">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="size-4 text-green-500" />
            <p className="text-foreground">Cloned repository</p>
            <span className="text-muted-foreground">{str(details.path)}</span>
          </div>
          <Time date={new Date(activity.createdAt)} />
        </div>
      );
    case "file_read":
      return (
        <div className="flex items-center gap-1">
          {isStarted ? (
            <Shimmer duration={1} className="text-xs text-muted-foreground">Reading...</Shimmer>
          ) : <span className="text-xs text-muted-foreground">Read</span>}
           <code className="text-muted-foreground/80 text-xs">
            {str(details.filePath)}
          </code>
        </div>
      );
    case "file_change":
      return (
        <DiffViewer isRunning={isStarted} diff={details.diff as string} filePath={details.filePath as string} />
        
      );
    case "run_command":
      return (
        <div className="rounded-lg bg-muted py-2">
          <div className="flex items-center gap-1 px-2">
            <span className="text-xs text-muted-foreground">Ran command: </span>
            <span className="text-xs text-muted-foreground/80">{str(details.command)}</span>
          </div>
          <Separator className="my-2 bg-border/60" />
          {!isStarted && typeof details.output === "string" && (
            <CollapsibleOutput output={details.output} />
          )}
        </div>
      );
    case "web_search":
      return (
        <div className="flex flex-col gap-1 bg-muted rounded p-2">
          {isStarted ? (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Spinner className="size-2 mr-1" />
              <Shimmer duration={1} className="text-xs">{`Searching web... "${str(details.query)}"`}</Shimmer>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{`Searched web for: "${str(details.query)}"`}</span>
          )}
          {!isStarted && typeof details.snippet === "string" && (
            <p className="text-xs text-muted-foreground/80">{details.snippet}</p>
          )}
        </div>
      );
    case "pr_created":
      return (
        <div className="rounded-lg bg-muted py-2 flex px-2 justify-between">
          <div className="flex items-center gap-1">
            {isStarted ? (
              <Shimmer duration={1} className="text-xs text-muted-foreground">Creating pull request...</Shimmer>
            ) : (
              <span className="text-xs text-muted-foreground">Created pull request: </span>
            )}
            <span className="text-xs text-muted-foreground/80">{str(details.title)}</span>
          </div>
          {typeof details.url === "string" && (
            <Link href={details.url} target="_blank" rel="noopener noreferrer">
              <button className="bg-background border flex gap-1 items-center px-2 py-1 rounded-md hover:bg-muted-foreground/10 transition-colors text-xs text-muted-foreground cursor-pointer">
                View on GitHub
                <ArrowUpRightIcon className="size-4" />
              </button>
            </Link>
          )}
        </div>
      )
    case "ci_status":
      if (isStarted) {
        return (
          <Shimmer duration={1} className="text-sm text-muted-foreground">
            Running CI checks...
          </Shimmer>
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
        <DraftComment
          details={details}
          issueId={issueId}
          alreadyApproved={alreadyApproved}
        />
      );
    case "comment_posted":
      return null;
    case "error":
      return (
        <p className={`text-sm ${isFailed ? "text-red-600 font-medium" : "text-red-600"}`}>
          {str(details.message)}
        </p>
      );
    case "done":
      return null;
    default:
      return (
        <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
          {JSON.stringify(details, null, 2)}
        </pre>
      );
  }
}