import { pgTable, text, serial, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export * from "./models/auth";

export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  os: text("os").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  icon: text("icon").notNull(),
  compliance: text("compliance").notNull(),
  features: text("features").array().notNull(),
  priceCents: integer("price_cents").notNull().default(50000),
  monthlyPriceCents: integer("monthly_price_cents").notNull().default(10000),
  bundledScriptIds: integer("bundled_script_ids").array(),
  isHidden: integer("is_hidden").default(0),
  status: text("status").notNull().default("active"),
});

export const updateScriptSchema = z.object({
  name: z.string().min(1).optional(),
  monthlyPriceCents: z.number().int().min(0).optional(),
  status: z.enum(["active", "offline", "maintenance"]).optional(),
});

export const insertScriptSchema = createInsertSchema(scripts).omit({ id: true });

export type Script = typeof scripts.$inferSelect;
export type InsertScript = z.infer<typeof insertScriptSchema>;

// Script controls table - stores individual security controls that can be added to scripts
export const scriptControls = pgTable("script_controls", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").notNull(),
  controlId: varchar("control_id", { length: 50 }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  reference: text("reference").notNull(),
  code: text("code").notNull(),
  enabled: integer("enabled").notNull().default(1),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const scriptControlsRelations = relations(scriptControls, ({ one }) => ({
  script: one(scripts, {
    fields: [scriptControls.scriptId],
    references: [scripts.id],
  }),
}));

export const insertScriptControlSchema = createInsertSchema(scriptControls).omit({ id: true, addedAt: true });

export type ScriptControl = typeof scriptControls.$inferSelect;
export type InsertScriptControl = z.infer<typeof insertScriptControlSchema>;

// Purchases table - tracks which users have bought which scripts
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  scriptId: integer("script_id").notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  purchaseType: text("purchase_type").notNull().default("direct"),
  expiresAt: timestamp("expires_at"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
});

export const purchasesRelations = relations(purchases, ({ one }) => ({
  script: one(scripts, {
    fields: [purchases.scriptId],
    references: [scripts.id],
  }),
}));

export const insertPurchaseSchema = createInsertSchema(purchases).omit({ id: true, purchasedAt: true });

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;

// Contact requests table
export const contactRequests = pgTable("contact_requests", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number").notNull(),
  userId: varchar("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status").notNull().default("pending"),
});

export const insertContactRequestSchema = createInsertSchema(contactRequests).omit({ id: true, ticketNumber: true, createdAt: true, status: true });

export type ContactRequest = typeof contactRequests.$inferSelect;
export type InsertContactRequest = z.infer<typeof insertContactRequestSchema>;

// Invoices table - tracks customer invoices
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  userId: varchar("user_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerAddress: text("customer_address"),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  taxRate: integer("tax_rate").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoicesRelations = relations(invoices, ({ many }) => ({
  items: many(invoiceItems),
}));

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export const updateInvoiceSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  customerAddress: z.string().optional(),
  taxRate: z.number().int().min(0).max(100).optional(),
  status: z.enum(["draft", "sent", "paid", "cancelled", "overdue"]).optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// Invoice items table - line items for each invoice
export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  scriptId: integer("script_id"),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
});

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  script: one(scripts, {
    fields: [invoiceItems.scriptId],
    references: [scripts.id],
  }),
}));

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true });

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;

// Annual bundles table - multi-toolkit packages with discounts
export const annualBundles = pgTable("annual_bundles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  includedScriptIds: integer("included_script_ids").array().notNull(),
  discountPercent: integer("discount_percent").notNull().default(10),
  isActive: integer("is_active").notNull().default(1),
});

export const insertAnnualBundleSchema = createInsertSchema(annualBundles).omit({ id: true });

export const updateAnnualBundleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  includedScriptIds: z.array(z.number()).optional(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});

export type AnnualBundle = typeof annualBundles.$inferSelect;
export type InsertAnnualBundle = z.infer<typeof insertAnnualBundleSchema>;
export type UpdateAnnualBundle = z.infer<typeof updateAnnualBundleSchema>;
