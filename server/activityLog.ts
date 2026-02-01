import { db } from "./db";
import { activityLogs } from "@shared/schema";
import type { Request } from "express";

export type LogCategory = "auth" | "payment" | "admin" | "fleet" | "system" | "user";
export type LogSeverity = "info" | "warning" | "error" | "critical";

interface LogOptions {
  category: LogCategory;
  action: string;
  description: string;
  userId?: number;
  userEmail?: string;
  metadata?: Record<string, any>;
  severity?: LogSeverity;
  req?: Request;
}

export async function logActivity(options: LogOptions): Promise<void> {
  try {
    const { category, action, description, userId, userEmail, metadata, severity = "info", req } = options;
    
    await db.insert(activityLogs).values({
      category,
      action,
      description,
      userId: userId || null,
      userEmail: userEmail || null,
      ipAddress: req ? (req.headers["x-forwarded-for"] as string || req.ip || null) : null,
      userAgent: req ? (req.headers["user-agent"] || null) : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      severity,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export async function logAuth(action: string, description: string, userId?: number, userEmail?: string, req?: Request, metadata?: Record<string, any>) {
  return logActivity({ category: "auth", action, description, userId, userEmail, req, metadata });
}

export async function logPayment(action: string, description: string, userId?: number, userEmail?: string, req?: Request, metadata?: Record<string, any>) {
  return logActivity({ category: "payment", action, description, userId, userEmail, req, metadata });
}

export async function logAdmin(action: string, description: string, userId?: number, userEmail?: string, req?: Request, metadata?: Record<string, any>) {
  return logActivity({ category: "admin", action, description, userId, userEmail, req, metadata });
}

export async function logFleet(action: string, description: string, userId?: number, userEmail?: string, req?: Request, metadata?: Record<string, any>) {
  return logActivity({ category: "fleet", action, description, userId, userEmail, req, metadata });
}

export async function logSystem(action: string, description: string, severity: LogSeverity = "info", metadata?: Record<string, any>) {
  return logActivity({ category: "system", action, description, severity, metadata });
}

export async function logUser(action: string, description: string, userId?: number, userEmail?: string, req?: Request, metadata?: Record<string, any>) {
  return logActivity({ category: "user", action, description, userId, userEmail, req, metadata });
}
