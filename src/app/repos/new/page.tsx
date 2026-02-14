"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { GITHUB_APP_INSTALL_URL } from "~/lib/constants/github";
import { GithubIcon } from "~/components/icons";
import { Spinner } from "~/components/ui/spinner";

export default function NewRepoPage() {
  const router = useRouter();
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [mode, setMode] = useState<"auto" | "approval">("approval");

  const { data: repos, isLoading } = api.repository.listAvailable.useQuery();
  const connectMutation = api.repository.connect.useMutation({
    onSuccess: (data) => {
      if (data?.id) {
        router.push(`/repos/${data.id}`);
      }
    },
  });

  const selectedRepoData = repos?.find((r) => r.id === selectedRepo);
  const canConnect = selectedRepoData?.appInstalled ?? false;

  const handleConnect = () => {
    if (!selectedRepo || !selectedRepoData) return;

    if (!selectedRepoData.installationId) {
      return;
    }

    connectMutation.mutate({
      githubRepoId: selectedRepoData.id,
      fullName: selectedRepoData.fullName,
      mode,
      installationId: selectedRepoData.installationId,
    });
  };

  if (isLoading) {
    return <div className="container mx-auto p-8">Loading repositories...</div>;
  }

  return (
    <div className="container mx-auto max-w-2xl my-auto p-8 pb-32">
      <Card>
        <CardHeader>
          <CardTitle>Connect Repository</CardTitle>
          <CardDescription>
            Select a repository to enable AI-powered issue fixes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="repo-select">Repository</Label>
            <Select value={selectedRepo} onValueChange={setSelectedRepo}>
              <SelectTrigger id="repo-select" className="w-full">
                <SelectValue placeholder="Select a repository" />
              </SelectTrigger>
              <SelectContent>
                {repos?.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id}>
                    <GithubIcon />
                    {repo.fullName}
                  </SelectItem>
                ))} 
              </SelectContent>
            </Select>
          </div>

          {selectedRepoData && !selectedRepoData.appInstalled && (
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
              <p className="mb-2 text-sm font-medium text-yellow-600 dark:text-yellow-500">
                GitHub App Not Installed
              </p>
              <p className="mb-3 text-sm text-muted-foreground">
                You need to install the GitFix app on this repository first.
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full"
              >
                <a
                  href={GITHUB_APP_INSTALL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Install GitFix App on GitHub →
                </a>
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="mode-select">Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as "auto" | "approval")}
            >
              <SelectTrigger id="mode-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approval">
                  Approval
                  <span className="text-xs text-muted-foreground">Review PRs before merge</span>
                </SelectItem>
                <SelectItem value="auto">
                  Auto
                  <span className="text-xs text-muted-foreground">Merge PRs automatically</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleConnect}
            disabled={!selectedRepo || !canConnect || connectMutation.isPending}
            className="w-full"
          >
            {connectMutation.isPending ? <Spinner /> : "Connect Repository"}
          </Button>

          {connectMutation.error && (
            <p className="text-sm text-red-500">
              {connectMutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
