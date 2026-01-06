import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { users } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

// Middleware to check if user is admin
const isAdmin = async (req: any, res: any, next: any) => {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = await authStorage.getUser(userId);
  if (!user?.isAdmin) {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication FIRST
  await setupAuth(app);
  registerAuthRoutes(app);

  // Initialize seed data
  await storage.seed();

  // Public routes
  app.get(api.scripts.list.path, async (req, res) => {
    const scripts = await storage.getScripts();
    res.json(scripts);
  });

  app.get(api.scripts.download.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const script = await storage.getScript(id);
    if (!script) {
      return res.status(404).json({ message: "Script not found" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${script.filename}"`);
    res.setHeader("Content-Type", "text/plain");
    res.send(script.content);
  });

  // Admin routes - return only necessary user fields
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
    }).from(users);
    res.json(allUsers);
  });

  app.patch("/api/admin/users/:id/toggle-admin", isAuthenticated, isAdmin, async (req, res) => {
    const userId = req.params.id;
    const requestingUserId = (req as any).user?.claims?.sub;

    // Prevent self-demotion
    if (userId === requestingUserId) {
      return res.status(400).json({ message: "Cannot modify your own admin status" });
    }

    // Use atomic update with NOT operator via raw SQL
    const [updated] = await db
      .update(users)
      .set({ 
        isAdmin: sql`NOT is_admin`,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
      });

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updated);
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    const userId = req.params.id;
    const requestingUserId = (req as any).user?.claims?.sub;

    // Prevent self-deletion
    if (userId === requestingUserId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    await db.delete(users).where(eq(users.id, userId));
    res.status(204).send();
  });

  // Purchase routes
  app.get("/api/purchases", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const userPurchases = await storage.getPurchasesByUser(userId);
    res.json(userPurchases);
  });

  app.post("/api/purchases", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const { scriptId, purchaseType } = req.body;

    if (!scriptId || typeof scriptId !== "number") {
      return res.status(400).json({ message: "Script ID is required" });
    }

    if (!purchaseType || !["direct", "monthly"].includes(purchaseType)) {
      return res.status(400).json({ message: "Purchase type must be 'direct' or 'monthly'" });
    }

    const script = await storage.getScript(scriptId);
    if (!script) {
      return res.status(404).json({ message: "Script not found" });
    }

    const existingPurchase = await storage.getActivePurchase(userId, scriptId);
    if (existingPurchase) {
      return res.status(400).json({ message: "You already have an active purchase for this script" });
    }

    const priceCents = purchaseType === "direct" ? script.priceCents : script.monthlyPriceCents;
    const expiresAt = purchaseType === "monthly" 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : null;

    const purchase = await storage.createPurchase({
      userId,
      scriptId,
      priceCents,
      purchaseType,
      expiresAt,
    });

    res.status(201).json(purchase);
  });

  app.get("/api/purchases/check/:scriptId", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const scriptId = parseInt(req.params.scriptId);

    if (isNaN(scriptId)) {
      return res.status(400).json({ message: "Invalid script ID" });
    }

    const activePurchase = await storage.getActivePurchase(userId, scriptId);
    res.json({ 
      hasPurchased: !!activePurchase,
      purchaseType: activePurchase?.purchaseType || null,
      expiresAt: activePurchase?.expiresAt || null,
    });
  });

  return httpServer;
}
