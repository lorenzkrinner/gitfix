import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { str, Time } from "../issue-timeline";
import { Markdown } from "~/components/ui/markdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { Shimmer } from "~/components/ai-elements/shimmer";
import { Separator } from "~/components/ui/separator";

const STREAMING_HEIGHT = 120;

export function DraftComment({
  details,
  issueId,
  alreadyApproved,
  isStreaming,
  createdAt,
}: {
  details: Record<string, unknown>;
  issueId: string;
  alreadyApproved: boolean;
  isStreaming: boolean;
  createdAt: Date;
}) {
  const [approved, setApproved] = useState(alreadyApproved);

  const contentRef = useRef<HTMLDivElement>(null);

  const approve = api.issue.approve.useMutation({
    onSuccess: () => setApproved(true),
  });

  const approveComment = api.issue.approveComment.useMutation({
  });

  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [details.content, isStreaming]);

  const comment = str(details.content) || str(details.issueComment);
  const prUrl = str(details.prUrl);
  const isLoading = approve.isPending || approveComment.isPending;

  return (
    <div className="flex flex-col gap-3">
      {comment && (
        <div className="rounded-lg border bg-muted/50 flex flex-col py-2">
          <div className="flex items-center justify-between w-full px-2">
            <div className="flex items-center gap-1">
              {isStreaming ? (
                <div className="flex items-center gap-1">
                  <Spinner className="size-2 mr-1" />
                  <Shimmer duration={1} className="text-xs">Drafting comment...</Shimmer>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Drafted comment</span>
              )}
            </div>
            <Time date={createdAt} />
          </div>
          {!isStreaming && (
            <>
              <Separator className="my-2 bg-border/60" />
              <div
                ref={contentRef}
                className={`${isStreaming ? "overflow-y-auto hide-scrollbar" : ""}`}
                style={isStreaming ? { maxHeight: STREAMING_HEIGHT } : undefined}
              >
                <Markdown collapsible={!isStreaming} className="text-sm px-3 mt-1">{comment}</Markdown>
              </div>
            </>
          )}
        </div>
      )}
      {!isStreaming && (
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={isLoading || approved}>
                {isLoading ? (
                  <>
                    <Spinner className="size-3.5" />
                    Processing...
                  </>
                ) : (
                  <>
                    {approved ? "Approved" : "Approve"}
                    <ChevronDownIcon className="ml-1" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => approve.mutate({ issueId })}
                disabled={isLoading}
              >
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => approveComment.mutate({ issueId })}
                disabled={isLoading}
              >
                Approve & Post Comment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {prUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={prUrl} target="_blank" rel="noopener noreferrer">
                Open PR
              </a>
            </Button>
          )}
        </div>
      )}
      {approveComment.isError && (
        <p className="text-sm text-red-600">
          Failed to post comment: {approveComment.error.message}
        </p>
      )}
      {approve.isError && (
        <p className="text-sm text-red-600">
          Failed to approve: {approve.error.message}
        </p>
      )}
    </div>
  );
}
