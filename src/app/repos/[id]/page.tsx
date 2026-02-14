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
import { MagnifyingGlassCircleIcon } from "@heroicons/react/24/solid";
import { StatusBadge } from "./issues/_components/status-badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { GithubIcon } from "~/components/icons";
import { NavArrowLeftSolid } from "iconoir-react";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const repo = await api.repository.get({ id });
  const repoIssues = await api.issue.list({ repositoryId: repo.id });

  return (
    <div className="container mx-auto max-w-4xl p-8 flex flex-col gap-6">
      <Link href="/repos" className="w-fit">
        <Button variant="ghost" size="sm">
          <NavArrowLeftSolid className="size-4" />
          Back to Repositories
        </Button>
      </Link>

      <Card className="pb-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <GithubIcon className="size-4 shrink-0 text-muted-foreground" />
                <CardTitle className="leading-none">{repo.fullName}</CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Connected {new Date(repo.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline">
                {repo.mode === "auto" ? "Auto-merge" : "Approval"}
              </Badge>
              <Badge variant={repo.isActive ? "default" : "secondary"}>
                {repo.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Issues</h2>

        {repoIssues.length === 0 ? (
          <Empty className="pt-10">
            <EmptyContent>
              <EmptyMedia>
                <MagnifyingGlassCircleIcon className="size-10 text-muted-foreground" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No issues processed yet</EmptyTitle>
                <EmptyDescription>
                  Issues will appear here when they are created in your GitHub repository.
                </EmptyDescription>
              </EmptyHeader>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {repoIssues.map((issue) => (
              <Link key={issue.id} href={`/repos/${id}/issues/${issue.id}`}>
                <Card className="transition-shadow hover:shadow-md border-none">
                  <CardContent className="flex items-center justify-between">
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
