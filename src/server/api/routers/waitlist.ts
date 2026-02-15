import { TRPCError } from "@trpc/server";
import { createClerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { waitlister } from "~/server/db/tables/waitlister";
import { stripe } from "~/lib/stripe/stripe";
import { resend } from "~/lib/email/resend";
import { env } from "~/env";
import { getBaseUrl } from "~/utils/get-base-url";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const DUPLICATE_MESSAGE = "This email is already on the waitlist.";

export type CreateWaitlistEntryResult =
  | { ok: true }
  | { ok: false; error: "DUPLICATE"; message: string };

export async function createWaitlistEntry(
  email: string,
  type: "free" | "deposit",
  opts?: { stripeCustomerId?: string | null },
): Promise<CreateWaitlistEntryResult> {
  const onClerk = await checkAlreadyOnClerk(email);
  const onResend = await checkAlreadyOnResend(email);

  if (onClerk && onResend && type === "free") {
    return { ok: false, error: "DUPLICATE", message: DUPLICATE_MESSAGE };
  }

  if (!onClerk) {
    await clerkClient.waitlistEntries.create({ emailAddress: email });
  }

  let resendContactId: string | null = null;
  if (!onResend) {
    const contact = await resend.contacts.create({
      email,
      audienceId: env.RESEND_AUDIENCE_ID,
    });
    resendContactId = contact.data?.id ?? null;
  }

  const stripeCustomerId = opts?.stripeCustomerId ?? null;

  await db
    .insert(waitlister)
    .values({
      email,
      type,
      ...(resendContactId && { resendContactId }),
      ...(stripeCustomerId && { stripeCustomerId }),
    })
    .onConflictDoUpdate({
      target: waitlister.email,
      set: {
        ...(type === "deposit" && { type: "deposit" as const }),
        ...(resendContactId && { resendContactId }),
        ...(stripeCustomerId && { stripeCustomerId }),
      },
    });

  return { ok: true };
}

export const waitlistRouter = createTRPCRouter({
  deposit: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const [existing] = await db
        .select()
        .from(waitlister)
        .where(eq(waitlister.email, input.email))
        .limit(1);
      if (existing?.type === "deposit") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email already has a deposit.",
        });
      }

      let customerId: string | undefined;
      if (existing?.stripeCustomerId) {
        customerId = existing.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: input.email,
          metadata: {
            source: "waitlist",
          },
        });
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [{ price: env.STRIPE_WAITLIST_DEPOSIT_PRICE_ID, quantity: 1 }],
        metadata: { email: input.email },
        payment_intent_data: {
          setup_future_usage: "off_session",
        },
        success_url: `${getBaseUrl()}/waitlist/success?email=${input.email}`,
        cancel_url: getBaseUrl(),
      });

      return { checkoutUrl: session.url };
    }),

  join: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const result = await createWaitlistEntry(input.email, "free");
      if (!result.ok) {
        throw new TRPCError({
          code: "CONFLICT",
          message: result.message,
        });
      }
      return { ok: true };
    }),
});

async function checkAlreadyOnResend(email: string) {
  const existing = await resend.contacts.list({ audienceId: env.RESEND_AUDIENCE_ID });
  return existing.data?.data?.some((contact) => contact.email === email) ?? false;
}

export async function checkAlreadyOnClerk(email: string) {
  const existing = await clerkClient.waitlistEntries.list();
  return existing.data.some((entry) => entry.emailAddress === email);
}
