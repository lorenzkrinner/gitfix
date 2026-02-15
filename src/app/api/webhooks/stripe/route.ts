import { type NextRequest, NextResponse } from "next/server";

import { stripe } from "~/lib/stripe/stripe";
import { env } from "~/env";
import { extractCustomerIdFromEvent, syncStripeData } from "~/lib/stripe/sync";
import { createWaitlistEntry } from "~/server/api/routers/waitlist";
import type Stripe from "stripe";

const ALLOWED_EVENTS: Stripe.Event.Type[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.upcoming",
  "invoice.marked_uncollectible",
  "invoice.payment_succeeded",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "payment_method.attached",
  "payment_method.detached",
  "payment_method.automatically_updated",
  "payment_method.updated",
  "charge.succeeded",
];

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!ALLOWED_EVENTS.includes(event.type)) {
    return NextResponse.json({ received: true });
  }

  console.log("Received", event.type, "event");

  const customerId = extractCustomerIdFromEvent(event);
  let email: string | undefined;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    email = session.customer_email ?? session.metadata?.email;

    if (!email) {
      console.error("No email in checkout session metadata");
      return NextResponse.json(
        { error: "No email in metadata" },
        { status: 400 },
      );
    }

    const result = await createWaitlistEntry(email, "deposit", {
      stripeCustomerId: customerId ?? undefined,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: 409 },
      );
    }
  }

  if (customerId) {
    try {
      await syncStripeData(customerId, email);
    } catch (error) {
      console.error("Failed to sync Stripe data:", error);
    }
  } else {
    console.error("No customer ID found in event");
  }

  return NextResponse.json({ received: true });
}
