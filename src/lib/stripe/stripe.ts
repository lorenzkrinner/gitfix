import Stripe from "stripe";
import { env } from "~/env";

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

export const stripe =
  globalForStripe.stripe ?? new Stripe(env.STRIPE_SECRET_KEY);
if (env.NODE_ENV !== "production") globalForStripe.stripe = stripe;
