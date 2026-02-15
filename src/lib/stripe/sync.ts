import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";

import { stripe } from "~/lib/stripe/stripe";
import { db } from "~/server/db";
import { waitlister } from "~/server/db/tables/waitlister";

export async function syncStripeData(stripeCustomerId: string, email?: string) {
  const customer = await stripe.customers.retrieve(stripeCustomerId);

  if (customer.deleted) return;

  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card",
    limit: 1,
  });

  const paymentMethod = paymentMethods.data[0];

  if (!paymentMethod?.card) {
    console.log("No payment method found for customer", stripeCustomerId);
    return;
  };

  const where = and(
    ...(email ? [eq(waitlister.email, email)] : []),
    ...(stripeCustomerId ? [eq(waitlister.stripeCustomerId, stripeCustomerId)] : []),
  )

  await db
    .update(waitlister)
    .set({
      stripeCustomerId: stripeCustomerId,
      paymentMethodLast4: paymentMethod.card.last4,
      paymentMethodBrand: paymentMethod.card.brand,
      updatedAt: new Date(),
    })
    .where(where);
}

export function extractCustomerIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown;
  const typedObj = obj as { customer?: string | null; id?: string };

  if (typeof typedObj.customer === "string") {
    return typedObj.customer;
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    return typeof session.customer === "string" ? session.customer : null;
  }
  if (event.type.startsWith("customer.") && typeof typedObj.id === "string") {
    return typedObj.id;
  }

  if (
    event.type === "payment_method.detached" &&
    event.data.previous_attributes?.customer != null
  ) {
    const prev = event.data.previous_attributes.customer as string | null;
    return typeof prev === "string" ? prev : null;
  }
  return null;
}