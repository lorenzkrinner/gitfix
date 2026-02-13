import Link from "next/link";
import { api } from "~/trpc/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

export default async function ReposPage() {
  const repos = await api.repository.list();

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Connected Repositories</h1>
          <p className="text-muted-foreground">
            Manage repositories with AI-powered issue fixes
          </p>
        </div>
        <Button asChild>
          <Link href="/repos/new">Connect Repository</Link>
        </Button>
      </div>

      {repos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="mb-4 text-muted-foreground">
              No repositories connected yet
            </p>
            <Button asChild>
              <Link href="/repos/new">Connect Your First Repository</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <Link key={repo.id} href={`/repos/${repo.id}`}>
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">{repo.fullName}</CardTitle>
                  <CardDescription>
                    <Badge variant="outline" className="mt-2">
                      {repo.mode === "auto" ? "Auto-merge" : "Approval required"}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Max retries: {repo.maxRetries}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Connected {new Date(repo.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
