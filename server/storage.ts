import { scripts, purchases, type Script, type InsertScript, type Purchase, type InsertPurchase } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

export interface IStorage {
  getScripts(): Promise<Script[]>;
  getScript(id: number): Promise<Script | undefined>;
  createScript(script: InsertScript): Promise<Script>;
  updateScriptContent(id: number, content: string): Promise<void>;
  updateScriptsFromFiles(): Promise<void>;
  seed(): Promise<void>;
  // Purchase methods
  getPurchasesByUser(userId: string): Promise<(Purchase & { script: Script })[]>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  hasPurchased(userId: string, scriptId: number): Promise<boolean>;
  getActivePurchase(userId: string, scriptId: number): Promise<Purchase | null>;
}

export class DatabaseStorage implements IStorage {
  async getScripts(): Promise<Script[]> {
    return await db.select().from(scripts);
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
    
    if (existing.purchaseType === "direct") return existing;
    
    if (existing.expiresAt && new Date(existing.expiresAt) > new Date()) {
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
      "linux-security-audit-anssi.sh": this.loadScriptContent("linux-security-audit-anssi.sh"),
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
        name: "Windows Security Audit",
        description: "Audit complet basé sur les guides ANSSI et benchmarks CIS pour environnements Windows. Vérifie la configuration système, les comptes utilisateurs, les services, le pare-feu et génère un rapport détaillé.",
        filename: "windows-security-audit-anssi.ps1",
        icon: "Monitor",
        compliance: "ANSSI & CIS",
        features: ["Génération de rapport PDF/JSON", "Score de conformité", "40+ contrôles de sécurité", "Recommandations de correction détaillées"],
        content: `# Windows Security Audit - ANSSI\n# Script complet à venir`,
        priceCents: 50000,
        monthlyPriceCents: 10000,
      },
      {
        os: "Linux",
        name: "Linux Security Audit ANSSI",
        description: "Audit de sécurité complet pour systèmes Linux basé sur les recommandations ANSSI. Vérifie le partitionnement, les comptes, SSH, le réseau, les permissions, les services et la journalisation.",
        filename: "linux-security-audit-anssi.sh",
        icon: "Terminal",
        compliance: "ANSSI",
        features: ["40+ contrôles de sécurité", "Génération de rapport JSON", "Score de conformité A-F", "Recommandations de correction", "Compatible Debian/Ubuntu/RHEL/CentOS"],
        content: this.loadScriptContent("linux-security-audit-anssi.sh"),
        priceCents: 50000,
        monthlyPriceCents: 10000,
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
