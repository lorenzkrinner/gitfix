import Link from "next/link";
import { api } from "~/trpc/server";
import {
  Card,
  CardContainer,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { PlusCircleIcon } from "@heroicons/react/24/solid";
import { GithubIcon } from "~/components/icons";

export default async function ReposPage() {
  const repos = await api.repository.list();

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8 flex items-center justify-start">
        <h1 className="text-lg text-foreground font-medium">Connected Repositories</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/repos/new" className="flex-1 h-full ">
          <Card className="border-dotted border-3! transition-colors hover:border-accent group h-full">
            <CardContent className="cursor-pointer flex-1 flex center">
              <PlusCircleIcon className="text-muted-foreground size-8 group-hover:text-secondary transition-colors" />
            </CardContent>
          </Card>
        </Link>
        {repos.map((repo) => (
          <Link key={repo.id} href={`/repos/${repo.id}`}>
            <CardContainer>
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <GithubIcon className="size-4 shrink-0 text-muted-foreground" />
                    <CardTitle className="text-lg">{repo.fullName}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">
                        {repo.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">
                      {repo.mode === "auto" ? "Auto-merge" : "Approval required"}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
              <CardFooter className="py-2">
                <div className="text-xs text-start w-full text-muted-foreground">
                  Connected {new Date(repo.createdAt).toLocaleDateString()}
                </div>
              </CardFooter>
            </CardContainer>
          </Link>
        ))}
      </div>
    </div>
  );
}
