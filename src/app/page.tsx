import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { NavArrowRightSolid } from 'iconoir-react';
import { HydrateClient } from "~/trpc/server";
import Link from "next/link";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-start bg-background text-foreground">
        <header className="flex h-16 w-full items-center justify-between gap-4 p-4">
          <p>Gitfix</p>
          <div className="flex items-center gap-2">
            <SignedOut>
              <SignInButton />
              <SignUpButton />
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
      </main>
    </HydrateClient>
  );
}
