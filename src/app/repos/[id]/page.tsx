import Link from "next/link";
import { api } from "~/trpc/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ArrowLeftCircleIcon } from "@heroicons/react/24/solid";
import { StatusBadge } from "./issues/_components/status-badge";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [repo, repoIssues] = await Promise.all([
    api.repository.get({ id }),
    api.issue.list({ repositoryId: id }),
  ]);

  return (
    <div className="container mx-auto max-w-4xl p-8 flex flex-col gap-6">
      <Link href="/repos">
        <Button variant="outline">
          <ArrowLeftCircleIcon className="w-4 h-4" />
          Back to Repositories
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{repo.fullName}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {repo.mode === "auto" ? "Auto-merge" : "Approval"}
              </Badge>
              <Badge variant={repo.isActive ? "default" : "secondary"}>
                {repo.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          <CardDescription>Repository Configuration</CardDescription>
        </CardHeader>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Issues</h2>

        {repoIssues.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                No issues processed yet. Issues will appear here when they are
                created in your GitHub repository.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {repoIssues.map((issue) => (
              <Link key={issue.id} href={`/repos/${id}/issues/${issue.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm text-muted-foreground font-mono">
                        #{issue.githubIssueNumber}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {issue.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={issue.status} />
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(issue.createdAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
