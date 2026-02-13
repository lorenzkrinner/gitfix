import { api } from "~/trpc/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await api.repository.get({ id });

  return (
    <div className="container mx-auto max-w-4xl p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{repo.fullName}</CardTitle>
            <Badge variant={repo.isActive ? "default" : "secondary"}>
              {repo.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <CardDescription>Repository Configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg bg-muted p-4">
            {JSON.stringify(repo, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
