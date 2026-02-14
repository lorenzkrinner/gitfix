import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ArrowLeftCircleIcon } from "@heroicons/react/24/solid";
import { api } from "~/trpc/server";
import { IssueTimeline } from "../_components/issue-timeline";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string; issueId: string }>;
}) {
  const { id, issueId } = await params;
  const issue = await api.issue.get({ id: issueId });

  return (
    <div className="container mx-auto max-w-4xl p-8 flex flex-col gap-4">
      <Link href={`/repos/${id}`}>
        <Button variant="outline">
          <ArrowLeftCircleIcon className="w-4 h-4" />
          Back to Repository
        </Button>
      </Link>
      <IssueTimeline
        issue={issue}
        initialActivity={issue.activity}
      />
    </div>
  );
}
