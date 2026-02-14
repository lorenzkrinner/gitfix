import Link from "next/link";
import { Button } from "~/components/ui/button";

import { api } from "~/trpc/server";
import { IssueDetailClient } from "./issue-detail-client";
import { NavArrowLeftSolid } from "iconoir-react";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string; issueId: string }>;
}) {
  const { id, issueId } = await params;
  const issue = await api.issue.get({ id: issueId });

  return (
    <div className="container mx-auto max-w-4xl p-8 flex flex-col gap-4">
      <Link href={`/repos/${id}`} className="w-fit">
        <Button variant="ghost" size="sm">
          <NavArrowLeftSolid className="size-4" />
          Back to Repository
        </Button>
      </Link>
      <IssueDetailClient issue={issue} />
    </div>
  );
}
