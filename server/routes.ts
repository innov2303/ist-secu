import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { users, purchases, registerSchema, loginSchema, contactRequests, insertContactRequestSchema } from "@shared/schema";
import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";

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

  // Local auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }

      const { email, password, firstName, lastName } = result.data;

      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "Un compte avec cet email existe déjà" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Check if this is the first user (make admin)
      const allUsers = await db.select().from(users).limit(1);
      const isFirstUser = allUsers.length === 0;

      // Create user
      const [newUser] = await db.insert(users).values({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        isAdmin: isFirstUser,
      }).returning();

      // Regenerate session to prevent session fixation attacks
      const session = req.session as any;
      session.regenerate((err: any) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Erreur lors de l'inscription" });
        }
        
        // Set userId on regenerated session
        (req as any).session.userId = newUser.id;
        (req as any).session.isLocalAuth = true;
        
        // Save session explicitly
        (req as any).session.save((saveErr: any) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Erreur lors de l'inscription" });
          }
          
          res.status(201).json({
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            isAdmin: newUser.isAdmin,
          });
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Erreur lors de l'inscription" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }

      const { email, password } = result.data;

      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      // Regenerate session to prevent session fixation attacks
      const session = req.session as any;
      session.regenerate((err: any) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Erreur lors de la connexion" });
        }
        
        // Set userId on regenerated session
        (req as any).session.userId = user.id;
        (req as any).session.isLocalAuth = true;
        
        // Save session explicitly
        (req as any).session.save((saveErr: any) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Erreur lors de la connexion" });
          }
          
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isAdmin: user.isAdmin,
            profileImageUrl: user.profileImageUrl,
          });
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erreur lors de la connexion" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const isLocalAuth = (req as any).session?.isLocalAuth;
    (req as any).session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Erreur lors de la déconnexion" });
      }
      // Clear the session cookie
      res.clearCookie('connect.sid');
      res.json({ success: true, isLocalAuth });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const isLocalAuth = !!(req as any).session?.isLocalAuth;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
      isAdmin: users.isAdmin,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({ ...user, isLocalAuth });
  });

  // Profile update routes
  const updateProfileSchema = z.object({
    firstName: z.string().min(1, "Prénom requis").optional(),
    lastName: z.string().optional(),
  });

  app.patch("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const result = updateProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }

      const { firstName, lastName } = result.data;
      
      const [updated] = await db
        .update(users)
        .set({ 
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
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
        });

      if (!updated) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Erreur lors de la mise à jour du profil" });
    }
  });

  const requestEmailChangeSchema = z.object({
    newEmail: z.string().email("Email invalide"),
    password: z.string().min(1, "Mot de passe requis pour changer l'email"),
  });

  app.post("/api/profile/request-email-change", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const result = requestEmailChangeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }

      const { newEmail, password } = result.data;

      // Get current user
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      // Check if user has a password (local auth only)
      if (!user.password) {
        return res.status(400).json({ message: "Le changement d'email n'est pas disponible pour les comptes Replit" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Mot de passe incorrect" });
      }

      // Check if new email is already in use
      const [existingUser] = await db.select().from(users).where(eq(users.email, newEmail)).limit(1);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: "Cet email est déjà utilisé" });
      }

      // Generate verification token
      const token = crypto.randomUUID();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save pending email change
      await db
        .update(users)
        .set({ 
          pendingEmail: newEmail,
          pendingEmailToken: token,
          pendingEmailExpires: expires,
          updatedAt: new Date() 
        })
        .where(eq(users.id, userId));

      // TODO: Send verification email when email service is configured
      // For now, just return success with a note
      res.json({ 
        message: "Demande de changement d'email enregistrée. La vérification par email sera disponible prochainement.",
        pendingEmail: newEmail,
        emailServiceConfigured: false
      });
    } catch (error) {
      console.error("Email change request error:", error);
      res.status(500).json({ message: "Erreur lors de la demande de changement d'email" });
    }
  });

  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères"),
  });

  app.post("/api/profile/change-password", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const result = changePasswordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }

      const { currentPassword, newPassword } = result.data;

      // Get current user
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      // Check if user has a password (local auth only)
      if (!user.password) {
        return res.status(400).json({ message: "Le changement de mot de passe n'est pas disponible pour les comptes Replit" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Mot de passe actuel incorrect" });
      }

      // Hash and save new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db
        .update(users)
        .set({ 
          password: hashedPassword,
          updatedAt: new Date() 
        })
        .where(eq(users.id, userId));

      res.json({ message: "Mot de passe modifié avec succès" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ message: "Erreur lors du changement de mot de passe" });
    }
  });

  // Initialize seed data and update scripts from files
  await storage.seed();
  await storage.updateScriptsFromFiles();

  // Public routes
  app.get(api.scripts.list.path, async (req, res) => {
    const scripts = await storage.getVisibleScripts();
    res.json(scripts);
  });

  app.get(api.scripts.download.path, isAuthenticated, async (req, res) => {
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentification requise" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID invalide" });
    }

    const script = await storage.getScript(id);
    if (!script) {
      return res.status(404).json({ message: "Script non trouvé" });
    }

    // Check if user is admin - admins have free access to all products
    const user = await authStorage.getUser(userId);
    if (!user?.isAdmin) {
      // Check if this is a bundle - if so, check bundle purchases
      let hasPurchased = false;
      if (script.bundledScriptIds && script.bundledScriptIds.length > 0) {
        hasPurchased = await storage.hasPurchasedBundle(userId, script.bundledScriptIds);
      } else {
        const activePurchase = await storage.getActivePurchase(userId, id);
        hasPurchased = !!activePurchase;
      }
      
      if (!hasPurchased) {
        return res.status(403).json({ message: "Vous devez acheter ce script pour le télécharger" });
      }
    }

    // Handle bundle downloads - combine all bundled scripts into one file
    if (script.bundledScriptIds && script.bundledScriptIds.length > 0) {
      const bundledScripts = await Promise.all(
        script.bundledScriptIds.map(id => storage.getScript(id))
      );
      
      // Validate all bundled scripts exist and have content
      const missingScripts = script.bundledScriptIds.filter(
        (id, index) => !bundledScripts[index]
      );
      if (missingScripts.length > 0) {
        console.error(`Bundle ${script.id} missing scripts: ${missingScripts.join(', ')}`);
        return res.status(500).json({ message: "Erreur lors de la préparation du téléchargement" });
      }
      
      const emptyScripts = bundledScripts.filter(s => s && (!s.content || s.content.trim() === ''));
      if (emptyScripts.length > 0) {
        console.error(`Bundle ${script.id} has empty script content: ${emptyScripts.map(s => s?.id).join(', ')}`);
        return res.status(500).json({ message: "Erreur lors de la préparation du téléchargement" });
      }
      
      const separator = script.os === "Windows" 
        ? "#".repeat(80) + "\n# " 
        : "#".repeat(80) + "\n# ";
      
      let combinedContent = "";
      for (const bundledScript of bundledScripts) {
        if (bundledScript) {
          combinedContent += `${separator}${bundledScript.name}\n# Fichier: ${bundledScript.filename}\n${"#".repeat(80)}\n\n`;
          combinedContent += bundledScript.content;
          combinedContent += "\n\n";
        }
      }
      
      const extension = (script.os === "Windows" || script.os === "VMware") ? "ps1" : "sh";
      const filename = `${script.name.toLowerCase().replace(/\s+/g, '-')}-combined.${extension}`;
      
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(combinedContent);
    }

    res.setHeader("Content-Disposition", `attachment; filename="${script.filename}"`);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
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
    const requestingUserId = (req as any).session?.userId || (req as any).user?.claims?.sub;

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
    const requestingUserId = (req as any).session?.userId || (req as any).user?.claims?.sub;

    // Prevent self-deletion
    if (userId === requestingUserId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    await db.delete(users).where(eq(users.id, userId));
    res.status(204).send();
  });

  // Purchase routes
  app.get("/api/purchases", isAuthenticated, async (req, res) => {
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const userPurchases = await storage.getPurchasesByUser(userId);
    res.json(userPurchases);
  });

  app.post("/api/purchases", isAuthenticated, async (req, res) => {
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
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
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const scriptId = parseInt(req.params.scriptId);

    if (isNaN(scriptId)) {
      return res.status(400).json({ message: "Invalid script ID" });
    }

    // Check if this is a bundle - if so, check if all bundled scripts are purchased
    const script = await storage.getScript(scriptId);
    if (script?.bundledScriptIds && script.bundledScriptIds.length > 0) {
      const hasPurchased = await storage.hasPurchasedBundle(userId, script.bundledScriptIds);
      // Get expiry from first bundled script
      const firstBundledPurchase = hasPurchased 
        ? await storage.getActivePurchase(userId, script.bundledScriptIds[0])
        : null;
      return res.json({ 
        hasPurchased,
        purchaseType: firstBundledPurchase?.purchaseType || null,
        expiresAt: firstBundledPurchase?.expiresAt || null,
      });
    }

    const activePurchase = await storage.getActivePurchase(userId, scriptId);
    res.json({ 
      hasPurchased: !!activePurchase,
      purchaseType: activePurchase?.purchaseType || null,
      expiresAt: activePurchase?.expiresAt || null,
    });
  });

  // Stripe checkout routes
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error) {
      res.status(500).json({ message: "Stripe not configured" });
    }
  });

  app.post("/api/checkout", isAuthenticated, async (req, res) => {
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const { scriptId, purchaseType } = req.body;

    if (!scriptId || !purchaseType) {
      return res.status(400).json({ message: "Script ID and purchase type are required" });
    }

    const script = await storage.getScript(scriptId);
    if (!script) {
      return res.status(404).json({ message: "Script not found" });
    }

    // Check if already purchased (including bundle check)
    if (script.bundledScriptIds && script.bundledScriptIds.length > 0) {
      const hasPurchased = await storage.hasPurchasedBundle(userId, script.bundledScriptIds);
      if (hasPurchased) {
        return res.status(400).json({ message: "You already have an active purchase for this bundle" });
      }
    } else {
      const existingPurchase = await storage.getActivePurchase(userId, scriptId);
      if (existingPurchase) {
        return res.status(400).json({ message: "You already have an active purchase for this script" });
      }
    }

    try {
      const stripe = await getUncachableStripeClient();
      const user = await authStorage.getUser(userId);

      let customerId = user?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user?.email || undefined,
          metadata: { userId },
        });
        customerId = customer.id;

        await db
          .update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, userId));
      }

      const stripePrices = await storage.getStripePricesForProduct(script.name);
      const priceId = purchaseType === "monthly" ? stripePrices.recurringPrice : stripePrices.oneTimePrice;
      
      if (!priceId) {
        console.error(`No Stripe price found for ${script.name} (${purchaseType})`);
        return res.status(500).json({ message: "Prix Stripe non configuré" });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const mode = purchaseType === "monthly" ? "subscription" : "payment";
      const priceAmount = purchaseType === "monthly" ? script.monthlyPriceCents : script.priceCents;

      const sessionParams: any = {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode,
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/checkout/cancel`,
        metadata: {
          userId,
          scriptId: script.id.toString(),
          purchaseType,
          priceCents: priceAmount.toString(),
        },
      };

      const session = await stripe.checkout.sessions.create(sessionParams);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Checkout error:', error);
      res.status(500).json({ message: "Error creating checkout session" });
    }
  });

  app.get("/api/checkout/success", isAuthenticated, async (req, res) => {
    const sessionId = req.query.session_id as string;
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID required" });
    }

    try {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.metadata?.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized session" });
      }

      if (session.payment_status === "paid" && session.metadata) {
        const { scriptId, purchaseType, priceCents } = session.metadata;
        const script = await storage.getScript(parseInt(scriptId));
        
        if (!script) {
          return res.status(404).json({ message: "Script not found" });
        }
        
        let subscriptionId: string | null = null;
        let paymentIntentId: string | null = null;
        
        if (session.subscription) {
          subscriptionId = typeof session.subscription === 'string' 
            ? session.subscription 
            : session.subscription.id;
        }
        
        if (session.payment_intent) {
          paymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent.id;
        }

        // Get expiresAt for monthly subscriptions
        let expiresAt: Date | null = null;
        if (purchaseType === "monthly" && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          if (subscription.current_period_end) {
            expiresAt = new Date(subscription.current_period_end * 1000);
          }
        }

        // Check if this is a bundle (has bundled script IDs)
        if (script.bundledScriptIds && script.bundledScriptIds.length > 0) {
          // Create purchases for all bundled scripts
          await storage.createPurchasesForBundle(
            userId,
            script,
            purchaseType,
            parseInt(priceCents || "0"),
            expiresAt,
            paymentIntentId || undefined,
            subscriptionId || undefined
          );
        } else {
          // Single script purchase
          const existing = await storage.getActivePurchase(userId, parseInt(scriptId));
          if (!existing) {
            await storage.createPurchase({
              userId,
              scriptId: parseInt(scriptId),
              priceCents: parseInt(priceCents || "0"),
              purchaseType,
              expiresAt,
              stripeSubscriptionId: subscriptionId,
              stripePaymentIntentId: paymentIntentId,
            });
          }
        }

        res.json({ success: true, scriptId: parseInt(scriptId) });
      } else {
        res.status(400).json({ message: "Payment not completed" });
      }
    } catch (error) {
      console.error('Checkout success error:', error);
      res.status(500).json({ message: "Error verifying payment" });
    }
  });

  // Contact request endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const result = insertContactRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }

      // Generate ticket number: IGS-YYYYMMDD-XXXX
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const ticketNumber = `IGS-${dateStr}-${randomSuffix}`;

      const [contactRequest] = await db.insert(contactRequests).values({
        ...result.data,
        ticketNumber,
      }).returning();
      res.status(201).json({ success: true, id: contactRequest.id, ticketNumber: contactRequest.ticketNumber });
    } catch (error) {
      console.error("Contact request error:", error);
      res.status(500).json({ message: "Erreur lors de l'envoi du message" });
    }
  });

  // Admin: Get all contact requests
  app.get("/api/admin/contact-requests", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const requests = await db.select().from(contactRequests).orderBy(sql`${contactRequests.createdAt} DESC`);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching contact requests:", error);
      res.status(500).json({ message: "Error fetching contact requests" });
    }
  });

  // Admin: Update contact request status
  app.patch("/api/admin/contact-requests/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const [updated] = await db
        .update(contactRequests)
        .set({ status })
        .where(eq(contactRequests.id, parseInt(id)))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating contact request:", error);
      res.status(500).json({ message: "Error updating contact request" });
    }
  });

  // Admin: Delete contact request
  app.delete("/api/admin/contact-requests/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.delete(contactRequests).where(eq(contactRequests.id, parseInt(id)));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact request:", error);
      res.status(500).json({ message: "Error deleting contact request" });
    }
  });

  return httpServer;
}
