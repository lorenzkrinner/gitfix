import {
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export default function TopNav() {
  return (
    <header className="flex h-16 w-full items-center justify-between gap-4 p-4">
      <OrganizationSwitcher  appearance={{
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
  );
}