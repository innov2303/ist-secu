import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { users, purchases, scripts, registerSchema, loginSchema, contactRequests, insertContactRequestSchema, scriptControls, invoices, invoiceItems, updateInvoiceSchema, updateAnnualBundleSchema, insertAnnualBundleSchema, annualBundles, scriptVersions, teams, teamMembers, insertTeamSchema, insertTeamMemberSchema, machines, auditReports, organizations, sites, machineGroups, insertOrganizationSchema, insertSiteSchema, insertMachineGroupSchema, controlCorrections, machineGroupPermissions, insertMachineGroupPermissionSchema } from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, desc, inArray } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey, isStripeAvailable } from "./stripeClient";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import archiver from "archiver";
import { getControlsForToolkitOS, SecurityControl, StandardControls } from "./standards-controls";
import { sendInvoiceEmail, sendPasswordResetEmail } from "./email";

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

      const { 
        email, password, firstName, lastName, 
        street, postalCode, city, 
        billingAddressSameAsAddress, billingStreet, billingPostalCode, billingCity 
      } = result.data;

      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "Un compte avec cet email existe deja" });
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
        street,
        postalCode,
        city,
        billingAddressSameAsAddress,
        billingStreet: billingAddressSameAsAddress ? street : billingStreet,
        billingPostalCode: billingAddressSameAsAddress ? postalCode : billingPostalCode,
        billingCity: billingAddressSameAsAddress ? city : billingCity,
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

  // Forgot password - request reset email
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email requis" });
      }

      // Find user by email
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      
      // Always return success to prevent email enumeration
      if (!user || !user.password) {
        // User doesn't exist or is OAuth user, but we don't reveal this
        return res.json({ success: true, message: "Si cette adresse email est associee a un compte, vous recevrez un email de reinitialisation." });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Save token to database
      await db.update(users)
        .set({ 
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires
        })
        .where(eq(users.id, user.id));

      // Build reset URL
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DEPLOYMENT_URL || 'http://localhost:5000';
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

      // Send email
      const emailResult = await sendPasswordResetEmail({
        email: user.email!,
        firstName: user.firstName || 'Utilisateur',
        resetUrl
      });

      if (!emailResult.success) {
        console.error("Failed to send password reset email:", emailResult.error);
        // Still return success to prevent information disclosure
      }

      res.json({ success: true, message: "Si cette adresse email est associee a un compte, vous recevrez un email de reinitialisation." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Erreur lors de la demande de reinitialisation" });
    }
  });

  // Reset password - set new password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: "Token invalide" });
      }

      if (!password || typeof password !== 'string') {
        return res.status(400).json({ message: "Mot de passe requis" });
      }

      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ 
          message: "Le mot de passe doit contenir au moins 8 caracteres, une majuscule, une minuscule, un chiffre et un caractere special" 
        });
      }

      // Find user by reset token
      const [user] = await db.select()
        .from(users)
        .where(eq(users.passwordResetToken, token))
        .limit(1);

      if (!user) {
        return res.status(400).json({ message: "Token invalide ou expire" });
      }

      // Check if token is expired
      if (!user.passwordResetExpires || new Date() > user.passwordResetExpires) {
        return res.status(400).json({ message: "Token expire. Veuillez faire une nouvelle demande de reinitialisation." });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Update password and clear reset token
      await db.update(users)
        .set({ 
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

      res.json({ success: true, message: "Mot de passe reinitialise avec succes" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Erreur lors de la reinitialisation du mot de passe" });
    }
  });

  // Verify reset token is valid
  app.get("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: "Token invalide" });
      }

      const [user] = await db.select({ id: users.id, passwordResetExpires: users.passwordResetExpires })
        .from(users)
        .where(eq(users.passwordResetToken, token))
        .limit(1);

      if (!user || !user.passwordResetExpires || new Date() > user.passwordResetExpires) {
        return res.status(400).json({ valid: false, message: "Token invalide ou expire" });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Verify reset token error:", error);
      res.status(500).json({ valid: false, message: "Erreur de verification" });
    }
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
      companyName: users.companyName,
      billingStreet: users.billingStreet,
      billingPostalCode: users.billingPostalCode,
      billingCity: users.billingCity,
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
    companyName: z.string().optional(),
    billingStreet: z.string().optional(),
    billingPostalCode: z.string().optional(),
    billingCity: z.string().optional(),
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

      const { firstName, lastName, companyName, billingStreet, billingPostalCode, billingCity } = result.data;
      
      const [updated] = await db
        .update(users)
        .set({ 
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
          ...(companyName !== undefined && { companyName }),
          ...(billingStreet !== undefined && { billingStreet }),
          ...(billingPostalCode !== undefined && { billingPostalCode }),
          ...(billingCity !== undefined && { billingCity }),
          updatedAt: new Date() 
        })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          companyName: users.companyName,
          billingStreet: users.billingStreet,
          billingPostalCode: users.billingPostalCode,
          billingCity: users.billingCity,
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

  // Get user's own invoices
  app.get("/api/my-invoices", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const userInvoices = await db
        .select()
        .from(invoices)
        .where(eq(invoices.userId, userId))
        .orderBy(sql`${invoices.createdAt} DESC`);

      res.json({ invoices: userInvoices });
    } catch (error) {
      console.error("Error fetching user invoices:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des factures" });
    }
  });

  // Get single invoice with items (user's own)
  app.get("/api/my-invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const { id } = req.params;
      const invoiceId = parseInt(id);

      if (isNaN(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({ message: "ID de facture invalide" });
      }

      const [invoice] = await db
        .select()
        .from(invoices)
        .where(sql`${invoices.id} = ${invoiceId} AND ${invoices.userId} = ${userId}`);

      if (!invoice) {
        return res.status(404).json({ message: "Facture non trouvée" });
      }

      const items = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId));

      res.json({ invoice, items });
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Erreur lors de la récupération de la facture" });
    }
  });

  // Initialize seed data and update scripts from files
  await storage.seed();
  await storage.updateScriptsFromFiles();
  await storage.seedAnnualBundles();

  // Public routes
  app.get(api.scripts.list.path, async (req, res) => {
    const scripts = await storage.getVisibleScripts();
    res.json(scripts);
  });

  app.get(api.scripts.all.path, async (req, res) => {
    const scripts = await storage.getScripts();
    res.json(scripts);
  });

  // Annual bundles routes
  app.get("/api/annual-bundles", async (req, res) => {
    try {
      const bundles = await storage.getAnnualBundles();
      res.json(bundles);
    } catch (error) {
      console.error("Error fetching annual bundles:", error);
      res.status(500).json({ message: "Error fetching bundles" });
    }
  });

  // Admin: Get all annual bundles (including inactive)
  app.get("/api/admin/annual-bundles", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const bundles = await storage.getAllAnnualBundles();
      res.json(bundles);
    } catch (error) {
      console.error("Error fetching all annual bundles:", error);
      res.status(500).json({ message: "Error fetching bundles" });
    }
  });

  // Admin: Update annual bundle
  app.patch("/api/admin/annual-bundles/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const bundleId = parseInt(req.params.id);
      const validatedData = updateAnnualBundleSchema.parse(req.body);
      
      const updated = await storage.updateAnnualBundle(bundleId, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Bundle not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating annual bundle:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating bundle" });
    }
  });

  // Admin: Create annual bundle
  app.post("/api/admin/annual-bundles", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validatedData = insertAnnualBundleSchema.parse(req.body);
      const newBundle = await storage.createAnnualBundle(validatedData);
      
      res.status(201).json(newBundle);
    } catch (error) {
      console.error("Error creating annual bundle:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating bundle" });
    }
  });

  // ===== TEAM MANAGEMENT ROUTES =====
  
  // Check if user has any active purchases (required to create a team)
  app.get("/api/teams/can-create", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Admin can always create teams
      const user = await authStorage.getUser(userId);
      if (user?.isAdmin) {
        return res.json({ canCreate: true });
      }
      
      // Check if user has at least one active purchase
      const userPurchases = await db.select().from(purchases).where(eq(purchases.userId, userId)).limit(1);
      const canCreate = userPurchases.length > 0;
      
      res.json({ canCreate });
    } catch (error) {
      console.error("Error checking team creation eligibility:", error);
      res.status(500).json({ message: "Erreur lors de la verification" });
    }
  });

  // Get user's team
  app.get("/api/teams/my-team", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      const [team] = await db.select().from(teams).where(eq(teams.ownerId, userId));
      if (!team) {
        return res.json({ team: null, members: [] });
      }
      
      const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, team.id));
      
      res.json({ team, members });
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation de l'equipe" });
    }
  });

  // Create a team
  app.post("/api/teams", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Check if user is admin or has at least one purchase
      const user = await authStorage.getUser(userId);
      if (!user?.isAdmin) {
        const userPurchases = await db.select().from(purchases).where(eq(purchases.userId, userId)).limit(1);
        if (userPurchases.length === 0) {
          return res.status(403).json({ message: "Vous devez avoir au moins un toolkit pour creer une equipe" });
        }
      }
      
      // Check if user already has a team
      const existingTeam = await db.select().from(teams).where(eq(teams.ownerId, userId)).limit(1);
      if (existingTeam.length > 0) {
        return res.status(400).json({ message: "Vous avez deja une equipe" });
      }
      
      const { name } = req.body;
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ message: "Le nom de l'equipe est requis" });
      }
      
      const [newTeam] = await db.insert(teams).values({
        name: name.trim(),
        ownerId: userId,
      }).returning();
      
      res.status(201).json(newTeam);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ message: "Erreur lors de la creation de l'equipe" });
    }
  });

  // Update team name
  app.patch("/api/teams/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const teamId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Verify ownership
      const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.ownerId, userId)));
      if (!team) {
        return res.status(404).json({ message: "Equipe non trouvee" });
      }
      
      const { name } = req.body;
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ message: "Le nom de l'equipe est requis" });
      }
      
      const [updated] = await db.update(teams).set({ name: name.trim() }).where(eq(teams.id, teamId)).returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating team:", error);
      res.status(500).json({ message: "Erreur lors de la mise a jour de l'equipe" });
    }
  });

  // Delete team
  app.delete("/api/teams/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const teamId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Verify ownership
      const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.ownerId, userId)));
      if (!team) {
        return res.status(404).json({ message: "Equipe non trouvee" });
      }
      
      // Delete all members first
      await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
      // Delete team
      await db.delete(teams).where(eq(teams.id, teamId));
      
      res.json({ message: "Equipe supprimee" });
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Erreur lors de la suppression de l'equipe" });
    }
  });

  // Add team member
  app.post("/api/teams/:id/members", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const teamId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Verify ownership
      const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.ownerId, userId)));
      if (!team) {
        return res.status(404).json({ message: "Equipe non trouvee" });
      }
      
      const { email, name, role } = req.body;
      if (!email || email.trim().length === 0) {
        return res.status(400).json({ message: "L'email est requis" });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: "Format d'email invalide" });
      }
      
      // Validate role
      const validRoles = ["member", "admin"];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ message: "Role invalide" });
      }
      
      // Check if member already exists
      const existingMember = await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.email, email.trim().toLowerCase()))).limit(1);
      if (existingMember.length > 0) {
        return res.status(400).json({ message: "Ce membre existe deja dans l'equipe" });
      }
      
      const [newMember] = await db.insert(teamMembers).values({
        teamId,
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        role: role || "member",
      }).returning();
      
      res.status(201).json(newMember);
    } catch (error) {
      console.error("Error adding team member:", error);
      res.status(500).json({ message: "Erreur lors de l'ajout du membre" });
    }
  });

  // Update team member
  app.patch("/api/teams/:teamId/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const teamId = parseInt(req.params.teamId);
      const memberId = parseInt(req.params.memberId);
      
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Verify ownership
      const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.ownerId, userId)));
      if (!team) {
        return res.status(404).json({ message: "Equipe non trouvee" });
      }
      
      const { name, role } = req.body;
      
      const [updated] = await db.update(teamMembers).set({
        name: name?.trim() || null,
        role: role || "member",
      }).where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId))).returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Membre non trouve" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating team member:", error);
      res.status(500).json({ message: "Erreur lors de la mise a jour du membre" });
    }
  });

  // Remove team member
  app.delete("/api/teams/:teamId/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const teamId = parseInt(req.params.teamId);
      const memberId = parseInt(req.params.memberId);
      
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Verify ownership
      const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.ownerId, userId)));
      if (!team) {
        return res.status(404).json({ message: "Equipe non trouvee" });
      }
      
      await db.delete(teamMembers).where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)));
      
      res.json({ message: "Membre supprime" });
    } catch (error) {
      console.error("Error removing team member:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du membre" });
    }
  });

  // Get permissions for a team member
  app.get("/api/teams/:teamId/members/:memberId/permissions", isAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const memberId = parseInt(req.params.memberId);
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Verify user owns the team
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team || team.ownerId !== userId) {
        return res.status(403).json({ message: "Acces refuse" });
      }
      
      // Verify member belongs to team
      const [member] = await db.select().from(teamMembers).where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId))).limit(1);
      if (!member) {
        return res.status(404).json({ message: "Membre non trouve" });
      }
      
      // Get all permissions for this member
      const permissions = await db.select().from(machineGroupPermissions).where(eq(machineGroupPermissions.teamMemberId, memberId));
      
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching member permissions:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation des permissions" });
    }
  });

  // Set permission for a team member on a machine group
  app.post("/api/teams/:teamId/members/:memberId/permissions", isAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const memberId = parseInt(req.params.memberId);
      const userId = req.user?.claims?.sub;
      const { groupId, canView, canEdit } = req.body;
      
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Verify user owns the team
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team || team.ownerId !== userId) {
        return res.status(403).json({ message: "Acces refuse" });
      }
      
      // Verify member belongs to team
      const [member] = await db.select().from(teamMembers).where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId))).limit(1);
      if (!member) {
        return res.status(404).json({ message: "Membre non trouve" });
      }
      
      // Verify group belongs to the team's hierarchy
      const [group] = await db.select().from(machineGroups).where(eq(machineGroups.id, groupId)).limit(1);
      if (!group) {
        return res.status(404).json({ message: "Groupe non trouve" });
      }
      
      // Verify group belongs to team via site -> organization chain
      const [site] = await db.select().from(sites).where(eq(sites.id, group.siteId)).limit(1);
      if (!site) {
        return res.status(404).json({ message: "Site non trouve" });
      }
      const [org] = await db.select().from(organizations).where(eq(organizations.id, site.organizationId)).limit(1);
      if (!org || org.teamId !== teamId) {
        return res.status(403).json({ message: "Groupe non autorise" });
      }
      
      // Check if permission already exists
      const [existing] = await db.select().from(machineGroupPermissions).where(and(eq(machineGroupPermissions.teamMemberId, memberId), eq(machineGroupPermissions.groupId, groupId))).limit(1);
      
      if (existing) {
        // Update existing permission
        const [updated] = await db.update(machineGroupPermissions).set({
          canView: canView !== undefined ? canView : existing.canView,
          canEdit: canEdit !== undefined ? canEdit : existing.canEdit,
        }).where(eq(machineGroupPermissions.id, existing.id)).returning();
        return res.json(updated);
      } else {
        // Create new permission
        const [newPerm] = await db.insert(machineGroupPermissions).values({
          teamMemberId: memberId,
          groupId,
          canView: canView !== undefined ? canView : true,
          canEdit: canEdit !== undefined ? canEdit : false,
        }).returning();
        return res.json(newPerm);
      }
    } catch (error) {
      console.error("Error setting member permission:", error);
      res.status(500).json({ message: "Erreur lors de la modification des permissions" });
    }
  });

  // Delete permission for a team member on a machine group
  app.delete("/api/teams/:teamId/members/:memberId/permissions/:permissionId", isAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const memberId = parseInt(req.params.memberId);
      const permissionId = parseInt(req.params.permissionId);
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Verify user owns the team
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team || team.ownerId !== userId) {
        return res.status(403).json({ message: "Acces refuse" });
      }
      
      // Verify member belongs to team
      const [member] = await db.select().from(teamMembers).where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId))).limit(1);
      if (!member) {
        return res.status(404).json({ message: "Membre non trouve" });
      }
      
      // Delete permission
      await db.delete(machineGroupPermissions).where(and(eq(machineGroupPermissions.id, permissionId), eq(machineGroupPermissions.teamMemberId, memberId)));
      
      res.json({ message: "Permission supprimee" });
    } catch (error) {
      console.error("Error deleting member permission:", error);
      res.status(500).json({ message: "Erreur lors de la suppression de la permission" });
    }
  });

  // Get all machine groups for a team (for permission selection)
  app.get("/api/teams/:teamId/machine-groups", isAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Verify user owns the team
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team || team.ownerId !== userId) {
        return res.status(403).json({ message: "Acces refuse" });
      }
      
      // Get all organizations for team
      const orgs = await db.select().from(organizations).where(eq(organizations.teamId, teamId));
      if (orgs.length === 0) {
        return res.json([]);
      }
      
      // Get all sites for these organizations
      const orgIds = orgs.map(o => o.id);
      const allSites = await db.select().from(sites).where(inArray(sites.organizationId, orgIds));
      if (allSites.length === 0) {
        return res.json([]);
      }
      
      // Get all machine groups for these sites
      const siteIds = allSites.map(s => s.id);
      const allGroups = await db.select().from(machineGroups).where(inArray(machineGroups.siteId, siteIds));
      
      // Return groups with hierarchy info
      const result = allGroups.map(group => {
        const site = allSites.find(s => s.id === group.siteId);
        const org = orgs.find(o => o.id === site?.organizationId);
        return {
          ...group,
          siteName: site?.name,
          organizationName: org?.name,
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching team machine groups:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation des groupes" });
    }
  });

  // Get team membership info for the current user (if they're a member of any team)
  app.get("/api/teams/my-membership", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Get user email
      const user = await authStorage.getUser(userId);
      if (!user?.email) {
        return res.json({ membership: null, team: null, owner: null });
      }
      
      // Check if user is a member of any team
      const [membership] = await db.select().from(teamMembers).where(eq(teamMembers.email, user.email.toLowerCase()));
      if (!membership) {
        return res.json({ membership: null, team: null, owner: null });
      }
      
      // Get team info
      const [team] = await db.select().from(teams).where(eq(teams.id, membership.teamId));
      if (!team) {
        return res.json({ membership: null, team: null, owner: null });
      }
      
      // Get owner info
      const owner = await authStorage.getUser(team.ownerId);
      
      res.json({ 
        membership, 
        team, 
        owner: owner ? { 
          id: owner.id, 
          firstName: owner.firstName, 
          lastName: owner.lastName, 
          email: owner.email,
          companyName: (owner as any).companyName 
        } : null 
      });
    } catch (error) {
      console.error("Error fetching team membership:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation" });
    }
  });

  // Get team owner's purchases for team members
  app.get("/api/teams/shared-purchases", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }
      
      // Get user email
      const user = await authStorage.getUser(userId);
      if (!user?.email) {
        return res.json({ purchases: [], isTeamMember: false });
      }
      
      // Check if user is a member of any team
      const [membership] = await db.select().from(teamMembers).where(eq(teamMembers.email, user.email.toLowerCase()));
      if (!membership) {
        return res.json({ purchases: [], isTeamMember: false });
      }
      
      // Get team info
      const [team] = await db.select().from(teams).where(eq(teams.id, membership.teamId));
      if (!team) {
        return res.json({ purchases: [], isTeamMember: false });
      }
      
      // Get owner's purchases
      const ownerPurchases = await storage.getPurchasesByUser(team.ownerId);
      
      res.json({ 
        purchases: ownerPurchases, 
        isTeamMember: true,
        teamName: team.name,
        memberRole: membership.role
      });
    } catch (error) {
      console.error("Error fetching shared purchases:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation" });
    }
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
      // Check if user has purchased this script/toolkit directly
      const activePurchase = await storage.getActivePurchase(userId, id);
      if (!activePurchase) {
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

  // Admin: Reset user password
  app.post("/api/admin/users/:id/reset-password", isAuthenticated, isAdmin, async (req, res) => {
    const userId = req.params.id;
    const requestingUserId = (req as any).session?.userId || (req as any).user?.claims?.sub;

    // Prevent self-reset (admin should use profile page)
    if (userId === requestingUserId) {
      return res.status(400).json({ message: "Utilisez la page profil pour changer votre mot de passe" });
    }

    // Check if user exists
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!targetUser) {
      return res.status(404).json({ message: "Utilisateur non trouve" });
    }

    // Check if user has a password (local auth)
    if (!targetUser.password) {
      return res.status(400).json({ message: "Cet utilisateur utilise l'authentification Replit, pas de mot de passe local" });
    }

    // Generate a random password (12 characters)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let newPassword = "";
    for (let i = 0; i < 12; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Hash and update
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

    // Clear any lockouts for this user
    loginAttempts.delete(targetUser.email || "");

    res.json({ 
      message: "Mot de passe reinitialise avec succes",
      newPassword,
      userEmail: targetUser.email 
    });
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

    // First, check if user has a direct purchase for this script (toolkit purchase)
    const activePurchase = await storage.getActivePurchase(userId, scriptId);
    if (activePurchase) {
      return res.json({ 
        hasPurchased: true,
        purchaseType: activePurchase.purchaseType || null,
        expiresAt: activePurchase.expiresAt || null,
      });
    }

    // If no direct purchase, check if this is a bundle and all bundled scripts are purchased individually
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

    res.json({ 
      hasPurchased: false,
      purchaseType: null,
      expiresAt: null,
    });
  });

  // Cancel subscription route
  app.post("/api/purchases/:purchaseId/cancel", isAuthenticated, async (req, res) => {
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const purchaseId = parseInt(req.params.purchaseId);

    if (isNaN(purchaseId)) {
      return res.status(400).json({ message: "Invalid purchase ID" });
    }

    try {
      // Get all purchases for this user to find the subscription
      const userPurchases = await storage.getPurchasesByUser(userId);
      const purchase = userPurchases.find(p => p.id === purchaseId);

      if (!purchase) {
        return res.status(404).json({ message: "Achat non trouve" });
      }

      if (purchase.purchaseType !== "monthly" && purchase.purchaseType !== "yearly") {
        return res.status(400).json({ message: "Cet achat n'est pas un abonnement" });
      }

      if (!purchase.stripeSubscriptionId) {
        return res.status(400).json({ message: "Aucun abonnement Stripe associe" });
      }

      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ message: "Les paiements ne sont pas encore configures." });
      }

      // Cancel the subscription at period end (won't renew)
      await stripe.subscriptions.update(purchase.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      res.json({ success: true, message: "L'abonnement ne sera pas renouvele automatiquement" });
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Erreur lors de l'annulation de l'abonnement" });
    }
  });

  // Cancel renewal alias (same as cancel, for frontend compatibility)
  app.post("/api/purchases/:purchaseId/cancel-renewal", isAuthenticated, async (req, res) => {
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const purchaseId = parseInt(req.params.purchaseId);

    if (isNaN(purchaseId)) {
      return res.status(400).json({ message: "Invalid purchase ID" });
    }

    try {
      const userPurchases = await storage.getPurchasesByUser(userId);
      const purchase = userPurchases.find(p => p.id === purchaseId);

      if (!purchase) {
        return res.status(404).json({ message: "Achat non trouve" });
      }

      // Support annual_bundle, monthly, and yearly subscriptions
      if (purchase.purchaseType !== "monthly" && purchase.purchaseType !== "yearly" && purchase.purchaseType !== "annual_bundle") {
        return res.status(400).json({ message: "Cet achat n'est pas un abonnement" });
      }

      if (!purchase.stripeSubscriptionId) {
        return res.status(400).json({ message: "Aucun abonnement Stripe associe" });
      }

      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ message: "Les paiements ne sont pas encore configures." });
      }

      await stripe.subscriptions.update(purchase.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      res.json({ success: true, message: "L'abonnement ne sera pas renouvele automatiquement" });
    } catch (error: any) {
      console.error("Error cancelling subscription renewal:", error);
      res.status(500).json({ message: "Erreur lors de l'annulation du renouvellement" });
    }
  });

  // Reactivate subscription (undo cancel at period end)
  app.post("/api/purchases/:purchaseId/reactivate", isAuthenticated, async (req, res) => {
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const purchaseId = parseInt(req.params.purchaseId);

    if (isNaN(purchaseId)) {
      return res.status(400).json({ message: "Invalid purchase ID" });
    }

    try {
      const userPurchases = await storage.getPurchasesByUser(userId);
      const purchase = userPurchases.find(p => p.id === purchaseId);

      if (!purchase) {
        return res.status(404).json({ message: "Achat non trouve" });
      }

      if (purchase.purchaseType !== "monthly" && purchase.purchaseType !== "yearly" && purchase.purchaseType !== "annual_bundle") {
        return res.status(400).json({ message: "Cet achat n'est pas un abonnement" });
      }

      if (!purchase.stripeSubscriptionId) {
        return res.status(400).json({ message: "Aucun abonnement Stripe associe" });
      }

      // Check if subscription is still valid (not expired)
      if (purchase.expiresAt && new Date(purchase.expiresAt) < new Date()) {
        return res.status(400).json({ message: "L'abonnement a expire, vous devez le renouveler" });
      }

      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ message: "Les paiements ne sont pas encore configures." });
      }

      // Reactivate the subscription (remove cancel at period end)
      await stripe.subscriptions.update(purchase.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      res.json({ success: true, message: "Le renouvellement automatique a ete reactive" });
    } catch (error: any) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ message: "Erreur lors de la reactivation de l'abonnement" });
    }
  });

  // Reactivate renewal alias (for frontend compatibility)
  app.post("/api/purchases/:purchaseId/reactivate-renewal", isAuthenticated, async (req, res) => {
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const purchaseId = parseInt(req.params.purchaseId);

    if (isNaN(purchaseId)) {
      return res.status(400).json({ message: "Invalid purchase ID" });
    }

    try {
      const userPurchases = await storage.getPurchasesByUser(userId);
      const purchase = userPurchases.find(p => p.id === purchaseId);

      if (!purchase) {
        return res.status(404).json({ message: "Achat non trouve" });
      }

      if (purchase.purchaseType !== "monthly" && purchase.purchaseType !== "yearly" && purchase.purchaseType !== "annual_bundle") {
        return res.status(400).json({ message: "Cet achat n'est pas un abonnement" });
      }

      if (!purchase.stripeSubscriptionId) {
        return res.status(400).json({ message: "Aucun abonnement Stripe associe" });
      }

      if (purchase.expiresAt && new Date(purchase.expiresAt) < new Date()) {
        return res.status(400).json({ message: "L'abonnement a expire, vous devez le renouveler" });
      }

      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ message: "Les paiements ne sont pas encore configures." });
      }

      await stripe.subscriptions.update(purchase.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      res.json({ success: true, message: "Le renouvellement automatique a ete reactive" });
    } catch (error: any) {
      console.error("Error reactivating subscription renewal:", error);
      res.status(500).json({ message: "Erreur lors de la reactivation du renouvellement" });
    }
  });

  // Get subscription status (whether it will auto-renew or not)
  app.get("/api/purchases/:purchaseId/subscription-status", isAuthenticated, async (req, res) => {
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const purchaseId = parseInt(req.params.purchaseId);

    if (isNaN(purchaseId)) {
      return res.status(400).json({ message: "Invalid purchase ID" });
    }

    try {
      const userPurchases = await storage.getPurchasesByUser(userId);
      const purchase = userPurchases.find(p => p.id === purchaseId);

      if (!purchase) {
        return res.status(404).json({ message: "Achat non trouve" });
      }

      if (purchase.purchaseType !== "monthly" && purchase.purchaseType !== "yearly" && purchase.purchaseType !== "annual_bundle") {
        return res.json({ 
          isSubscription: false,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null
        });
      }

      if (!purchase.stripeSubscriptionId) {
        return res.json({ 
          isSubscription: true,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: purchase.expiresAt
        });
      }

      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.json({ 
          isSubscription: true,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: purchase.expiresAt
        });
      }

      const subscription = await stripe.subscriptions.retrieve(purchase.stripeSubscriptionId) as any;
      
      res.json({ 
        isSubscription: true,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString() 
          : purchase.expiresAt,
        status: subscription.status
      });
    } catch (error: any) {
      console.error("Error getting subscription status:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation du statut" });
    }
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

      // Calculate yearly price with 15% discount
      const yearlyPriceCents = Math.round(script.monthlyPriceCents * 12 * 0.85);
      
      let stripePrices = await storage.getStripePricesForProduct(script.name);
      let priceId: string | null = null;
      
      if (purchaseType === "monthly") {
        priceId = stripePrices.recurringPrice;
      } else if (purchaseType === "yearly") {
        priceId = stripePrices.yearlyPrice || null;
      } else {
        priceId = stripePrices.oneTimePrice;
      }
      
      // Auto-create Stripe product/prices if not found
      if (!priceId) {
        console.log(`Auto-creating Stripe product for: ${script.name} (${purchaseType})`);
        await storage.ensureStripeProductExists({
          name: script.name,
          description: script.description,
          os: script.os,
          compliance: script.compliance,
          monthlyPriceCents: script.monthlyPriceCents,
          yearlyPriceCents: yearlyPriceCents,
        });
        
        // Retry getting prices after creation
        stripePrices = await storage.getStripePricesForProduct(script.name);
        if (purchaseType === "monthly") {
          priceId = stripePrices.recurringPrice;
        } else if (purchaseType === "yearly") {
          priceId = stripePrices.yearlyPrice || null;
        } else {
          priceId = stripePrices.oneTimePrice;
        }
        
        if (!priceId) {
          console.error(`Still no Stripe price found for ${script.name} (${purchaseType}) after auto-creation`);
          return res.status(500).json({ message: "Prix Stripe non configuré" });
        }
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const mode = (purchaseType === "monthly" || purchaseType === "yearly") ? "subscription" : "payment";
      let priceAmount = script.monthlyPriceCents;
      if (purchaseType === "yearly") {
        priceAmount = yearlyPriceCents;
      } else if (purchaseType !== "monthly") {
        priceAmount = script.priceCents;
      }

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

  // Annual bundle checkout
  app.post("/api/checkout/bundle", isAuthenticated, async (req, res) => {
    const stripeReady = await isStripeAvailable();
    if (!stripeReady) {
      return res.status(503).json({ message: "Les paiements ne sont pas encore configures." });
    }

    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    const { bundleId } = req.body;

    if (!bundleId) {
      return res.status(400).json({ message: "Bundle ID is required" });
    }

    const bundle = await storage.getAnnualBundle(bundleId);
    if (!bundle) {
      return res.status(404).json({ message: "Bundle not found" });
    }

    // Get all scripts in the bundle
    const allScripts = await storage.getScripts();
    const includedScripts = allScripts.filter(s => bundle.includedScriptIds.includes(s.id));
    
    // Calculate total annual price with discount
    const totalMonthlyPrice = includedScripts.reduce((sum, s) => sum + s.monthlyPriceCents, 0);
    const annualPrice = totalMonthlyPrice * 12;
    const discountedPrice = Math.round(annualPrice * (1 - bundle.discountPercent / 100));

    try {
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ message: "Les paiements ne sont pas configures." });
      }
      const user = await authStorage.getUser(userId);

      let customerId = user?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user?.email || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
      }

      // Find or create Stripe product for this bundle
      const products = await stripe.products.list({ active: true, limit: 100 });
      let product = products.data.find(p => p.name === bundle.name);
      
      if (!product) {
        product = await stripe.products.create({
          name: bundle.name,
          description: bundle.description,
          metadata: { bundleId: bundle.id.toString(), type: "annual_bundle" },
        });
      }

      // Find or create yearly price - always check if price matches current calculation
      const prices = await stripe.prices.list({ product: product.id, active: true });
      let yearlyPrice = prices.data.find(p => 
        p.recurring?.interval === 'year' && p.unit_amount === discountedPrice
      );
      
      if (!yearlyPrice) {
        // Deactivate old prices that don't match
        for (const oldPrice of prices.data.filter(p => p.recurring?.interval === 'year')) {
          await stripe.prices.update(oldPrice.id, { active: false });
        }
        // Create new price with correct amount
        yearlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: discountedPrice,
          currency: 'eur',
          recurring: { interval: 'year' },
        });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: yearlyPrice.id, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&bundle=${bundleId}`,
        cancel_url: `${baseUrl}/checkout/cancel`,
        metadata: {
          userId,
          bundleId: bundle.id.toString(),
          purchaseType: 'annual_bundle',
          priceCents: discountedPrice.toString(),
          includedScriptIds: bundle.includedScriptIds.join(','),
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Bundle checkout error:', error);
      res.status(500).json({ message: "Error creating checkout session" });
    }
  });

  app.get("/api/checkout/success", isAuthenticated, async (req, res) => {
    console.log('Checkout success endpoint called');
    const sessionId = req.query.session_id as string;
    const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
    console.log('Session ID:', sessionId, 'User ID:', userId);

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
        const { scriptId, purchaseType, priceCents, bundleId, includedScriptIds } = session.metadata;
        
        // Handle annual bundle purchases
        if (purchaseType === "annual_bundle" && bundleId && includedScriptIds) {
          const scriptIds = includedScriptIds.split(',').map((id: string) => parseInt(id));
          let subscriptionId: string | null = null;
          
          if (session.subscription) {
            subscriptionId = typeof session.subscription === 'string' 
              ? session.subscription 
              : session.subscription.id;
          }
          
          let expiresAt: Date | null = null;
          if (subscriptionId) {
            const stripe = await getUncachableStripeClient();
            if (stripe) {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
              if (subscription.current_period_end) {
                expiresAt = new Date(subscription.current_period_end * 1000);
              }
            }
          }
          
          // Create purchase for each included script
          for (const sid of scriptIds) {
            const existing = await storage.getActivePurchase(userId, sid);
            if (!existing) {
              await storage.createPurchase({
                userId,
                scriptId: sid,
                priceCents: Math.round(parseInt(priceCents || "0") / scriptIds.length),
                purchaseType: "annual_bundle",
                expiresAt,
                stripeSubscriptionId: subscriptionId,
              });
            }
          }
          
          // Create invoice for bundle purchase
          try {
            const [user] = await db.select().from(users).where(eq(users.id, userId));
            const bundle = await storage.getAnnualBundle(parseInt(bundleId));
            
            if (user && bundle) {
              const personalName = user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.firstName || user.email?.split('@')[0] || 'Client';
              const customerName = user.companyName 
                ? `${user.companyName} - ${personalName}`
                : personalName;
              
              const addressParts = [
                user.billingStreet,
                [user.billingPostalCode, user.billingCity].filter(Boolean).join(' ')
              ].filter(Boolean);
              const customerAddress = addressParts.join(', ');
              
              const amountCents = parseInt(priceCents || "0");
              const taxRate = 0;
              const subtotalCents = amountCents;
              const taxCents = 0;
              
              const date = new Date();
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
              const autoInvoiceNumber = `IST-${year}${month}-${random}`;
              
              const [newInvoice] = await db.insert(invoices).values({
                invoiceNumber: autoInvoiceNumber,
                userId,
                customerName,
                customerEmail: user.email || '',
                customerAddress,
                subtotalCents,
                taxRate,
                taxCents,
                totalCents: amountCents,
                status: 'paid',
                notes: `Paiement automatique via Stripe - Pack annuel: ${bundle.name}`,
                dueDate: new Date(),
                paidAt: new Date(),
              }).returning();
              
              // Create single invoice item for the bundle (not individual scripts)
              await db.insert(invoiceItems).values({
                invoiceId: newInvoice.id,
                scriptId: null,
                description: bundle.name,
                quantity: 1,
                unitPriceCents: subtotalCents,
                totalCents: subtotalCents,
              });
              
              console.log(`Invoice ${autoInvoiceNumber} created for bundle ${bundle.name} - user ${userId}`);
            }
          } catch (invoiceError) {
            console.error('Error creating bundle invoice:', invoiceError);
          }
          
          // Send purchase confirmation email for bundle
          try {
            const [user] = await db.select().from(users).where(eq(users.id, userId));
            const bundle = await storage.getAnnualBundle(parseInt(bundleId));
            
            if (user && user.email && bundle) {
              const { sendSubscriptionInvoiceEmail } = await import('./email');
              const customerName = user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.firstName || user.email.split('@')[0];
              
              const periodStart = new Date();
              const periodEnd = expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
              
              await sendSubscriptionInvoiceEmail({
                customerEmail: user.email,
                customerName,
                productName: bundle.name,
                amountCents: parseInt(priceCents || "0"),
                periodStart,
                periodEnd
              });
              console.log(`Bundle purchase email sent to ${user.email} for ${bundle.name}`);
            }
          } catch (emailError) {
            console.error('Error sending bundle purchase email:', emailError);
          }
          
          return res.json({ success: true, message: "Bundle purchase recorded" });
        }
        
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

        // Create automatic invoice for the purchase
        try {
          const [user] = await db.select().from(users).where(eq(users.id, userId));
          if (user) {
            const personalName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.firstName || user.email?.split('@')[0] || 'Client';
            const customerName = user.companyName 
              ? `${user.companyName} - ${personalName}`
              : personalName;
            
            // Build customer address from profile fields
            const addressParts = [
              user.billingStreet,
              [user.billingPostalCode, user.billingCity].filter(Boolean).join(' ')
            ].filter(Boolean);
            const customerAddress = addressParts.join(', ');
            
            const amountCents = parseInt(priceCents || "0");
            const taxRate = 0; // Sans TVA
            const subtotalCents = amountCents;
            const taxCents = 0;
            
            // Generate invoice number
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const autoInvoiceNumber = `IST-${year}${month}-${random}`;
            
            // Create the invoice
            const [newInvoice] = await db.insert(invoices).values({
              invoiceNumber: autoInvoiceNumber,
              userId,
              customerName,
              customerEmail: user.email || '',
              customerAddress,
              subtotalCents,
              taxRate,
              taxCents,
              totalCents: amountCents,
              status: 'paid',
              notes: `Paiement automatique via Stripe - ${purchaseType === 'monthly' ? 'Abonnement mensuel' : 'Achat unique'}`,
              dueDate: new Date(),
              paidAt: new Date(),
            }).returning();
            
            // Create invoice item for the script
            await db.insert(invoiceItems).values({
              invoiceId: newInvoice.id,
              scriptId: script.id,
              description: script.name,
              quantity: 1,
              unitPriceCents: subtotalCents,
              totalCents: subtotalCents,
            });
            
            console.log(`Invoice ${autoInvoiceNumber} created automatically for user ${userId}`);
          }
        } catch (invoiceError) {
          console.error('Error creating automatic invoice:', invoiceError);
          // Don't fail the request, just log the error
        }

        // Send purchase confirmation email
        try {
          const [user] = await db.select().from(users).where(eq(users.id, userId));
          if (user && user.email) {
            const { sendSubscriptionInvoiceEmail } = await import('./email');
            const customerName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.firstName || user.email.split('@')[0];
            
            const periodStart = new Date();
            const periodEnd = expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            
            await sendSubscriptionInvoiceEmail({
              customerEmail: user.email,
              customerName,
              productName: script.name,
              amountCents: parseInt(priceCents || "0"),
              periodStart,
              periodEnd
            });
            console.log(`Purchase confirmation email sent to ${user.email} for ${script.name}`);
          }
        } catch (emailError) {
          console.error('Error sending purchase confirmation email:', emailError);
          // Don't fail the request, just log the error
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
      
      // Ensure Stripe product exists for visible toolkits
      if (updated.isHidden === 0 && updated.monthlyPriceCents > 0) {
        await storage.ensureStripeProductExists({
          name: updated.name,
          description: updated.description,
          os: updated.os,
          compliance: updated.compliance,
          monthlyPriceCents: updated.monthlyPriceCents,
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating script:", error);
      res.status(500).json({ message: "Error updating script" });
    }
  });

  // Admin: Sync all visible toolkits with Stripe (create missing products)
  app.post("/api/admin/scripts/sync-stripe", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allScripts = await db.select().from(scripts).where(eq(scripts.isHidden, 0));
      
      const results = [];
      for (const script of allScripts) {
        if (script.monthlyPriceCents > 0) {
          const success = await storage.ensureStripeProductExists({
            name: script.name,
            description: script.description,
            os: script.os,
            compliance: script.compliance,
            monthlyPriceCents: script.monthlyPriceCents,
          });
          results.push({ name: script.name, success });
        }
      }
      
      res.json({ message: "Sync completed", results });
    } catch (error) {
      console.error("Error syncing Stripe products:", error);
      res.status(500).json({ message: "Error syncing Stripe products" });
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
      const addedControlNames: string[] = [];
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
        addedControlNames.push(control.name);
      }
      
      // If controls were added, update version and create version history
      if (insertedControls.length > 0) {
        // Parse current version and increment patch number
        const currentVersion = script.version || "1.0.0";
        const versionParts = currentVersion.split(".");
        const major = parseInt(versionParts[0]) || 1;
        const minor = parseInt(versionParts[1]) || 0;
        const patch = (parseInt(versionParts[2]) || 0) + 1;
        const newVersion = `${major}.${minor}.${patch}`;
        
        // Update script version
        await db.update(scripts)
          .set({ version: newVersion })
          .where(eq(scripts.id, scriptId));
        
        // Create version history entry
        const changesSummary = `Ajout de ${insertedControls.length} controle(s): ${addedControlNames.slice(0, 5).join(", ")}${addedControlNames.length > 5 ? ` et ${addedControlNames.length - 5} autre(s)` : ""}`;
        
        await db.insert(scriptVersions).values({
          scriptId,
          version: newVersion,
          previousVersion: currentVersion,
          changeType: "controls_added",
          changesSummary,
          controlsAdded: insertedControls.length,
          controlsRemoved: 0,
        });
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

  // Get version history for a script (for users viewing their purchases)
  app.get("/api/scripts/:id/versions", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const scriptId = parseInt(id);
      
      if (isNaN(scriptId) || scriptId <= 0) {
        return res.status(400).json({ message: "Invalid script ID" });
      }

      // Get script with current version
      const [script] = await db.select({
        id: scripts.id,
        name: scripts.name,
        version: scripts.version,
      }).from(scripts).where(eq(scripts.id, scriptId));

      if (!script) {
        return res.status(404).json({ message: "Script not found" });
      }
      
      // Get version history
      const versions = await db.select()
        .from(scriptVersions)
        .where(eq(scriptVersions.scriptId, scriptId))
        .orderBy(desc(scriptVersions.createdAt));
      
      res.json({ 
        currentVersion: script.version,
        scriptName: script.name,
        versions 
      });
    } catch (error) {
      console.error("Error fetching script versions:", error);
      res.status(500).json({ message: "Error fetching script versions" });
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
      const { customerName, customerEmail, customerAddress, userId, items, taxRate = 0, notes, dueDate } = req.body;
      
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

  // ============================================
  // Fleet Tracking Routes (Suivi du Parc)
  // ============================================

  // Helper to get user's team ID
  const getTeamIdForUser = async (userId: string): Promise<number | null> => {
    // Check if user owns a team
    const [ownedTeam] = await db.select().from(teams).where(eq(teams.ownerId, userId));
    if (ownedTeam) return ownedTeam.id;
    
    // Check if user is a member of a team
    const user = await authStorage.getUser(userId);
    if (user?.email) {
      const [membership] = await db.select().from(teamMembers).where(eq(teamMembers.email, user.email.toLowerCase()));
      if (membership) return membership.teamId;
    }
    return null;
  };

  // Helper to check if user is team owner (has full access)
  const isTeamOwner = async (userId: string): Promise<boolean> => {
    const [ownedTeam] = await db.select().from(teams).where(eq(teams.ownerId, userId));
    return !!ownedTeam;
  };

  // Helper to get allowed group IDs for a team member (based on permissions)
  const getAllowedGroupIdsForMember = async (userId: string, permissionType: "view" | "edit"): Promise<number[] | null> => {
    // Check if user owns a team - owners have full access
    const [ownedTeam] = await db.select().from(teams).where(eq(teams.ownerId, userId));
    if (ownedTeam) return null; // null = full access
    
    // Get user's team member record
    const user = await authStorage.getUser(userId);
    if (!user?.email) return [];
    
    const [membership] = await db.select().from(teamMembers).where(eq(teamMembers.email, user.email.toLowerCase()));
    if (!membership) return [];
    
    // Check if member has admin role - admins have full access
    if (membership.role === "admin") return null;
    
    // Get permissions for this member
    const permissions = await db.select().from(machineGroupPermissions).where(eq(machineGroupPermissions.teamMemberId, membership.id));
    
    // If no permissions defined, member sees nothing
    if (permissions.length === 0) return [];
    
    // Filter by permission type
    if (permissionType === "view") {
      return permissions.filter(p => p.canView).map(p => p.groupId);
    } else {
      return permissions.filter(p => p.canEdit).map(p => p.groupId);
    }
  };

  // Get machines for user's team
  app.get("/api/fleet/machines", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = user?.isAdmin ? null : await getTeamIdForUser(userId);
      
      if (!user?.isAdmin && !teamId) {
        return res.json({ machines: [] });
      }

      // Admin sees all machines
      if (user?.isAdmin) {
        const result = await db.select().from(machines).orderBy(desc(machines.lastAuditDate));
        return res.json({ machines: result });
      }

      // Get allowed group IDs for this user
      const allowedGroupIds = await getAllowedGroupIdsForMember(userId, "view");
      
      // Full access (owner or admin role)
      if (allowedGroupIds === null) {
        const result = await db.select().from(machines).where(eq(machines.teamId, teamId!)).orderBy(desc(machines.lastAuditDate));
        return res.json({ machines: result });
      }
      
      // No permissions = no machines
      if (allowedGroupIds.length === 0) {
        return res.json({ machines: [] });
      }
      
      // Filter by allowed groups (no teamId filter since group membership implies access)
      const result = await db.select().from(machines)
        .where(inArray(machines.groupId!, allowedGroupIds))
        .orderBy(desc(machines.lastAuditDate));
      
      res.json({ machines: result });
    } catch (error) {
      console.error("Error fetching machines:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation des machines" });
    }
  });

  // Get audit reports for user's team
  app.get("/api/fleet/reports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = user?.isAdmin ? null : await getTeamIdForUser(userId);
      
      if (!user?.isAdmin && !teamId) {
        return res.json({ reports: [] });
      }

      // Get reports with machine info
      const baseQuery = db
        .select({
          id: auditReports.id,
          machineId: auditReports.machineId,
          uploadedBy: auditReports.uploadedBy,
          auditDate: auditReports.auditDate,
          scriptName: auditReports.scriptName,
          scriptVersion: auditReports.scriptVersion,
          score: auditReports.score,
          originalScore: auditReports.originalScore,
          grade: auditReports.grade,
          totalControls: auditReports.totalControls,
          passedControls: auditReports.passedControls,
          failedControls: auditReports.failedControls,
          warningControls: auditReports.warningControls,
          fileName: auditReports.fileName,
          createdAt: auditReports.createdAt,
          hostname: machines.hostname,
          os: machines.os,
          osVersion: machines.osVersion,
          groupId: machines.groupId,
        })
        .from(auditReports)
        .innerJoin(machines, eq(auditReports.machineId, machines.id));
      
      // Admin sees all reports
      if (user?.isAdmin) {
        const reports = await baseQuery.orderBy(desc(auditReports.auditDate));
        return res.json({ reports });
      }

      // Get allowed group IDs for this user
      const allowedGroupIds = await getAllowedGroupIdsForMember(userId, "view");
      
      // Full access (owner or admin role)
      if (allowedGroupIds === null) {
        const reports = await baseQuery.where(eq(machines.teamId, teamId!)).orderBy(desc(auditReports.auditDate));
        return res.json({ reports });
      }
      
      // No permissions = no reports
      if (allowedGroupIds.length === 0) {
        return res.json({ reports: [] });
      }
      
      // Filter by allowed groups (no teamId filter since group membership implies access)
      const reports = await baseQuery
        .where(inArray(machines.groupId!, allowedGroupIds))
        .orderBy(desc(auditReports.auditDate));
      
      res.json({ reports });
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation des rapports" });
    }
  });

  // Get reports for a specific machine
  app.get("/api/fleet/machines/:id/reports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const machineId = parseInt(req.params.id);
      if (isNaN(machineId)) {
        return res.status(400).json({ message: "ID machine invalide" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = user?.isAdmin ? null : await getTeamIdForUser(userId);
      
      // Verify machine belongs to user's team
      const [machine] = await db.select().from(machines).where(eq(machines.id, machineId));
      if (!machine) {
        return res.status(404).json({ message: "Machine non trouvee" });
      }
      if (!user?.isAdmin && machine.teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise" });
      }

      // Check group-level permissions for team members
      if (!user?.isAdmin) {
        const allowedGroupIds = await getAllowedGroupIdsForMember(userId, "view");
        if (allowedGroupIds !== null && (!machine.groupId || !allowedGroupIds.includes(machine.groupId))) {
          return res.status(403).json({ message: "Acces non autorise a ce groupe" });
        }
      }

      const reports = await db
        .select()
        .from(auditReports)
        .where(eq(auditReports.machineId, machineId))
        .orderBy(desc(auditReports.auditDate));
      
      res.json({ machine, reports });
    } catch (error) {
      console.error("Error fetching machine reports:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation des rapports" });
    }
  });

  // Upload a new audit report (JSON parsing)
  app.post("/api/fleet/upload-report", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const { jsonContent, htmlContent, fileName, machineName, groupId } = req.body;
      
      if (!jsonContent) {
        return res.status(400).json({ message: "Contenu JSON requis" });
      }

      if (!machineName || machineName.trim() === '') {
        return res.status(400).json({ message: "Nom de la machine requis" });
      }

      // Get user info and team ID first
      const uploadUser = await authStorage.getUser(userId);
      let teamId = await getTeamIdForUser(userId);
      
      // If admin without team, create a default "admin" team
      if (!teamId && uploadUser?.isAdmin) {
        const [adminTeam] = await db.insert(teams).values({
          name: "Equipe Admin",
          ownerId: userId
        }).returning();
        teamId = adminTeam.id;
      }
      
      if (!teamId) {
        return res.status(400).json({ message: "Vous devez appartenir a une equipe pour uploader des rapports" });
      }
      
      // Validate groupId if provided - verify it belongs to user's team
      let parsedGroupId: number | null | undefined = undefined;
      if (groupId !== undefined && groupId !== null && groupId !== '') {
        parsedGroupId = parseInt(groupId);
        if (!isNaN(parsedGroupId)) {
          // Verify group belongs to user's team via organization -> site -> group chain
          const groupCheck = await db.select({
            groupId: machineGroups.id,
            teamId: organizations.teamId
          })
          .from(machineGroups)
          .innerJoin(sites, eq(machineGroups.siteId, sites.id))
          .innerJoin(organizations, eq(sites.organizationId, organizations.id))
          .where(eq(machineGroups.id, parsedGroupId))
          .limit(1);
          
          if (groupCheck.length === 0) {
            return res.status(400).json({ message: "Groupe non trouve" });
          }
          
          // Verify team ownership (admins can access any team)
          if (!uploadUser?.isAdmin && groupCheck[0].teamId !== teamId) {
            return res.status(403).json({ message: "Acces non autorise a ce groupe" });
          }
        } else {
          parsedGroupId = undefined;
        }
      }
      // Note: Don't set parsedGroupId to null when groupId is omitted or empty
      // This preserves existing group assignment when no group is explicitly selected

      // Parse JSON report
      let reportData: any;
      try {
        reportData = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      } catch (e) {
        return res.status(400).json({ message: "Format JSON invalide" });
      }

      // Use manually provided machine name (required)
      const hostname = machineName.trim();
      const machineIdFromReport = reportData.machine_id || reportData.systemInfo?.uuid || null;
      const os = detectOS(reportData);
      const osVersion = detectOSVersion(reportData);
      
      // Extract audit info - support multiple JSON formats (summary, results, root level)
      const auditDate = reportData.system_info?.audit_date || reportData.audit_date || reportData.date || reportData.timestamp 
        ? new Date(reportData.system_info?.audit_date || reportData.audit_date || reportData.date || reportData.timestamp) 
        : new Date();
      
      // Score and grade - check summary first (IST format), then results, then root
      const score = reportData.summary?.score ?? reportData.score ?? reportData.compliance_score ?? reportData.results?.score ?? 0;
      const grade = reportData.summary?.grade || reportData.grade || calculateGrade(score);
      
      // Control counts - check summary (IST format with total_checks), then results, then root
      const totalControls = reportData.summary?.total_checks ?? reportData.summary?.total ?? reportData.total_controls ?? reportData.results?.total ?? 0;
      const passedControls = reportData.summary?.passed ?? reportData.passed_controls ?? reportData.results?.passed ?? 0;
      const failedControls = reportData.summary?.failed ?? reportData.failed_controls ?? reportData.results?.failed ?? 0;
      const warningControls = reportData.summary?.warnings ?? reportData.warning_controls ?? reportData.results?.warnings ?? 0;
      
      // Script info - check system_info first (IST format), then root
      const scriptName = reportData.report_type || reportData.script_name || reportData.toolkit_name || null;
      const scriptVersion = reportData.system_info?.script_version || reportData.script_version || reportData.version || null;

      // Find or create machine
      let machine;
      const existingMachines = await db.select().from(machines).where(
        and(
          eq(machines.teamId, teamId),
          eq(machines.hostname, hostname)
        )
      );
      
      if (existingMachines.length > 0) {
        machine = existingMachines[0];
        // Update machine with latest audit info and groupId if provided
        const updateData: any = {
          lastAuditDate: auditDate,
          lastScore: score,
          lastGrade: grade,
          totalAudits: sql`${machines.totalAudits} + 1`,
          os: os !== 'unknown' ? os : machine.os,
          osVersion: osVersion || machine.osVersion,
          updatedAt: new Date()
        };
        // Set original score only if not already set (first report)
        if (machine.originalScore === null) {
          updateData.originalScore = score;
        }
        // Update groupId if provided (even if null to unassign)
        if (parsedGroupId !== undefined) {
          updateData.groupId = parsedGroupId;
        }
        await db.update(machines)
          .set(updateData)
          .where(eq(machines.id, machine.id));
      } else {
        // Create new machine with optional groupId
        const [newMachine] = await db.insert(machines).values({
          teamId,
          groupId: parsedGroupId,
          hostname,
          machineId: machineIdFromReport,
          os,
          osVersion,
          lastAuditDate: auditDate,
          lastScore: score,
          originalScore: score, // First report sets original score
          lastGrade: grade,
          totalAudits: 1
        }).returning();
        machine = newMachine;
      }

      // Create audit report
      const [report] = await db.insert(auditReports).values({
        machineId: machine.id,
        uploadedBy: userId,
        auditDate,
        scriptName,
        scriptVersion,
        score,
        grade,
        totalControls,
        passedControls,
        failedControls,
        warningControls,
        jsonContent: typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent),
        htmlContent: htmlContent || null,
        fileName
      }).returning();

      res.status(201).json({ 
        success: true, 
        report,
        machine,
        message: `Rapport importe pour ${hostname}`
      });
    } catch (error) {
      console.error("Error uploading report:", error);
      res.status(500).json({ message: "Erreur lors de l'upload du rapport" });
    }
  });

  // Get a specific report with full content
  app.get("/api/fleet/reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ message: "ID rapport invalide" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = user?.isAdmin ? null : await getTeamIdForUser(userId);

      const [report] = await db.select().from(auditReports).where(eq(auditReports.id, reportId));
      if (!report) {
        return res.status(404).json({ message: "Rapport non trouve" });
      }

      // Verify access
      const [machine] = await db.select().from(machines).where(eq(machines.id, report.machineId));
      if (!user?.isAdmin && machine?.teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise" });
      }

      // Check group-level permissions for team members
      if (!user?.isAdmin) {
        const allowedGroupIds = await getAllowedGroupIdsForMember(userId, "view");
        if (allowedGroupIds !== null && (!machine?.groupId || !allowedGroupIds.includes(machine.groupId))) {
          return res.status(403).json({ message: "Acces non autorise a ce groupe" });
        }
      }

      res.json({ report, machine });
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation du rapport" });
    }
  });

  // Delete a report
  app.delete("/api/fleet/reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ message: "ID rapport invalide" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = await getTeamIdForUser(userId);

      // Check if user has admin access (site admin or team owner/admin)
      const [report] = await db.select().from(auditReports).where(eq(auditReports.id, reportId));
      if (!report) {
        return res.status(404).json({ message: "Rapport non trouve" });
      }

      const [machine] = await db.select().from(machines).where(eq(machines.id, report.machineId));
      if (!user?.isAdmin && machine?.teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise" });
      }

      // Check group-level permissions for team members (require edit permission for delete)
      if (!user?.isAdmin) {
        const allowedGroupIds = await getAllowedGroupIdsForMember(userId, "edit");
        if (allowedGroupIds !== null && (!machine?.groupId || !allowedGroupIds.includes(machine.groupId))) {
          return res.status(403).json({ message: "Vous n'avez pas les droits d'edition sur ce groupe" });
        }
      }

      // Delete the report
      await db.delete(auditReports).where(eq(auditReports.id, reportId));

      // Update machine stats
      if (machine) {
        const remainingReports = await db.select().from(auditReports)
          .where(eq(auditReports.machineId, machine.id))
          .orderBy(desc(auditReports.auditDate))
          .limit(1);
        
        if (remainingReports.length > 0) {
          await db.update(machines)
            .set({
              lastAuditDate: remainingReports[0].auditDate,
              lastScore: remainingReports[0].score,
              lastGrade: remainingReports[0].grade,
              totalAudits: sql`GREATEST(${machines.totalAudits} - 1, 0)`,
              updatedAt: new Date()
            })
            .where(eq(machines.id, machine.id));
        } else {
          await db.update(machines)
            .set({
              lastAuditDate: null,
              lastScore: null,
              lastGrade: null,
              totalAudits: 0,
              updatedAt: new Date()
            })
            .where(eq(machines.id, machine.id));
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du rapport" });
    }
  });

  // Delete a machine and all its reports
  app.delete("/api/fleet/machines/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const machineId = parseInt(req.params.id);
      if (isNaN(machineId)) {
        return res.status(400).json({ message: "ID machine invalide" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = await getTeamIdForUser(userId);

      const [machine] = await db.select().from(machines).where(eq(machines.id, machineId));
      if (!machine) {
        return res.status(404).json({ message: "Machine non trouvee" });
      }

      if (!user?.isAdmin && machine.teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise" });
      }

      // Delete all reports for this machine
      await db.delete(auditReports).where(eq(auditReports.machineId, machineId));
      
      // Delete the machine
      await db.delete(machines).where(eq(machines.id, machineId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting machine:", error);
      res.status(500).json({ message: "Erreur lors de la suppression de la machine" });
    }
  });

  // ==================== FLEET HIERARCHY ENDPOINTS ====================

  // Get full hierarchy (organizations -> sites -> groups -> machines)
  app.get("/api/fleet/hierarchy", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = user?.isAdmin ? null : await getTeamIdForUser(userId);
      
      if (!user?.isAdmin && !teamId) {
        return res.json({ organizations: [], unassignedMachines: [] });
      }

      // Get allowed group IDs for permission filtering
      const allowedGroupIds = user?.isAdmin ? null : await getAllowedGroupIdsForMember(userId, "view");

      // Get organizations
      const orgsQuery = user?.isAdmin
        ? db.select().from(organizations).orderBy(organizations.name)
        : db.select().from(organizations).where(eq(organizations.teamId, teamId!)).orderBy(organizations.name);
      const orgs = await orgsQuery;

      // Get sites for those organizations
      const orgIds = orgs.map(o => o.id);
      const allSites = orgIds.length > 0 
        ? await db.select().from(sites).where(inArray(sites.organizationId, orgIds)).orderBy(sites.name)
        : [];

      // Get groups for those sites
      const siteIds = allSites.map(s => s.id);
      let allGroups = siteIds.length > 0
        ? await db.select().from(machineGroups).where(inArray(machineGroups.siteId, siteIds)).orderBy(machineGroups.name)
        : [];

      // Filter groups by permissions for team members (not owners/admins)
      if (allowedGroupIds !== null && allowedGroupIds.length === 0) {
        allGroups = [];
      } else if (allowedGroupIds !== null) {
        allGroups = allGroups.filter(g => allowedGroupIds.includes(g.id));
      }

      // Get machines with groups
      let allMachines: typeof machines.$inferSelect[] = [];
      
      if (user?.isAdmin) {
        // Admin sees all machines
        allMachines = await db.select().from(machines).orderBy(machines.hostname);
      } else if (allowedGroupIds === null) {
        // Team owner/admin member - sees all machines from the team
        allMachines = await db.select().from(machines).where(eq(machines.teamId, teamId!)).orderBy(machines.hostname);
      } else if (allowedGroupIds.length === 0) {
        // Member with no permissions - sees nothing
        allMachines = [];
      } else {
        // Member with specific group permissions - get machines in those groups
        allMachines = await db.select().from(machines).where(inArray(machines.groupId, allowedGroupIds)).orderBy(machines.hostname);
      }

      // Build hierarchy
      const hierarchy = orgs.map(org => ({
        ...org,
        sites: allSites.filter(s => s.organizationId === org.id).map(site => ({
          ...site,
          groups: allGroups.filter(g => g.siteId === site.id).map(group => ({
            ...group,
            machines: allMachines.filter(m => m.groupId === group.id)
          }))
        }))
      }));

      // Get unassigned machines (no groupId) - only for owners/admins
      const unassignedMachines = allowedGroupIds === null 
        ? allMachines.filter(m => !m.groupId)
        : [];

      res.json({ organizations: hierarchy, unassignedMachines });
    } catch (error) {
      console.error("Error fetching hierarchy:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation de la hierarchie" });
    }
  });

  // Create organization
  app.post("/api/fleet/organizations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const user = await authStorage.getUser(userId);
      let teamId = await getTeamIdForUser(userId);
      
      if (!teamId && user?.isAdmin) {
        const [adminTeam] = await db.insert(teams).values({
          name: "Equipe Admin",
          ownerId: userId
        }).returning();
        teamId = adminTeam.id;
      }
      
      if (!teamId) {
        return res.status(400).json({ message: "Vous devez appartenir a une equipe" });
      }

      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Nom requis" });
      }

      const [org] = await db.insert(organizations).values({
        teamId,
        name,
        description
      }).returning();

      res.json({ organization: org });
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(500).json({ message: "Erreur lors de la creation de l'organisation" });
    }
  });

  // Delete organization - with ownership validation
  app.delete("/api/fleet/organizations/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const orgId = parseInt(req.params.id);
      const user = await authStorage.getUser(userId);
      const teamId = await getTeamIdForUser(userId);
      
      // Verify organization belongs to user's team
      const orgCheck = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      if (orgCheck.length === 0) {
        return res.status(404).json({ message: "Organisation non trouvee" });
      }
      if (!user?.isAdmin && orgCheck[0].teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise a cette organisation" });
      }
      
      // Delete all sites and groups under this organization
      const orgSites = await db.select().from(sites).where(eq(sites.organizationId, orgId));
      for (const site of orgSites) {
        const siteGroups = await db.select().from(machineGroups).where(eq(machineGroups.siteId, site.id));
        for (const group of siteGroups) {
          // Unassign machines from this group
          await db.update(machines).set({ groupId: null }).where(eq(machines.groupId, group.id));
        }
        await db.delete(machineGroups).where(eq(machineGroups.siteId, site.id));
      }
      await db.delete(sites).where(eq(sites.organizationId, orgId));
      await db.delete(organizations).where(eq(organizations.id, orgId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting organization:", error);
      res.status(500).json({ message: "Erreur lors de la suppression de l'organisation" });
    }
  });

  // Create site - with ownership validation
  app.post("/api/fleet/sites", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const { organizationId, name, location } = req.body;
      if (!organizationId || !name) {
        return res.status(400).json({ message: "Organisation et nom requis" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = await getTeamIdForUser(userId);
      
      // Verify organization belongs to user's team
      const orgCheck = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
      if (orgCheck.length === 0) {
        return res.status(404).json({ message: "Organisation non trouvee" });
      }
      if (!user?.isAdmin && orgCheck[0].teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise a cette organisation" });
      }

      const [site] = await db.insert(sites).values({
        organizationId,
        name,
        location
      }).returning();

      res.json({ site });
    } catch (error) {
      console.error("Error creating site:", error);
      res.status(500).json({ message: "Erreur lors de la creation du site" });
    }
  });

  // Delete site - with ownership validation
  app.delete("/api/fleet/sites/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const siteId = parseInt(req.params.id);
      const user = await authStorage.getUser(userId);
      const teamId = await getTeamIdForUser(userId);
      
      // Verify site belongs to user's team via organization
      const siteCheck = await db.select({
        siteId: sites.id,
        teamId: organizations.teamId
      })
      .from(sites)
      .innerJoin(organizations, eq(sites.organizationId, organizations.id))
      .where(eq(sites.id, siteId))
      .limit(1);
      
      if (siteCheck.length === 0) {
        return res.status(404).json({ message: "Site non trouve" });
      }
      if (!user?.isAdmin && siteCheck[0].teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise a ce site" });
      }
      
      // Delete all groups under this site
      const siteGroups = await db.select().from(machineGroups).where(eq(machineGroups.siteId, siteId));
      for (const group of siteGroups) {
        await db.update(machines).set({ groupId: null }).where(eq(machines.groupId, group.id));
      }
      await db.delete(machineGroups).where(eq(machineGroups.siteId, siteId));
      await db.delete(sites).where(eq(sites.id, siteId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting site:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du site" });
    }
  });

  // Create machine group - with ownership validation
  app.post("/api/fleet/groups", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const { siteId, name, description } = req.body;
      if (!siteId || !name) {
        return res.status(400).json({ message: "Site et nom requis" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = await getTeamIdForUser(userId);
      
      // Verify site belongs to user's team via organization
      const siteCheck = await db.select({
        siteId: sites.id,
        teamId: organizations.teamId
      })
      .from(sites)
      .innerJoin(organizations, eq(sites.organizationId, organizations.id))
      .where(eq(sites.id, siteId))
      .limit(1);
      
      if (siteCheck.length === 0) {
        return res.status(404).json({ message: "Site non trouve" });
      }
      if (!user?.isAdmin && siteCheck[0].teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise a ce site" });
      }

      const [group] = await db.insert(machineGroups).values({
        siteId,
        name,
        description
      }).returning();

      res.json({ group });
    } catch (error) {
      console.error("Error creating group:", error);
      res.status(500).json({ message: "Erreur lors de la creation du groupe" });
    }
  });

  // Delete machine group - with ownership validation
  app.delete("/api/fleet/groups/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const groupId = parseInt(req.params.id);
      const user = await authStorage.getUser(userId);
      const teamId = await getTeamIdForUser(userId);
      
      // Verify group belongs to user's team via site -> organization
      const groupCheck = await db.select({
        groupId: machineGroups.id,
        teamId: organizations.teamId
      })
      .from(machineGroups)
      .innerJoin(sites, eq(machineGroups.siteId, sites.id))
      .innerJoin(organizations, eq(sites.organizationId, organizations.id))
      .where(eq(machineGroups.id, groupId))
      .limit(1);
      
      if (groupCheck.length === 0) {
        return res.status(404).json({ message: "Groupe non trouve" });
      }
      if (!user?.isAdmin && groupCheck[0].teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise a ce groupe" });
      }
      
      // Unassign machines from this group
      await db.update(machines).set({ groupId: null }).where(eq(machines.groupId, groupId));
      await db.delete(machineGroups).where(eq(machineGroups.id, groupId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du groupe" });
    }
  });

  // Assign machine to group - with ownership validation
  app.put("/api/fleet/machines/:id/assign", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const machineId = parseInt(req.params.id);
      const { groupId } = req.body;

      // Verify machine belongs to user's team
      const user = await authStorage.getUser(userId);
      const teamId = await getTeamIdForUser(userId);
      
      const machineCheck = await db.select().from(machines).where(eq(machines.id, machineId)).limit(1);
      if (machineCheck.length === 0) {
        return res.status(404).json({ message: "Machine non trouvee" });
      }
      if (!user?.isAdmin && machineCheck[0].teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise a cette machine" });
      }

      // Validate group ownership if groupId provided
      if (groupId) {
        const groupCheck = await db.select({
          groupId: machineGroups.id,
          teamId: organizations.teamId
        })
        .from(machineGroups)
        .innerJoin(sites, eq(machineGroups.siteId, sites.id))
        .innerJoin(organizations, eq(sites.organizationId, organizations.id))
        .where(eq(machineGroups.id, parseInt(groupId)))
        .limit(1);
        
        if (groupCheck.length === 0) {
          return res.status(404).json({ message: "Groupe non trouve" });
        }
        if (!user?.isAdmin && groupCheck[0].teamId !== teamId) {
          return res.status(403).json({ message: "Acces non autorise a ce groupe" });
        }
      }

      await db.update(machines)
        .set({ groupId: groupId ? parseInt(groupId) : null })
        .where(eq(machines.id, machineId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error assigning machine:", error);
      res.status(500).json({ message: "Erreur lors de l'assignation de la machine" });
    }
  });

  // ==================== END FLEET HIERARCHY ENDPOINTS ====================

  // Fleet dashboard stats
  app.get("/api/fleet/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = user?.isAdmin ? null : await getTeamIdForUser(userId);
      
      if (!user?.isAdmin && !teamId) {
        return res.json({ 
          totalMachines: 0, 
          totalReports: 0, 
          averageScore: null,
          lastAuditDate: null,
          osCounts: {}
        });
      }

      // Get allowed group IDs for permission filtering
      const allowedGroupIds = user?.isAdmin ? null : await getAllowedGroupIdsForMember(userId, "view");
      
      // If member has no permissions, return empty stats
      if (allowedGroupIds !== null && allowedGroupIds.length === 0) {
        return res.json({ 
          totalMachines: 0, 
          totalReports: 0, 
          averageScore: null,
          lastAuditDate: null,
          osCounts: {}
        });
      }

      // Build base query condition
      const getWhereCondition = () => {
        if (user?.isAdmin) return undefined;
        if (allowedGroupIds === null) {
          return eq(machines.teamId, teamId!);
        }
        // Member with specific group permissions - filter by groupId only
        return inArray(machines.groupId!, allowedGroupIds);
      };

      const whereCondition = getWhereCondition();

      // Get machine count
      const machineQueryBase = db.select({ count: sql<number>`count(*)::int` }).from(machines);
      const [{ count: totalMachines }] = whereCondition 
        ? await machineQueryBase.where(whereCondition)
        : await machineQueryBase;

      // Get reports count
      const reportsQueryBase = db.select({ count: sql<number>`count(*)::int` })
        .from(auditReports)
        .innerJoin(machines, eq(auditReports.machineId, machines.id));
      const [{ count: totalReports }] = whereCondition
        ? await reportsQueryBase.where(whereCondition)
        : await reportsQueryBase;

      // Get average score from latest report per machine
      const avgCondition = whereCondition 
        ? and(whereCondition, sql`${machines.lastScore} IS NOT NULL`)
        : sql`${machines.lastScore} IS NOT NULL`;
      const [{ avgScore }] = await db.select({ avgScore: sql<number>`avg(${machines.lastScore})::int` })
        .from(machines)
        .where(avgCondition);

      // Get last audit date
      const [{ lastDate }] = whereCondition
        ? await db.select({ lastDate: sql<Date>`max(${machines.lastAuditDate})` }).from(machines).where(whereCondition)
        : await db.select({ lastDate: sql<Date>`max(${machines.lastAuditDate})` }).from(machines);

      // Get OS distribution
      const osQueryBase = db.select({ os: machines.os, count: sql<number>`count(*)::int` }).from(machines);
      const osResults = whereCondition
        ? await osQueryBase.where(whereCondition).groupBy(machines.os)
        : await osQueryBase.groupBy(machines.os);
      const osCounts: Record<string, number> = {};
      for (const row of osResults) {
        osCounts[row.os] = row.count;
      }

      res.json({
        totalMachines,
        totalReports,
        averageScore: avgScore,
        lastAuditDate: lastDate,
        osCounts
      });
    } catch (error) {
      console.error("Error fetching fleet stats:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation des statistiques" });
    }
  });

  // Get score history for chart (grouped by month)
  app.get("/api/fleet/score-history", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = user?.isAdmin ? null : await getTeamIdForUser(userId);
      
      if (!user?.isAdmin && !teamId) {
        return res.json({ history: [] });
      }

      // Get allowed group IDs for permission filtering
      const allowedGroupIds = user?.isAdmin ? null : await getAllowedGroupIdsForMember(userId, "view");
      
      // If member has no permissions, return empty history
      if (allowedGroupIds !== null && allowedGroupIds.length === 0) {
        return res.json({ history: [], availableYears: [], selectedYear: new Date().getFullYear() });
      }

      // Build where condition based on access level
      let historyQuery;
      if (user?.isAdmin) {
        historyQuery = db.select({
            month: sql<string>`TO_CHAR(${auditReports.auditDate}, 'YYYY-MM')`,
            avgOriginalScore: sql<number>`ROUND(AVG(COALESCE(${auditReports.originalScore}, ${auditReports.score})))::int`,
            avgCurrentScore: sql<number>`ROUND(AVG(${auditReports.score}))::int`,
            reportCount: sql<number>`COUNT(*)::int`
          })
          .from(auditReports)
          .where(sql`${auditReports.auditDate} >= NOW() - INTERVAL '12 months'`)
          .groupBy(sql`TO_CHAR(${auditReports.auditDate}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${auditReports.auditDate}, 'YYYY-MM')`);
      } else if (allowedGroupIds === null) {
        // Full team access (owner or admin member)
        historyQuery = db.select({
            month: sql<string>`TO_CHAR(${auditReports.auditDate}, 'YYYY-MM')`,
            avgOriginalScore: sql<number>`ROUND(AVG(COALESCE(${auditReports.originalScore}, ${auditReports.score})))::int`,
            avgCurrentScore: sql<number>`ROUND(AVG(${auditReports.score}))::int`,
            reportCount: sql<number>`COUNT(*)::int`
          })
          .from(auditReports)
          .innerJoin(machines, eq(auditReports.machineId, machines.id))
          .where(and(
            eq(machines.teamId, teamId!),
            sql`${auditReports.auditDate} >= NOW() - INTERVAL '12 months'`
          ))
          .groupBy(sql`TO_CHAR(${auditReports.auditDate}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${auditReports.auditDate}, 'YYYY-MM')`);
      } else {
        // Filtered access by allowed groups (no teamId filter - group membership implies access)
        historyQuery = db.select({
            month: sql<string>`TO_CHAR(${auditReports.auditDate}, 'YYYY-MM')`,
            avgOriginalScore: sql<number>`ROUND(AVG(COALESCE(${auditReports.originalScore}, ${auditReports.score})))::int`,
            avgCurrentScore: sql<number>`ROUND(AVG(${auditReports.score}))::int`,
            reportCount: sql<number>`COUNT(*)::int`
          })
          .from(auditReports)
          .innerJoin(machines, eq(auditReports.machineId, machines.id))
          .where(and(
            inArray(machines.groupId!, allowedGroupIds),
            sql`${auditReports.auditDate} >= NOW() - INTERVAL '12 months'`
          ))
          .groupBy(sql`TO_CHAR(${auditReports.auditDate}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${auditReports.auditDate}, 'YYYY-MM')`);
      }

      const history = await historyQuery;

      // Get requested year from query params (default to current year)
      const requestedYear = parseInt(req.query.year as string) || new Date().getFullYear();
      
      // Generate all 12 months for the selected year (January to December)
      const monthNames = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec'];
      const allMonths: { month: string; originalScore: number; currentScore: number; reports: number }[] = [];
      
      for (let m = 0; m < 12; m++) {
        const yearMonth = `${requestedYear}-${String(m + 1).padStart(2, '0')}`;
        const monthLabel = monthNames[m];
        
        // Find matching data from query
        const existingData = history.find(h => h.month === yearMonth);
        
        allMonths.push({
          month: monthLabel,
          originalScore: existingData?.avgOriginalScore || 0,
          currentScore: existingData?.avgCurrentScore || 0,
          reports: existingData?.reportCount || 0
        });
      }

      // Get available years (years with data)
      const availableYears = [...new Set(history.map(h => parseInt(h.month.split('-')[0])))].sort((a, b) => b - a);
      // Always include current year
      const currentYear = new Date().getFullYear();
      if (!availableYears.includes(currentYear)) {
        availableYears.unshift(currentYear);
      }

      res.json({ history: allMonths, availableYears, selectedYear: requestedYear });
    } catch (error) {
      console.error("Error fetching score history:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation de l'historique" });
    }
  });

  // Get report details with controls and corrections
  app.get("/api/fleet/reports/:id/controls", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ message: "ID de rapport invalide" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = user?.isAdmin ? null : await getTeamIdForUser(userId);

      // Get the report
      const [report] = await db.select().from(auditReports).where(eq(auditReports.id, reportId));
      if (!report) {
        return res.status(404).json({ message: "Rapport non trouve" });
      }

      // Verify access to the machine
      const [machine] = await db.select().from(machines).where(eq(machines.id, report.machineId));
      if (!machine) {
        return res.status(404).json({ message: "Machine non trouvee" });
      }

      // Check access permissions
      if (!user?.isAdmin) {
        const allowedGroupIds = await getAllowedGroupIdsForMember(userId, "view");
        if (allowedGroupIds === null) {
          // Team owner/admin - check team access
          if (machine.teamId !== teamId) {
            return res.status(403).json({ message: "Acces non autorise" });
          }
        } else if (allowedGroupIds.length === 0) {
          // No permissions
          return res.status(403).json({ message: "Acces non autorise" });
        } else {
          // Member with specific group permissions - check group access
          if (!machine.groupId || !allowedGroupIds.includes(machine.groupId)) {
            return res.status(403).json({ message: "Acces non autorise a ce groupe" });
          }
        }
      }

      // Parse the JSON content to get controls
      let controls: any[] = [];
      try {
        const jsonData = typeof report.jsonContent === 'string' ? JSON.parse(report.jsonContent) : report.jsonContent;
        controls = jsonData.results || [];
      } catch (e) {
        console.error("Error parsing report JSON:", e);
      }

      // Get all corrections for this report
      const corrections = await db.select().from(controlCorrections).where(eq(controlCorrections.reportId, reportId));

      // Create a map of corrections by controlId
      const correctionsMap: Record<string, any> = {};
      for (const correction of corrections) {
        correctionsMap[correction.controlId] = correction;
      }

      // Merge controls with corrections
      const controlsWithCorrections = controls.map((control: any) => ({
        ...control,
        correction: correctionsMap[control.id] || null
      }));

      res.json({ 
        reportId,
        controls: controlsWithCorrections,
        totalControls: controls.length,
        correctedCount: corrections.length
      });
    } catch (error) {
      console.error("Error fetching report controls:", error);
      res.status(500).json({ message: "Erreur lors de la recuperation des controles" });
    }
  });

  // Save or update a control correction
  app.post("/api/fleet/reports/:id/corrections", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ message: "ID de rapport invalide" });
      }

      const user = await authStorage.getUser(userId);
      const teamId = user?.isAdmin ? null : await getTeamIdForUser(userId);

      const { controlId, originalStatus, correctedStatus, justification } = req.body;

      if (!controlId || !originalStatus || !correctedStatus || !justification) {
        return res.status(400).json({ message: "Tous les champs sont requis" });
      }

      // Check if report exists
      const [report] = await db.select().from(auditReports).where(eq(auditReports.id, reportId));
      if (!report) {
        return res.status(404).json({ message: "Rapport non trouve" });
      }

      // Verify access to the machine
      const [machine] = await db.select().from(machines).where(eq(machines.id, report.machineId));
      if (!user?.isAdmin && machine?.teamId !== teamId) {
        return res.status(403).json({ message: "Acces non autorise" });
      }

      // Check group-level permissions for team members (require edit permission)
      if (!user?.isAdmin) {
        const allowedGroupIds = await getAllowedGroupIdsForMember(userId, "edit");
        if (allowedGroupIds !== null && (!machine?.groupId || !allowedGroupIds.includes(machine.groupId))) {
          return res.status(403).json({ message: "Vous n'avez pas les droits d'edition sur ce groupe" });
        }
      }

      // Save original score if not already saved (first correction)
      if (report.originalScore === null) {
        await db.update(auditReports)
          .set({ originalScore: report.score })
          .where(eq(auditReports.id, reportId));
      }

      // Check if correction already exists
      const [existingCorrection] = await db.select().from(controlCorrections).where(
        and(
          eq(controlCorrections.reportId, reportId),
          eq(controlCorrections.controlId, controlId)
        )
      );

      let correction;
      if (existingCorrection) {
        // Update existing correction
        [correction] = await db.update(controlCorrections)
          .set({
            correctedStatus,
            justification,
            correctedBy: userId,
            correctedAt: new Date()
          })
          .where(eq(controlCorrections.id, existingCorrection.id))
          .returning();
      } else {
        // Create new correction
        [correction] = await db.insert(controlCorrections).values({
          reportId,
          controlId,
          originalStatus,
          correctedStatus,
          justification,
          correctedBy: userId
        }).returning();
      }

      // Recalculate the score based on corrections
      const allCorrections = await db.select().from(controlCorrections).where(eq(controlCorrections.reportId, reportId));
      
      // Calculate adjusted counts based on corrections
      let adjustedPassed = report.originalScore !== null 
        ? Math.round((report.originalScore / 100) * report.totalControls)
        : report.passedControls;
      
      // Count corrections that changed status to PASS
      let passedFromCorrections = 0;
      for (const corr of allCorrections) {
        if (corr.correctedStatus === 'PASS' && corr.originalStatus !== 'PASS') {
          passedFromCorrections++;
        }
      }
      
      // New score = original passed + corrections to PASS
      const originalPassed = report.originalScore !== null 
        ? Math.round((report.originalScore / 100) * report.totalControls)
        : report.passedControls;
      const newPassed = originalPassed + passedFromCorrections;
      const newScore = report.totalControls > 0 ? Math.round((newPassed / report.totalControls) * 100) : 0;
      
      // Determine new grade
      let newGrade = 'F';
      if (newScore >= 90) newGrade = 'A';
      else if (newScore >= 80) newGrade = 'B';
      else if (newScore >= 70) newGrade = 'C';
      else if (newScore >= 60) newGrade = 'D';
      else if (newScore >= 50) newGrade = 'E';

      // Update report with new score
      await db.update(auditReports)
        .set({ 
          score: newScore,
          grade: newGrade,
          passedControls: newPassed,
          failedControls: Math.max(0, report.totalControls - newPassed - report.warningControls)
        })
        .where(eq(auditReports.id, reportId));

      // Also update the machine's last score if this is the latest report
      const [latestReport] = await db.select()
        .from(auditReports)
        .where(eq(auditReports.machineId, report.machineId))
        .orderBy(sql`${auditReports.auditDate} DESC`)
        .limit(1);
      
      if (latestReport && latestReport.id === reportId) {
        await db.update(machines)
          .set({ lastScore: newScore, lastGrade: newGrade })
          .where(eq(machines.id, report.machineId));
      }

      res.json({ 
        success: true, 
        correction, 
        updated: !!existingCorrection,
        newScore,
        newGrade,
        originalScore: report.originalScore ?? report.score
      });
    } catch (error) {
      console.error("Error saving control correction:", error);
      res.status(500).json({ message: "Erreur lors de la sauvegarde de la correction" });
    }
  });

  // Delete a control correction
  app.delete("/api/fleet/corrections/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Non autorise" });
      }

      const correctionId = parseInt(req.params.id);
      if (isNaN(correctionId)) {
        return res.status(400).json({ message: "ID de correction invalide" });
      }

      await db.delete(controlCorrections).where(eq(controlCorrections.id, correctionId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting control correction:", error);
      res.status(500).json({ message: "Erreur lors de la suppression de la correction" });
    }
  });

  return httpServer;
}

// Helper function to detect OS from report data
function detectOS(reportData: any): string {
  // Check report_type first for IST script format (most reliable)
  const reportType = reportData.report_type?.toLowerCase() || '';
  if (reportType.includes('linux')) return 'linux';
  if (reportType.includes('windows')) return 'windows';
  if (reportType.includes('vmware') || reportType.includes('esxi')) return 'vmware';
  if (reportType.includes('docker') || reportType.includes('container') || reportType.includes('kubernetes')) return 'container';
  if (reportType.includes('netapp') || reportType.includes('ontap')) return 'netapp';
  if (reportType.includes('web')) return 'web';
  
  // Check other fields as fallback
  const osHints = [
    reportData.os,
    reportData.operating_system,
    reportData.system_info?.os,
    reportData.systemInfo?.os,
    reportData.platform
  ].filter(Boolean);

  for (const hint of osHints) {
    const lower = String(hint).toLowerCase();
    if (lower.includes('windows')) return 'windows';
    if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian') || lower.includes('centos') || lower.includes('rhel') || lower.includes('fedora') || lower.includes('suse')) return 'linux';
    if (lower.includes('vmware') || lower.includes('esxi')) return 'vmware';
    if (lower.includes('docker') || lower.includes('container') || lower.includes('kubernetes')) return 'container';
    if (lower.includes('netapp') || lower.includes('ontap')) return 'netapp';
  }
  return 'unknown';
}

// Helper function to detect OS version from report data
function detectOSVersion(reportData: any): string | null {
  // Check various common field locations for OS version
  const versionSources = [
    reportData.os_version,
    reportData.osVersion,
    reportData.system_info?.os_version,
    reportData.system_info?.version,
    reportData.system_info?.distribution,
    reportData.systemInfo?.osVersion,
    reportData.systemInfo?.version,
    reportData.operating_system_version,
    reportData.platform_version,
    reportData.distribution,
  ];
  
  for (const source of versionSources) {
    if (source && typeof source === 'string' && source.trim()) {
      return source.trim();
    }
  }
  
  // Try to extract from system_info.os field (contains full OS name with version)
  // e.g., "Debian GNU/Linux 13 (trixie)", "Ubuntu 22.04 LTS", "Windows Server 2019"
  const osField = reportData.system_info?.os || reportData.systemInfo?.os;
  if (osField && typeof osField === 'string') {
    return osField.trim();
  }
  
  return null;
}

// Helper function to calculate grade from score
function calculateGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  if (score >= 50) return 'E';
  return 'F';
}
