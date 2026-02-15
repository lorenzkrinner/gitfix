import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { NavArrowRightSolid } from 'iconoir-react';
import { GitFork, Activity } from 'iconoir-react';
import { HydrateClient } from "~/trpc/server";
import Link from "next/link";
import Image from "next/image";
import WaitlistDialog from "./_components/waitlist-dialog";
import Logo from "~/components/logo";
import { CONTACT_EMAIL } from "~/lib/constants/global";
import { ArrowPathRoundedSquareIcon, CodeBracketSquareIcon, ExclamationTriangleIcon, ScissorsIcon } from "@heroicons/react/24/solid";

const FEATURES = [
  {
    icon: GitFork,
    title: "GitHub Integration",
    description: "Installs as a GitHub App and listens to issue/PR events to trigger automated fixes inside selected repositories.",
  },
  {
    icon: ScissorsIcon,
    title: "AI Issue Triage",
    description: "Classifies new issues as fixable, too complex, or not actionable to decide whether to attempt a fix.",
  },
  {
    icon: CodeBracketSquareIcon,
    title: "Auto Code Fixing",
    description: "Reads relevant files, generates code changes, creates a branch, and opens a pull request automatically.",
  },
  {
    icon: ArrowPathRoundedSquareIcon,
    title: "CI-Aware PR Flow",
    description: "Waits for CI checks, then auto-merges or requests human approval depending on repo mode.",
  },
  {
    icon: ExclamationTriangleIcon,
    title: "Smart Retries & Escalation",
    description: "Retries failed fixes using CI error context and escalates to humans if retries are exhausted.",
  },
  {
    icon: Activity,
    title: "Activity & Audit Log",
    description: "Provides a dashboard and full timeline of every agent action for transparency and control.",
  },
];

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-dvh flex-col items-center justify-start bg-background text-foreground max-w-3xl mx-auto">
        <header className="flex h-16 w-full items-center justify-between gap-4 p-4">
          <Logo />
          <div className="flex items-center gap-2">
            <SignedOut>
              <SignInButton mode="redirect">
                <Button variant="outline" size="sm">
                  Sign in
                  <NavArrowRightSolid className="size-4" />
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link href="/repos">
                <Button size="sm">
                  Dashboard
                  <NavArrowRightSolid className="size-4" />
                </Button>
              </Link>
              <UserButton />
            </SignedIn>
          </div>
        </header>
        <section className="flex flex-1 w-full px-4">
          <div className="flex flex-col gap-6 pt-20 pb-10 mx-auto">
            <div className="flex flex-col gap-2">
              <h1 className="text-4xl font-bold">Fix your GitHub issues automatically</h1>
              <p className="text-lg text-muted-foreground">Setup in 5 minutes. Save hours of manual work. Gitfix is the easiest way to fix issues in your GitHub repositories.</p>
            </div>
            <WaitlistDialog>
              <Button variant="default" className="w-fit">Join the waitlist</Button>
            </WaitlistDialog>
            <Image src="/web/hero.png" alt="Gitfix hero image" className="rounded-lg" width={1000} height={1000} />
          </div>
        </section>
        <section className="w-full px-4 pb-20">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex flex-col gap-2 rounded-lg border border-border p-5">
                <feature.icon className="size-5 text-muted-foreground" />
                <h3 className="text-base font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
        <footer className="flex w-full items-center justify-between px-4 py-6">
          <Logo />
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-muted-foreground hover:text-foreground">
            Contact the Founder
          </a>
        </footer>
      </main>
    </HydrateClient>
  );
}