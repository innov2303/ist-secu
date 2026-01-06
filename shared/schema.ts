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
});

export const insertScriptSchema = createInsertSchema(scripts).omit({ id: true });

export type Script = typeof scripts.$inferSelect;
export type InsertScript = z.infer<typeof insertScriptSchema>;

// Purchases table - tracks which users have bought which scripts
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  scriptId: integer("script_id").notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  purchaseType: text("purchase_type").notNull().default("direct"),
  expiresAt: timestamp("expires_at"),
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
