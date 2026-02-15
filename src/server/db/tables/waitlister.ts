import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const waitlister = pgTable("waitlister", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  resendContactId: text("resend_contact_id"),
  stripeCustomerId: text("stripe_customer_id"),
  paymentMethodLast4: text("payment_method_last4"),
  paymentMethodBrand: text("payment_method_brand"),
  type: text("type", { enum: ["free", "deposit"] }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type Waitlister = typeof waitlister.$inferSelect;