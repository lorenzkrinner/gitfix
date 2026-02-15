import { TRPCError } from "@trpc/server";
import { createClerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { waitlister } from "~/server/db/tables/waitlister";
import { stripe } from "~/lib/stripe/stripe";
import { loops } from "~/lib/email/loops";
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
  const onLoops = await checkAlreadyOnLoops(email);

  if (onClerk && onLoops && type === "free") {
    return { ok: false, error: "DUPLICATE", message: DUPLICATE_MESSAGE };
  }

  if (!onClerk) {
    await clerkClient.waitlistEntries.create({ emailAddress: email });
  }
  
  let loopsContactId: string | null = null;
  if (!onLoops) {
    const loopsResp = await loops.createContact({
      email,
      properties: { source: "waitlist" },
    });
    loopsContactId = loopsResp.id;
  }


  const stripeCustomerId = opts?.stripeCustomerId ?? null;

  if (type === "deposit") {
    await db
      .insert(waitlister)
      .values({
        email,
        type: "deposit",
        ...(loopsContactId && { loopsContactId }),
        ...(stripeCustomerId && { stripeCustomerId }),
      })
      .onConflictDoUpdate({
        target: waitlister.email,
        set: {
          type: "deposit",
          ...(loopsContactId && { loopsContactId }),
          ...(stripeCustomerId && { stripeCustomerId }),
        },
      });
  } else {
    await db.insert(waitlister).values({
      email,
      type: "free",
      ...(loopsContactId && { loopsContactId }),
      ...(stripeCustomerId && { stripeCustomerId }),
    });
  }

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
          }
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

async function checkAlreadyOnLoops(email: string) {
  const existing = await loops.findContact({ email });
  return existing.length > 0;
}

export async function checkAlreadyOnClerk(email: string) {
  const existing = await clerkClient.waitlistEntries.list();
  return existing.data.some((entry) => entry.emailAddress === email);
}