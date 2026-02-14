import { useState } from "react";
import { api } from "~/trpc/react";
import { str } from "../issue-timeline";
import { Markdown } from "~/components/ui/markdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { ChevronDownIcon } from "@heroicons/react/24/solid";

export function DraftComment({
  details,
  issueId,
  alreadyApproved,
}: {
  details: Record<string, unknown>;
  issueId: string;
  alreadyApproved: boolean;
}) {
  const [approved, setApproved] = useState(false);

  const approve = api.issue.approve.useMutation({
    onSuccess: () => setApproved(true),
  });

  const approveComment = api.issue.approveComment.useMutation({
  });

  const comment = str(details.issueComment);
  const prUrl = str(details.prUrl);
  const isLoading = approve.isPending || approveComment.isPending;

  return (
    <div className="flex flex-col gap-3">
      {comment && (
        <div className="rounded-lg border bg-muted/50 p-3">
          <Markdown collapsible className="text-sm">{comment}</Markdown>
        </div>
      )}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={isLoading || alreadyApproved}>
              {isLoading ? (
                <>
                  <Spinner className="size-3.5" />
                  Processing...
                </>
              ) : (
                <>
                  {alreadyApproved ? "Approved" : "Approve"}
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




