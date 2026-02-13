import {
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-start bg-background text-foreground">
        <header className="flex h-16 w-full items-center justify-between gap-4 p-4">
          <OrganizationSwitcher appearance={{
            elements: {
              organizationSwitcherTrigger: "text-foreground!",
            },
          }} />
          <div className="flex items-center gap-2">
            <SignedOut>
              <SignInButton />
              <SignUpButton />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>
      </main>
    </HydrateClient>
  );
}
