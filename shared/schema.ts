import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  os: text("os").notNull(), // e.g., 'windows', 'linux', 'vmware', 'docker'
  name: text("name").notNull(),
  description: text("description").notNull(),
  filename: text("filename").notNull(),
  content: text("content").notNull(), // The actual script content
  icon: text("icon").notNull(), // Lucide icon name
  compliance: text("compliance").notNull().default("ANSSI & CIS"), // Standards mention
  features: text("features").array().notNull().default(["Scan complet", "Rapport détaillé", "Génération de graphiques", "Recommandations de corrections"]),
});

export const insertScriptSchema = createInsertSchema(scripts).omit({ id: true });

export type Script = typeof scripts.$inferSelect;
export type InsertScript = z.infer<typeof insertScriptSchema>;
