import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { users, purchases, scripts, registerSchema, loginSchema, contactRequests, insertContactRequestSchema, scriptControls, invoices, invoiceItems, updateInvoiceSchema } from "@shared/schema";
import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey, isStripeAvailable } from "./stripeClient";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import archiver from "archiver";
import { getControlsForToolkitOS, SecurityControl, StandardControls } from "./standards-controls";
import { sendInvoiceEmail } from "./email";

// Rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): { allowed: boolean; remainingTime?: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  
  if (!attempts) {
    return { allowed: true };
  }
  
  // Reset if lockout time has passed
  if (now - attempts.lastAttempt > LOCKOUT_TIME) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const remainingTime = Math.ceil((LOCKOUT_TIME - (now - attempts.lastAttempt)) / 1000 / 60);
    return { allowed: false, remainingTime };
  }
  
  return { allowed: true };
}

function recordLoginAttempt(ip: string, success: boolean) {
  if (success) {
    loginAttempts.delete(ip);
    return;
  }
  
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  
  if (!attempts || now - attempts.lastAttempt > LOCKOUT_TIME) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
  } else {
    loginAttempts.set(ip, { count: attempts.count + 1, lastAttempt: now });
  }
}

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
      // Rate limiting check
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        return res.status(429).json({ 
          message: `Trop de tentatives de connexion. Réessayez dans ${rateCheck.remainingTime} minutes.` 
        });
      }

      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }

      const { email, password } = result.data;

      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !user.password) {
        recordLoginAttempt(clientIp, false);
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        recordLoginAttempt(clientIp, false);
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      // Successful login - clear rate limiting
      recordLoginAttempt(clientIp, true);

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
    newPassword: z.string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
      .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
      .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
      .regex(/[!@#$%^&*(),.?":{}|<>]/, "Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...)"),
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

  app.get(api.scripts.all.path, async (req, res) => {
    const scripts = await storage.getScripts();
    res.json(scripts);
  });

  // Get dynamic controls count for all scripts
  app.get("/api/scripts/controls-count", async (req, res) => {
    try {
      const counts = await db
        .select({
          scriptId: scriptControls.scriptId,
          count: sql<number>`count(*)::int`
        })
        .from(scriptControls)
        .where(eq(scriptControls.enabled, 1))
        .groupBy(scriptControls.scriptId);
      
      const countMap: Record<number, number> = {};
      for (const row of counts) {
        countMap[row.scriptId] = row.count;
      }
      res.json(countMap);
    } catch (error) {
      console.error("Error fetching controls count:", error);
      res.json({});
    }
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

    // Check if script is in maintenance - block downloads
    if (script.status === "maintenance") {
      return res.status(503).json({ message: "Ce toolkit est actuellement en maintenance. Le téléchargement sera disponible prochainement." });
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

    // Handle bundle downloads - create a zip file with all bundled scripts
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
      
      // Create a zip file and send it
      const filename = `${script.name.toLowerCase().replace(/\s+/g, '-')}.zip`;
      
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/zip");
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Handle archive errors
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Erreur lors de la création de l'archive" });
        }
      });
      
      // Pipe the archive to the response
      archive.pipe(res);
      
      // Fetch controls added to the toolkit bundle itself
      const bundleControls = await db.select()
        .from(scriptControls)
        .where(and(
          eq(scriptControls.scriptId, id),
          eq(scriptControls.enabled, 1)
        ));
      
      // Add all bundled scripts to the archive with dynamic controls
      for (const bundledScript of bundledScripts) {
        if (bundledScript) {
          // Fetch controls for this specific script AND include bundle-level controls
          const scriptSpecificControls = await db.select()
            .from(scriptControls)
            .where(and(
              eq(scriptControls.scriptId, bundledScript.id),
              eq(scriptControls.enabled, 1)
            ));
          
          // Combine bundle-level and script-level controls
          const allControls = [...bundleControls, ...scriptSpecificControls];
          
          let finalContent = bundledScript.content;
          
          // Append dynamic controls if any exist
          if (allControls.length > 0) {
            const controlsSection = allControls.map(c => c.code).join('\n\n');
            const separator = bundledScript.filename.endsWith('.ps1') 
              ? '\n\n# ============================================\n# ADDITIONAL CONTROLS (Dynamically Added)\n# ============================================\n\n'
              : '\n\n# ============================================\n# ADDITIONAL CONTROLS (Dynamically Added)\n# ============================================\n\n';
            finalContent = bundledScript.content + separator + controlsSection;
          }
          
          archive.append(finalContent, { name: bundledScript.filename });
        }
      }
      
      // Finalize the archive (this will close the stream)
      archive.finalize();
      return;
    }

    // Fetch added controls for individual script downloads
    const addedControls = await db.select()
      .from(scriptControls)
      .where(and(
        eq(scriptControls.scriptId, id),
        eq(scriptControls.enabled, 1)
      ));
    
    let finalContent = script.content;
    
    // Append dynamic controls if any exist
    if (addedControls.length > 0) {
      const controlsSection = addedControls.map(c => c.code).join('\n\n');
      const separator = script.filename.endsWith('.ps1') 
        ? '\n\n# ============================================\n# ADDITIONAL CONTROLS (Dynamically Added)\n# ============================================\n\n'
        : '\n\n# ============================================\n# ADDITIONAL CONTROLS (Dynamically Added)\n# ============================================\n\n';
      finalContent = script.content + separator + controlsSection;
    }

    res.setHeader("Content-Disposition", `attachment; filename="${script.filename}"`);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(finalContent);
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
      const stripeReady = await isStripeAvailable();
      if (!stripeReady) {
        return res.json({ publishableKey: null, stripeConfigured: false });
      }
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key, stripeConfigured: true });
    } catch (error) {
      res.status(500).json({ message: "Stripe not configured" });
    }
  });

  app.post("/api/checkout", isAuthenticated, async (req, res) => {
    // Check if Stripe is available
    const stripeReady = await isStripeAvailable();
    if (!stripeReady) {
      return res.status(503).json({ message: "Les paiements ne sont pas encore configurés. Veuillez réessayer plus tard." });
    }

    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const { scriptId, purchaseType } = req.body;

    if (!scriptId || !purchaseType) {
      return res.status(400).json({ message: "Script ID and purchase type are required" });
    }

    const script = await storage.getScript(scriptId);
    if (!script) {
      return res.status(404).json({ message: "Script not found" });
    }

    // Check if script is offline - block purchases
    if (script.status === "offline") {
      return res.status(503).json({ message: "Ce toolkit n'est pas disponible à l'achat pour le moment." });
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
      if (!stripe) {
        return res.status(503).json({ message: "Les paiements ne sont pas encore configurés." });
      }
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
      if (!stripe) {
        return res.status(503).json({ message: "Les paiements ne sont pas configurés." });
      }
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

  // Admin: Update script/toolkit
  app.patch("/api/admin/scripts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, monthlyPriceCents, status } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (monthlyPriceCents !== undefined) updateData.monthlyPriceCents = monthlyPriceCents;
      if (status !== undefined) updateData.status = status;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }
      
      const [updated] = await db
        .update(scripts)
        .set(updateData)
        .where(eq(scripts.id, parseInt(id)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Script not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating script:", error);
      res.status(500).json({ message: "Error updating script" });
    }
  });

  // Admin: Check toolkit updates - analyze controls and suggest additions
  app.get("/api/admin/scripts/:id/check-updates", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const scriptId = parseInt(id);
      
      // Validate script ID
      if (isNaN(scriptId) || scriptId <= 0) {
        return res.status(400).json({ 
          message: "Invalid script ID",
          toolkit: null,
          standards: [],
          totalReferenceControls: 0,
          suggestions: [],
          analysisDate: new Date().toISOString()
        });
      }
      
      // Get the script/toolkit
      const [script] = await db.select().from(scripts).where(eq(scripts.id, scriptId));
      if (!script) {
        return res.status(404).json({ 
          message: "Script not found",
          toolkit: null,
          standards: [],
          totalReferenceControls: 0,
          suggestions: [],
          analysisDate: new Date().toISOString()
        });
      }
      
      // Only analyze bundles (not individual scripts)
      if (!script.bundledScriptIds || script.bundledScriptIds.length === 0) {
        return res.status(400).json({ 
          message: "Only bundles can be analyzed for updates",
          toolkit: { id: script.id, name: script.name, os: script.os || "Unknown", currentControlCount: 0 },
          standards: [],
          totalReferenceControls: 0,
          suggestions: [],
          analysisDate: new Date().toISOString()
        });
      }
      
      // Determine the OS/platform for this toolkit
      const os = script.os || "Linux";
      
      // Get reference controls for this platform
      const standardsControls = getControlsForToolkitOS(os);
      if (!standardsControls || standardsControls.length === 0) {
        return res.status(400).json({ 
          message: `No reference standards found for ${os}`,
          suggestions: []
        });
      }
      
      // Parse current controls from script description (simple heuristic)
      const currentDescription = script.description || "";
      const currentControlCount = parseInt(currentDescription.match(/~?(\d+)\s*controls?/i)?.[1] || "0");
      
      // Build suggestions based on reference controls
      const allControls: SecurityControl[] = [];
      const standards: { id: string; name: string; version: string }[] = [];
      
      for (const standard of standardsControls) {
        standards.push({
          id: standard.standardId,
          name: standard.standardName,
          version: standard.version
        });
        allControls.push(...standard.controls);
      }
      
      // Group controls by category
      const controlsByCategory: Record<string, SecurityControl[]> = {};
      for (const control of allControls) {
        if (!controlsByCategory[control.category]) {
          controlsByCategory[control.category] = [];
        }
        controlsByCategory[control.category].push(control);
      }
      
      // Generate suggestions (simulate AI analysis)
      const suggestions = [];
      let suggestionCount = 0;
      const maxSuggestions = 10;
      
      for (const [category, controls] of Object.entries(controlsByCategory)) {
        if (suggestionCount >= maxSuggestions) break;
        
        // Pick controls that could be new additions
        const criticalAndHigh = controls.filter(c => 
          c.severity === "critical" || c.severity === "high"
        );
        
        for (const control of criticalAndHigh.slice(0, 2)) {
          if (suggestionCount >= maxSuggestions) break;
          suggestions.push({
            id: control.id,
            name: control.name,
            description: control.description,
            category: control.category,
            severity: control.severity,
            reference: control.reference,
            implementationHint: control.implementationHint,
            recommended: control.severity === "critical"
          });
          suggestionCount++;
        }
      }
      
      res.json({
        toolkit: {
          id: script.id,
          name: script.name,
          os: os,
          currentControlCount
        },
        standards,
        totalReferenceControls: allControls.length,
        suggestions,
        analysisDate: new Date().toISOString(),
        message: suggestions.length > 0 
          ? `${suggestions.length} contrôles potentiels identifiés pour améliorer ce toolkit`
          : "Aucune suggestion de mise à jour identifiée"
      });
    } catch (error) {
      console.error("Error checking toolkit updates:", error);
      res.status(500).json({ message: "Error checking toolkit updates" });
    }
  });

  // Admin: Apply selected controls to a toolkit
  app.post("/api/admin/scripts/:id/apply-updates", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const scriptId = parseInt(id);
      const { controls } = req.body;
      
      // Validate inputs
      if (isNaN(scriptId) || scriptId <= 0) {
        return res.status(400).json({ message: "Invalid script ID" });
      }
      
      if (!controls || !Array.isArray(controls) || controls.length === 0) {
        return res.status(400).json({ message: "No controls provided" });
      }
      
      // Get the script/toolkit
      const [script] = await db.select().from(scripts).where(eq(scripts.id, scriptId));
      if (!script) {
        return res.status(404).json({ message: "Script not found" });
      }
      
      // Import control template generator
      const { generateControlCode } = await import("./control-templates");
      
      // Insert each control into the script_controls table
      const insertedControls = [];
      for (const control of controls) {
        // Check if control already exists for this script
        const [existing] = await db.select()
          .from(scriptControls)
          .where(and(
            eq(scriptControls.scriptId, scriptId),
            eq(scriptControls.controlId, control.id)
          ));
        
        if (existing) {
          continue; // Skip duplicates
        }
        
        // Generate code for this control
        const code = generateControlCode(
          control.id,
          control.name,
          control.description,
          control.category,
          control.severity,
          control.reference,
          script.os
        );
        
        // Insert the control
        const [inserted] = await db.insert(scriptControls).values({
          scriptId,
          controlId: control.id,
          name: control.name,
          description: control.description,
          category: control.category,
          severity: control.severity,
          reference: control.reference,
          code,
          enabled: 1,
        }).returning();
        
        insertedControls.push(inserted);
      }
      
      res.json({
        success: true,
        addedControls: insertedControls.length,
        skippedDuplicates: controls.length - insertedControls.length,
        toolkit: {
          id: script.id,
          name: script.name,
        },
        message: `${insertedControls.length} controle(s) ajoute(s) au toolkit ${script.name}`
      });
    } catch (error) {
      console.error("Error applying toolkit updates:", error);
      res.status(500).json({ message: "Error applying toolkit updates" });
    }
  });
  
  // Admin: Get controls for a script
  app.get("/api/admin/scripts/:id/controls", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const scriptId = parseInt(id);
      
      if (isNaN(scriptId) || scriptId <= 0) {
        return res.status(400).json({ message: "Invalid script ID" });
      }
      
      const controls = await db.select()
        .from(scriptControls)
        .where(eq(scriptControls.scriptId, scriptId))
        .orderBy(scriptControls.addedAt);
      
      res.json({ controls });
    } catch (error) {
      console.error("Error fetching script controls:", error);
      res.status(500).json({ message: "Error fetching script controls" });
    }
  });
  
  // Admin: Toggle control enabled/disabled
  app.patch("/api/admin/controls/:id/toggle", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const controlId = parseInt(id);
      
      if (isNaN(controlId) || controlId <= 0) {
        return res.status(400).json({ message: "Invalid control ID" });
      }
      
      const [control] = await db.select().from(scriptControls).where(eq(scriptControls.id, controlId));
      if (!control) {
        return res.status(404).json({ message: "Control not found" });
      }
      
      const [updated] = await db.update(scriptControls)
        .set({ enabled: control.enabled === 1 ? 0 : 1 })
        .where(eq(scriptControls.id, controlId))
        .returning();
      
      res.json({ control: updated });
    } catch (error) {
      console.error("Error toggling control:", error);
      res.status(500).json({ message: "Error toggling control" });
    }
  });
  
  // Admin: Delete a control
  app.delete("/api/admin/controls/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const controlId = parseInt(id);
      
      if (isNaN(controlId) || controlId <= 0) {
        return res.status(400).json({ message: "Invalid control ID" });
      }
      
      await db.delete(scriptControls).where(eq(scriptControls.id, controlId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting control:", error);
      res.status(500).json({ message: "Error deleting control" });
    }
  });

  // ==========================================
  // INVOICE MANAGEMENT ROUTES
  // ==========================================
  
  // Helper function to generate invoice number
  function generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `IST-${year}${month}-${random}`;
  }
  
  // Get all invoices (admin only)
  app.get("/api/admin/invoices", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allInvoices = await db.select().from(invoices).orderBy(sql`${invoices.createdAt} DESC`);
      res.json({ invoices: allInvoices });
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Error fetching invoices" });
    }
  });
  
  // Get single invoice with items
  app.get("/api/admin/invoices/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const invoiceId = parseInt(id);
      
      if (isNaN(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }
      
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      
      res.json({ invoice, items });
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Error fetching invoice" });
    }
  });
  
  // Create new invoice
  app.post("/api/admin/invoices", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { customerName, customerEmail, customerAddress, userId, items, taxRate = 20, notes, dueDate } = req.body;
      
      if (!customerName || !customerEmail || !userId) {
        return res.status(400).json({ message: "Customer name, email and user ID are required" });
      }
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "At least one item is required" });
      }
      
      // Calculate totals
      let subtotalCents = 0;
      const processedItems: Array<{ description: string; scriptId?: number; quantity: number; unitPriceCents: number; totalCents: number }> = [];
      
      for (const item of items) {
        const quantity = item.quantity || 1;
        const unitPriceCents = item.unitPriceCents;
        const totalCents = quantity * unitPriceCents;
        subtotalCents += totalCents;
        
        processedItems.push({
          description: item.description,
          scriptId: item.scriptId || null,
          quantity,
          unitPriceCents,
          totalCents
        });
      }
      
      const taxCents = Math.round(subtotalCents * taxRate / 100);
      const totalCents = subtotalCents + taxCents;
      
      // Create invoice
      const [newInvoice] = await db.insert(invoices).values({
        invoiceNumber: generateInvoiceNumber(),
        userId,
        customerName,
        customerEmail,
        customerAddress: customerAddress || null,
        subtotalCents,
        taxRate,
        taxCents,
        totalCents,
        status: "draft",
        notes: notes || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      }).returning();
      
      // Create invoice items
      for (const item of processedItems) {
        await db.insert(invoiceItems).values({
          invoiceId: newInvoice.id,
          scriptId: item.scriptId,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents
        });
      }
      
      res.json({ invoice: newInvoice });
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Error creating invoice" });
    }
  });
  
  // Update invoice
  app.patch("/api/admin/invoices/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const invoiceId = parseInt(id);
      
      if (isNaN(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }
      
      const validated = updateInvoiceSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ message: "Invalid data", errors: validated.error.flatten() });
      }
      
      const updateData: Record<string, unknown> = { ...validated.data, updatedAt: new Date() };
      
      // Handle date conversion
      if (updateData.dueDate && typeof updateData.dueDate === 'string') {
        updateData.dueDate = new Date(updateData.dueDate as string);
      }
      
      // Recalculate tax if taxRate changed
      if (updateData.taxRate !== undefined) {
        const [existingInvoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
        if (existingInvoice) {
          const taxCents = Math.round(existingInvoice.subtotalCents * (updateData.taxRate as number) / 100);
          updateData.taxCents = taxCents;
          updateData.totalCents = existingInvoice.subtotalCents + taxCents;
        }
      }
      
      // Handle status change to paid
      if (updateData.status === 'paid') {
        updateData.paidAt = new Date();
      }
      
      const [updated] = await db.update(invoices)
        .set(updateData)
        .where(eq(invoices.id, invoiceId))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // Send email when status changes to 'sent'
      if (updateData.status === 'sent') {
        try {
          const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
          
          await sendInvoiceEmail({
            invoiceNumber: updated.invoiceNumber,
            customerName: updated.customerName,
            customerEmail: updated.customerEmail,
            items: items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              totalCents: item.totalCents
            })),
            subtotalCents: updated.subtotalCents,
            taxRate: updated.taxRate,
            taxCents: updated.taxCents,
            totalCents: updated.totalCents,
            dueDate: updated.dueDate,
            notes: updated.notes
          });
          console.log(`Invoice ${updated.invoiceNumber} sent to ${updated.customerEmail}`);
        } catch (emailError) {
          console.error('Error sending invoice email:', emailError);
          // Don't fail the request, just log the error
        }
      }
      
      res.json({ invoice: updated });
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Error updating invoice" });
    }
  });
  
  // Delete invoice
  app.delete("/api/admin/invoices/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const invoiceId = parseInt(id);
      
      if (isNaN(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }
      
      // Delete items first
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      
      // Delete invoice
      await db.delete(invoices).where(eq(invoices.id, invoiceId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Error deleting invoice" });
    }
  });
  
  // Add item to invoice
  app.post("/api/admin/invoices/:id/items", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const invoiceId = parseInt(id);
      const { description, scriptId, quantity = 1, unitPriceCents } = req.body;
      
      if (isNaN(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }
      
      if (!description || unitPriceCents === undefined) {
        return res.status(400).json({ message: "Description and unit price are required" });
      }
      
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const totalCents = quantity * unitPriceCents;
      
      // Create item
      const [newItem] = await db.insert(invoiceItems).values({
        invoiceId,
        scriptId: scriptId || null,
        description,
        quantity,
        unitPriceCents,
        totalCents
      }).returning();
      
      // Update invoice totals
      const newSubtotal = invoice.subtotalCents + totalCents;
      const newTaxCents = Math.round(newSubtotal * invoice.taxRate / 100);
      const newTotal = newSubtotal + newTaxCents;
      
      await db.update(invoices)
        .set({
          subtotalCents: newSubtotal,
          taxCents: newTaxCents,
          totalCents: newTotal,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoiceId));
      
      res.json({ item: newItem });
    } catch (error) {
      console.error("Error adding invoice item:", error);
      res.status(500).json({ message: "Error adding invoice item" });
    }
  });
  
  // Delete item from invoice
  app.delete("/api/admin/invoices/:invoiceId/items/:itemId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { invoiceId, itemId } = req.params;
      const invId = parseInt(invoiceId);
      const itmId = parseInt(itemId);
      
      if (isNaN(invId) || invId <= 0 || isNaN(itmId) || itmId <= 0) {
        return res.status(400).json({ message: "Invalid IDs" });
      }
      
      const [item] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, itmId));
      if (!item || item.invoiceId !== invId) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // Delete item
      await db.delete(invoiceItems).where(eq(invoiceItems.id, itmId));
      
      // Update invoice totals
      const newSubtotal = invoice.subtotalCents - item.totalCents;
      const newTaxCents = Math.round(newSubtotal * invoice.taxRate / 100);
      const newTotal = newSubtotal + newTaxCents;
      
      await db.update(invoices)
        .set({
          subtotalCents: newSubtotal,
          taxCents: newTaxCents,
          totalCents: newTotal,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting invoice item:", error);
      res.status(500).json({ message: "Error deleting invoice item" });
    }
  });
  
  // Get users list for invoice creation
  app.get("/api/admin/users-list", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email
      }).from(users);
      res.json({ users: allUsers });
    } catch (error) {
      console.error("Error fetching users list:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  return httpServer;
}
