import { pgTable, text, serial, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
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
  version: text("version").notNull().default("1.0.0"),
  deletedAt: timestamp("deleted_at"),
});

// Script versions table - tracks version history and update changelogs
export const scriptVersions = pgTable("script_versions", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").notNull(),
  version: text("version").notNull(),
  previousVersion: text("previous_version"),
  changeType: text("change_type").notNull(), // "controls_added", "controls_removed", "major_update", "minor_update", "patch"
  changesSummary: text("changes_summary").notNull(),
  controlsAdded: integer("controls_added").default(0),
  controlsRemoved: integer("controls_removed").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scriptVersionsRelations = relations(scriptVersions, ({ one }) => ({
  script: one(scripts, {
    fields: [scriptVersions.scriptId],
    references: [scripts.id],
  }),
}));

export const insertScriptVersionSchema = createInsertSchema(scriptVersions).omit({ id: true, createdAt: true });

export type ScriptVersion = typeof scriptVersions.$inferSelect;
export type InsertScriptVersion = z.infer<typeof insertScriptVersionSchema>;

export const updateScriptSchema = z.object({
  name: z.string().min(1).optional(),
  monthlyPriceCents: z.number().int().min(0).optional(),
  status: z.enum(["active", "offline", "maintenance", "development"]).optional(),
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

// Teams table - for users to create and manage their security audit teams
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: varchar("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
}));

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

// Team members table - users belonging to a team
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true, joinedAt: true });

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

// User groups table - groups of team members for easier permission management
export const userGroups = pgTable("user_groups", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userGroupsRelations = relations(userGroups, ({ one, many }) => ({
  team: one(teams, {
    fields: [userGroups.teamId],
    references: [teams.id],
  }),
  members: many(userGroupMembers),
}));

export const insertUserGroupSchema = createInsertSchema(userGroups).omit({ id: true, createdAt: true });
export type UserGroup = typeof userGroups.$inferSelect;
export type InsertUserGroup = z.infer<typeof insertUserGroupSchema>;

// User group members - links team members to user groups
export const userGroupMembers = pgTable("user_group_members", {
  id: serial("id").primaryKey(),
  userGroupId: integer("user_group_id").notNull(),
  teamMemberId: integer("team_member_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userGroupMembersRelations = relations(userGroupMembers, ({ one }) => ({
  userGroup: one(userGroups, {
    fields: [userGroupMembers.userGroupId],
    references: [userGroups.id],
  }),
  teamMember: one(teamMembers, {
    fields: [userGroupMembers.teamMemberId],
    references: [teamMembers.id],
  }),
}));

export const insertUserGroupMemberSchema = createInsertSchema(userGroupMembers).omit({ id: true, createdAt: true });
export type UserGroupMember = typeof userGroupMembers.$inferSelect;
export type InsertUserGroupMember = z.infer<typeof insertUserGroupMemberSchema>;

// Organizations table - top level of hierarchy
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  team: one(teams, {
    fields: [organizations.teamId],
    references: [teams.id],
  }),
  sites: many(sites),
}));

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true });
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

// Sites table - second level of hierarchy
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  name: text("name").notNull(),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sitesRelations = relations(sites, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sites.organizationId],
    references: [organizations.id],
  }),
  machineGroups: many(machineGroups),
}));

export const insertSiteSchema = createInsertSchema(sites).omit({ id: true, createdAt: true });
export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;

// Machine groups table - third level of hierarchy
export const machineGroups = pgTable("machine_groups", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const machineGroupsRelations = relations(machineGroups, ({ one, many }) => ({
  site: one(sites, {
    fields: [machineGroups.siteId],
    references: [sites.id],
  }),
  machines: many(machines),
}));

export const insertMachineGroupSchema = createInsertSchema(machineGroups).omit({ id: true, createdAt: true });
export type MachineGroup = typeof machineGroups.$inferSelect;
export type InsertMachineGroup = z.infer<typeof insertMachineGroupSchema>;

// Machine group permissions - granular access control for team members or user groups
export const machineGroupPermissions = pgTable("machine_group_permissions", {
  id: serial("id").primaryKey(),
  teamMemberId: integer("team_member_id"), // Optional - permission for individual member
  userGroupId: integer("user_group_id"), // Optional - permission for entire user group
  groupId: integer("group_id").notNull(), // The machine group this permission applies to
  canView: boolean("can_view").notNull().default(true),
  canEdit: boolean("can_edit").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const machineGroupPermissionsRelations = relations(machineGroupPermissions, ({ one }) => ({
  teamMember: one(teamMembers, {
    fields: [machineGroupPermissions.teamMemberId],
    references: [teamMembers.id],
  }),
  userGroup: one(userGroups, {
    fields: [machineGroupPermissions.userGroupId],
    references: [userGroups.id],
  }),
  group: one(machineGroups, {
    fields: [machineGroupPermissions.groupId],
    references: [machineGroups.id],
  }),
}));

export const insertMachineGroupPermissionSchema = createInsertSchema(machineGroupPermissions).omit({ id: true, createdAt: true });
export type MachineGroupPermission = typeof machineGroupPermissions.$inferSelect;
export type InsertMachineGroupPermission = z.infer<typeof insertMachineGroupPermissionSchema>;

// Machines table - tracks registered machines for fleet management
export const machines = pgTable("machines", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  groupId: integer("group_id"), // Optional link to machine group hierarchy
  hostname: text("hostname").notNull(),
  machineId: text("machine_id"), // Unique identifier from the machine (UUID, serial, etc.)
  os: text("os").notNull(), // windows, linux, vmware, docker, netapp, web
  osVersion: text("os_version"),
  lastAuditDate: timestamp("last_audit_date"),
  lastScore: integer("last_score"),
  originalScore: integer("original_score"), // First audit score (never changes after first upload)
  lastGrade: text("last_grade"),
  totalAudits: integer("total_audits").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const machinesRelations = relations(machines, ({ one, many }) => ({
  team: one(teams, {
    fields: [machines.teamId],
    references: [teams.id],
  }),
  group: one(machineGroups, {
    fields: [machines.groupId],
    references: [machineGroups.id],
  }),
  auditReports: many(auditReports),
}));

export const insertMachineSchema = createInsertSchema(machines).omit({ id: true, createdAt: true, updatedAt: true });

export type Machine = typeof machines.$inferSelect;
export type InsertMachine = z.infer<typeof insertMachineSchema>;

// Audit reports table - stores uploaded audit reports for each machine
export const auditReports = pgTable("audit_reports", {
  id: serial("id").primaryKey(),
  machineId: integer("machine_id").notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  auditDate: timestamp("audit_date").notNull(),
  scriptName: text("script_name"),
  scriptVersion: text("script_version"),
  score: integer("score").notNull(),
  originalScore: integer("original_score"), // Score before any corrections
  grade: text("grade"),
  totalControls: integer("total_controls").notNull().default(0),
  passedControls: integer("passed_controls").notNull().default(0),
  failedControls: integer("failed_controls").notNull().default(0),
  warningControls: integer("warning_controls").notNull().default(0),
  jsonContent: text("json_content"), // Full JSON report stored as text
  htmlContent: text("html_content"), // Full HTML report stored as text
  fileName: text("file_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditReportsRelations = relations(auditReports, ({ one }) => ({
  machine: one(machines, {
    fields: [auditReports.machineId],
    references: [machines.id],
  }),
}));

export const insertAuditReportSchema = createInsertSchema(auditReports).omit({ id: true, createdAt: true });

export type AuditReport = typeof auditReports.$inferSelect;
export type InsertAuditReport = z.infer<typeof insertAuditReportSchema>;

// Control corrections table - stores user corrections/overrides for individual controls in audit reports
export const controlCorrections = pgTable("control_corrections", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull(),
  controlId: varchar("control_id", { length: 100 }).notNull(),
  originalStatus: varchar("original_status", { length: 20 }).notNull(),
  correctedStatus: varchar("corrected_status", { length: 20 }).notNull(),
  justification: text("justification").notNull(),
  correctedBy: varchar("corrected_by").notNull(),
  correctedAt: timestamp("corrected_at").defaultNow().notNull(),
});

export const controlCorrectionsRelations = relations(controlCorrections, ({ one }) => ({
  report: one(auditReports, {
    fields: [controlCorrections.reportId],
    references: [auditReports.id],
  }),
}));

export const insertControlCorrectionSchema = createInsertSchema(controlCorrections).omit({ id: true, correctedAt: true });

export type ControlCorrection = typeof controlCorrections.$inferSelect;
export type InsertControlCorrection = z.infer<typeof insertControlCorrectionSchema>;

// Activity logs table for tracking site events
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // auth, payment, admin, fleet, system, user
  action: text("action").notNull(), // login, logout, purchase, delete, create, update, etc.
  description: text("description").notNull(),
  userId: integer("user_id"),
  userEmail: text("user_email"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata"), // JSON string for additional data
  severity: text("severity").notNull().default("info"), // info, warning, error, critical
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Support tickets table
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"), // open, in_progress, resolved, closed
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  category: text("category").notNull().default("general"), // general, billing, technical, feature_request
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true, closedAt: true });

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

// Ticket messages table
export const ticketMessages = pgTable("ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  isAdminReply: integer("is_admin_reply").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTicketMessageSchema = createInsertSchema(ticketMessages).omit({ id: true, createdAt: true });

export type TicketMessage = typeof ticketMessages.$inferSelect;
export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
