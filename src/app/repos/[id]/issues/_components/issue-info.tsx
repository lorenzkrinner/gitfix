import { ArrowUpRightIcon } from "@heroicons/react/24/solid";
import { GithubIcon } from "~/components/icons";
import { StatusBadge } from "./status-badge";
import type { IssueStatus } from "~/lib/types/issue";
import { Separator } from "~/components/ui/separator";
import { Markdown } from "~/components/ui/markdown";

export function IssueInfo({
  title,
  body,
  githubIssueNumber,
  url,
  status,
  isActive,
  isConnected,
}: {
  title: string;
  body: string | null;
  githubIssueNumber: number;
  url: string;
  status: IssueStatus;
  isActive: boolean;
  isConnected: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <GithubIcon className="size-4" />
          <span className="text-sm text-muted-foreground">
            Issue synced from GitHub
          </span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            #{githubIssueNumber}
          </a>
        </div>
        <div className="flex items-center gap-1">
          {isActive && isConnected && (
            <span className="flex items-center gap-1.5 text-xs text-green-500 mr-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          <StatusBadge status={status} />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowUpRightIcon className="size-4" />
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        {body && (
          <Markdown className="text-sm text-muted-foreground leading-relaxed" collapsible>
            {body}
          </Markdown>
        )}
      </div>

      <Separator className="my-4" />
    </div>
  );
}
