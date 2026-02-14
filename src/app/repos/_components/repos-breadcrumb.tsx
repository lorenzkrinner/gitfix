"use client";

import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { api } from "~/trpc/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

export function ReposBreadcrumb() {
  const pathname = usePathname();
  const params = useParams();

  const repoId = typeof params?.id === "string" ? params.id : null;
  const issueId = typeof params?.issueId === "string" ? params.issueId : null;

  const { data: repo } = api.repository.get.useQuery(
    { id: repoId! },
    { 
      enabled: !!repoId,
      placeholderData: (previousData) => previousData,
    }
  );

  const { data: issue } = api.issue.get.useQuery(
    { id: issueId! },
    { 
      enabled: !!issueId,
      placeholderData: (previousData) => previousData,
    }
  );

  const isRepoPage = (/^\/repos\/[^/]+$/).exec(pathname);
  const isIssuePage = (/^\/repos\/[^/]+\/issues\/[^/]+$/).exec(pathname);
  const isReposListPage = pathname === "/repos" || pathname === "/repos/new";

  if (isReposListPage) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
          <BreadcrumbLink asChild>
              <Link href="/repos">Repositories</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  if (isRepoPage && repo) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/repos">Repositories</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{repo.fullName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  if (isIssuePage && repo && issue) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/repos">Repositories</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/repos/${repoId}`}>{repo.fullName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <Tooltip>
            <TooltipTrigger asChild>
              <BreadcrumbItem className="cursor-pointer">
                <BreadcrumbPage className="truncate max-w-[200px]">{issue.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </TooltipTrigger>
            <TooltipContent>
              <p>{issue.title}</p>
            </TooltipContent>
          </Tooltip>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }
}
