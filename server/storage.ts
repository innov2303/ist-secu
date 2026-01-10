import { scripts, purchases, type Script, type InsertScript, type Purchase, type InsertPurchase } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, ne, inArray } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

export interface IStorage {
  getScripts(): Promise<Script[]>;
  getVisibleScripts(): Promise<Script[]>;
  getScript(id: number): Promise<Script | undefined>;
  getBundledScripts(bundleId: number): Promise<Script[]>;
  createScript(script: InsertScript): Promise<Script>;
  updateScriptContent(id: number, content: string): Promise<void>;
  updateScriptsFromFiles(): Promise<void>;
  seed(): Promise<void>;
  // Purchase methods
  getPurchasesByUser(userId: string): Promise<(Purchase & { script: Script })[]>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  createPurchasesForBundle(userId: string, bundleScript: Script, purchaseType: string, priceCents: number, expiresAt: Date | null, stripePaymentIntentId?: string, stripeSubscriptionId?: string): Promise<void>;
  hasPurchasedBundle(userId: string, bundleScriptIds: number[]): Promise<boolean>;
  hasPurchased(userId: string, scriptId: number): Promise<boolean>;
  getActivePurchase(userId: string, scriptId: number): Promise<Purchase | null>;
}

export class DatabaseStorage implements IStorage {
  async getScripts(): Promise<Script[]> {
    return await db.select().from(scripts);
  }

  async getVisibleScripts(): Promise<Script[]> {
    return await db.select().from(scripts).where(eq(scripts.isHidden, 0));
  }

  async getBundledScripts(bundleId: number): Promise<Script[]> {
    const bundle = await this.getScript(bundleId);
    if (!bundle || !bundle.bundledScriptIds || bundle.bundledScriptIds.length === 0) {
      return [];
    }
    return await db.select().from(scripts).where(inArray(scripts.id, bundle.bundledScriptIds));
  }

  async getScript(id: number): Promise<Script | undefined> {
    const [script] = await db.select().from(scripts).where(eq(scripts.id, id));
    return script;
  }

  async createScript(script: InsertScript): Promise<Script> {
    const [newScript] = await db.insert(scripts).values(script).returning();
    return newScript;
  }

  async updateScriptContent(id: number, content: string): Promise<void> {
    await db.update(scripts).set({ content }).where(eq(scripts.id, id));
  }

  async getPurchasesByUser(userId: string): Promise<(Purchase & { script: Script })[]> {
    const userPurchases = await db
      .select()
      .from(purchases)
      .innerJoin(scripts, eq(purchases.scriptId, scripts.id))
      .where(eq(purchases.userId, userId));

    return userPurchases.map(row => ({
      ...row.purchases,
      script: row.scripts,
    }));
  }

  async createPurchase(purchase: InsertPurchase): Promise<Purchase> {
    const [newPurchase] = await db.insert(purchases).values(purchase).returning();
    return newPurchase;
  }

  async createPurchasesForBundle(
    userId: string, 
    bundleScript: Script, 
    purchaseType: string, 
    priceCents: number, 
    expiresAt: Date | null,
    stripePaymentIntentId?: string, 
    stripeSubscriptionId?: string
  ): Promise<void> {
    const scriptIds = bundleScript.bundledScriptIds || [];
    const pricePerScript = Math.floor(priceCents / scriptIds.length);

    // Create purchases ONLY for the bundled scripts (not the bundle itself)
    // The bundle is just a "shopping item", users own the actual scripts
    for (const scriptId of scriptIds) {
      const existing = await this.getActivePurchase(userId, scriptId);
      if (!existing) {
        await this.createPurchase({
          userId,
          scriptId,
          priceCents: pricePerScript,
          purchaseType,
          expiresAt,
          stripePaymentIntentId,
          stripeSubscriptionId,
        });
      }
    }
  }

  async hasPurchasedBundle(userId: string, bundleScriptIds: number[]): Promise<boolean> {
    // A bundle is considered purchased if ALL bundled scripts are purchased
    for (const scriptId of bundleScriptIds) {
      const purchase = await this.getActivePurchase(userId, scriptId);
      if (!purchase) return false;
    }
    return bundleScriptIds.length > 0;
  }

  async hasPurchased(userId: string, scriptId: number): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(purchases)
      .where(and(eq(purchases.userId, userId), eq(purchases.scriptId, scriptId)));
    return !!existing;
  }

  async getActivePurchase(userId: string, scriptId: number): Promise<Purchase | null> {
    const [existing] = await db
      .select()
      .from(purchases)
      .where(and(eq(purchases.userId, userId), eq(purchases.scriptId, scriptId)));
    
    if (!existing) return null;
    
    // Direct purchases never expire
    if (existing.purchaseType === "direct") return existing;
    
    // Monthly subscriptions: check expiration if set, otherwise assume active if has subscription ID
    if (existing.expiresAt) {
      if (new Date(existing.expiresAt) > new Date()) {
        return existing;
      }
      return null; // Expired
    }
    
    // If no expiration set but has subscription ID, consider it active (new subscription)
    if (existing.stripeSubscriptionId) {
      return existing;
    }
    
    return null;
  }

  async getStripePricesForProduct(productName: string): Promise<{oneTimePrice: string | null, recurringPrice: string | null}> {
    const result = await db.execute(sql`
      SELECT pr.id, pr.recurring
      FROM stripe.products p
      JOIN stripe.prices pr ON pr.product = p.id
      WHERE p.name = ${productName} AND p.active = true AND pr.active = true
    `);
    
    let oneTimePrice: string | null = null;
    let recurringPrice: string | null = null;
    
    for (const row of result.rows as any[]) {
      if (row.recurring) {
        recurringPrice = row.id;
      } else {
        oneTimePrice = row.id;
      }
    }
    
    return { oneTimePrice, recurringPrice };
  }

  async updatePurchaseSubscription(subscriptionId: string, expiresAt: Date | null): Promise<void> {
    await db
      .update(purchases)
      .set({ expiresAt })
      .where(eq(purchases.stripeSubscriptionId, subscriptionId));
  }

  async getPurchaseBySubscriptionId(subscriptionId: string): Promise<Purchase | null> {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.stripeSubscriptionId, subscriptionId));
    return purchase || null;
  }

  private loadScriptContent(filename: string): string {
    try {
      const scriptPath = path.join(process.cwd(), "scripts", filename);
      if (fs.existsSync(scriptPath)) {
        return fs.readFileSync(scriptPath, "utf-8");
      }
    } catch (e) {
      console.error(`Could not load script ${filename}:`, e);
    }
    return `# Placeholder for ${filename}`;
  }

  async updateScriptsFromFiles(): Promise<void> {
    const existingScripts = await this.getScripts();
    const scriptFiles: Record<string, string> = {
      "linux-security-base-anssi.sh": this.loadScriptContent("linux-security-base-anssi.sh"),
      "linux-security-enhanced-anssi.sh": this.loadScriptContent("linux-security-enhanced-anssi.sh"),
    };

    for (const script of existingScripts) {
      const fileContent = scriptFiles[script.filename];
      if (fileContent && !fileContent.startsWith("# Placeholder") && script.content !== fileContent) {
        console.log(`Updating script content for: ${script.filename}`);
        await this.updateScriptContent(script.id, fileContent);
      }
    }
  }

  async seed(): Promise<void> {
    const existing = await this.getScripts();
    if (existing.length > 0) return;

    const defaultScripts: InsertScript[] = [
      {
        os: "Windows",
        name: "Windows Compliance Toolkit",
        description: "Audit complet basé sur les guides ANSSI et benchmarks CIS pour environnements Windows. Vérifie la configuration système, les comptes utilisateurs, les services, le pare-feu et génère un rapport détaillé.",
        filename: "windows-security-audit-anssi.ps1",
        icon: "Monitor",
        compliance: "ANSSI & CIS",
        features: ["Génération de rapport PDF/JSON", "Score de conformité", "40+ contrôles de sécurité", "Recommandations de correction détaillées"],
        content: `# Windows Compliance Toolkit - ANSSI\n# Script complet à venir`,
        priceCents: 50000,
        monthlyPriceCents: 10000,
      },
      {
        os: "Linux",
        name: "Linux Security Base ANSSI",
        description: "Audit de sécurité de base pour systèmes Linux basé sur les recommandations essentielles ANSSI-BP-028. Vérifie le partitionnement, les comptes, SSH, le réseau, les permissions, les services et la journalisation.",
        filename: "linux-security-base-anssi.sh",
        icon: "Terminal",
        compliance: "ANSSI",
        features: ["~40 contrôles essentiels", "Génération de rapport HTML/JSON", "Score de conformité A-F", "Recommandations de correction", "Compatible Debian/Ubuntu/RHEL/CentOS"],
        content: this.loadScriptContent("linux-security-base-anssi.sh"),
        priceCents: 50000,
        monthlyPriceCents: 10000,
      },
      {
        os: "Linux",
        name: "Linux Security Enhanced ANSSI",
        description: "Audit de sécurité renforcé pour systèmes Linux couvrant l'intégralité des 80 contrôles ANSSI-BP-028 v2.0. Inclut kernel hardening, SELinux/AppArmor, PAM, chiffrement LUKS, sécurité systemd, conteneurs et plus.",
        filename: "linux-security-enhanced-anssi.sh",
        icon: "Terminal",
        compliance: "ANSSI-BP-028 v2.0",
        features: ["~80 contrôles complets", "Kernel hardening", "SELinux/AppArmor avancé", "PAM détaillé", "Chiffrement disque", "Sécurité conteneurs", "Rapport HTML/JSON"],
        content: this.loadScriptContent("linux-security-enhanced-anssi.sh"),
        priceCents: 80000,
        monthlyPriceCents: 15000,
      },
      {
        os: "VMware",
        name: "ESXi Host Validator",
        description: "Contrôle de sécurité complet pour hôtes VMware ESXi selon les recommandations CIS. Vérifie la configuration réseau, le stockage, les services et les accès.",
        filename: "esxi-security-audit-cis.py",
        icon: "Server",
        compliance: "CIS",
        features: ["Génération de rapport JSON/PDF", "Score de conformité", "Recommandations de correction"],
        content: `#!/usr/bin/env python3\n# ESXi Security Audit - CIS\n# Script complet à venir`,
        priceCents: 50000,
        monthlyPriceCents: 10000,
      },
      {
        os: "Docker",
        name: "Container Security Scanner",
        description: "Scan de sécurité Docker selon le benchmark CIS. Vérifie la configuration du daemon, les conteneurs, les images, les réseaux et les volumes.",
        filename: "docker-security-audit-cis.sh",
        icon: "Container",
        compliance: "CIS",
        features: ["Génération de rapport JSON", "Score de conformité", "Analyse des conteneurs en cours", "Recommandations de correction"],
        content: `#!/bin/bash\n# Docker Security Audit - CIS\n# Script complet à venir`,
        priceCents: 50000,
        monthlyPriceCents: 10000,
      }
    ];

    for (const script of defaultScripts) {
      await this.createScript(script);
    }
  }
}

export const storage = new DatabaseStorage();
