"use client";

import { useState, useCallback } from "react";
import { IssueInfo } from "../_components/issue-info";
import { IssueTimeline } from "../_components/issue-timeline";
import type { IssueStatus } from "~/lib/types/issue";
import type { IssueActivity } from "~/server/db/tables";
import type { Issue } from "~/server/db/tables/issue";

const ACTIVE_STATUSES: IssueStatus[] = ["analyzing", "fixing"];

export function IssueDetailClient({
  issue,
}: {
  issue: Issue & { activity: IssueActivity[] };
}) {
  const [status, setStatus] = useState<IssueStatus>(issue.status);
  const [isActive, setIsActive] = useState(ACTIVE_STATUSES.includes(issue.status));
  const [isConnected, setIsConnected] = useState(false);

  const handleStatusChange = useCallback(
    (newStatus: IssueStatus, active: boolean, connected: boolean) => {
      setStatus(newStatus);
      setIsActive(active);
      setIsConnected(connected);
    },
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <IssueInfo
        title={issue.title}
        body={issue.body}
        githubIssueNumber={issue.githubIssueNumber}
        url={issue.url}
        status={status}
        isActive={isActive}
        isConnected={isConnected}
      />
      <IssueTimeline
        issue={issue}
        initialActivity={issue.activity}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
