import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Item, ItemContent, ItemDescription, ItemHeader, ItemTitle } from "~/components/ui/item";
import { db } from "~/server/db";
import { waitlister } from "~/server/db/tables/waitlister";
import { capitalize } from "~/utils/text";
export default async function WaitlistSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  if (!email) {
    return redirect("/");
  }

  const [waitlisterData] = await db
    .select()
    .from(waitlister)
    .where(eq(waitlister.email, email))
    .limit(1);

  if (!waitlisterData) {
    return redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-3xl font-bold">You&apos;re on the list!</h1>
        <Item variant={"muted"} className="mt-4">
          <ItemContent>
            <ItemHeader>
              <div className="flex flex-col items-start gap-0">
                <ItemTitle>Payment Method</ItemTitle>
                <ItemDescription className="text-start">Secured by stripe.</ItemDescription>
              </div>
              <ItemDescription>
                {capitalize(waitlisterData.paymentMethodBrand ?? "")}  •••••••{waitlisterData.paymentMethodLast4}
              </ItemDescription>
            </ItemHeader>
          </ItemContent>
        </Item>
        <p className="mt-4 text-muted-foreground">
          Thanks for joining the waitlist. You&apos;ll receive an email when we&apos;re ready to launch.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-primary underline underline-offset-4"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
