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
import { refreshRealtimeToken } from "~/server/actions/realtime";
import type { IssueStatus } from "~/lib/types/issue";
import type { IssueActivityType } from "~/lib/types/issue";
import type { IssueActivity } from "~/server/db/tables";
import type { Issue } from "~/server/db/tables/issue";
import { Shimmer } from "~/components/ai-elements/shimmer";
import ReasoningDetails from "./activity/reasoning-details";
import DiffViewer from "./activity/diff-viewer";
import CollapsibleOutput from "./activity/collabsible-output";
import WebSearchDetails from "./activity/web-search-details";
import { FixSummary } from "./activity/fix-summary";
import { DraftComment } from "./activity/draft-comment";
import { Separator } from "~/components/ui/separator";
import Link from "next/link";
import { cn } from "~/lib/utils";
import Loader from "~/components/ui/loader";

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
  const lastIsLoading = lastActivity?.details.status === "started";

  return (
    <div className="flex flex-col gap-6 pb-10">
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
            <Loader />
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

export function Time({ date, className }: { date: Date, className?: string }) {
  return (
    <span className={cn("text-2xs text-muted-foreground/80", className)}>
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

  switch (type) {
    case "triage":
      if (isStarted) {
        return (
          <Shimmer duration={1} className="text-sm">Triaging issue...</Shimmer>
        );
      }
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
      return <ReasoningDetails details={details} createdAt={new Date(activity.createdAt)} />;
    case "repo_clone":
      return (
        <div className="w-full flex gap-1 text-sm justify-between">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="size-4 text-green-500" />
            {isStarted ? (
              <Shimmer duration={1} className="text-xs">Cloning repository...</Shimmer>
            ) : (
              <span className="text-xs text-muted-foreground">Cloned repository</span>
            )}
            <span className="text-muted-foreground text-xs">{str(details.path)}</span>
          </div>
          <Time date={new Date(activity.createdAt)} className="mr-2" />
        </div>
      );
    case "file_read":
      return (
        <div className="w-full flex justify-between items-center">
          <div className="flex items-center gap-1">
            {isStarted ? (
              <Shimmer duration={1} className="text-xs">Reading...</Shimmer>
            ) : <span className="text-xs text-muted-foreground">Read</span>}
             <code className="text-muted-foreground/80 text-xs">
              {str(details.filePath)}
            </code>
          </div>
          <Time date={new Date(activity.createdAt)} className="mr-2" />
        </div>
      );
    case "file_change":
      return (
        <DiffViewer
          isStreaming={details.status === "started"}
          diff={details.diff as string}
          filePath={details.filePath as string}
          createdAt={new Date(activity.createdAt)}
        />
      );
    case "run_command":
      return (
        <div className="rounded-lg bg-muted py-2">
          <div className="w-full flex justify-between items-center px-2">
            <div className="flex items-center gap-1">
              {isStarted ? (
                <Shimmer duration={1} className="text-xs">Running command...</Shimmer>
              ) : (
                <span className="text-2xs text-muted-foreground">Ran command: </span>
              )}
              <span className="text-2xs text-muted-foreground/80">{str(details.command)}</span>
            </div>
            <Time date={new Date(activity.createdAt)} />
          </div>
          {typeof details.output === "string" && (
            <>
              <Separator className="my-2 bg-border/60" />
              <CollapsibleOutput output={details.output} />
            </>
          )}
        </div>
      );
    case "web_search":
      return (
        <WebSearchDetails
          details={details}
          createdAt={new Date(activity.createdAt)}
        />
      );
    case "pr_created":
      return (
        <div className="rounded-lg bg-muted py-2 flex flex-col">
          <div className="flex items-center justify-between w-full px-2">
            <div className="flex items-center gap-1">
              {isStarted ? (
                <Shimmer duration={1} className="text-xs">Creating pull request...</Shimmer>
              ) : (
                <span className="text-xs text-muted-foreground">Created pull request: </span>
              )}
              <span className="text-xs text-muted-foreground/80">{str(details.title)}</span>
            </div>
            <Time date={new Date(activity.createdAt)} />
          </div>
          {!isStarted && (
            <>
              <Separator className="my-2 bg-border/60" />
              <div className="flex justify-between items-center gap-1 px-2">
                <span className="text-xs text-muted-foreground/80">✓ Success</span>
                {typeof details.url === "string" && (
                  <Link href={details.url} target="_blank" rel="noopener noreferrer">
                    <button className="bg-background border flex gap-1 items-center px-2 py-1 rounded-md hover:bg-muted-foreground/10 transition-colors text-xs text-muted-foreground cursor-pointer">
                      View on GitHub
                      <ArrowUpRightIcon className="size-4" />
                    </button>
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      )
    case "ci_status":
      if (isStarted) {
        return (
          <Shimmer duration={1.5} className="text-xs">
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
    case "fix_summary":
      return (
        <FixSummary
          details={details}
          createdAt={new Date(activity.createdAt)}
        />
      );
    case "comment_drafted":
      return (
        <DraftComment
          details={details}
          issueId={issueId}
          alreadyApproved={alreadyApproved}
          createdAt={new Date(activity.createdAt)}
          isStreaming={details.status === "started"}
        />
      );
    case "comment_posted":
      return null;
    case "error":
      return (
        <p className="text-xs">
          <span className="text-foreground">Error: </span>
          <span className="text-muted-foreground/80">{str(details.message)}</span>
        </p>
      );
    case "text_generated":
      return (
        <p className="text-sm text-foreground">{str(details.text)}</p>
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