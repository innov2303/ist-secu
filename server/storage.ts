import { scripts, purchases, type Script, type InsertScript, type Purchase, type InsertPurchase } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getScripts(): Promise<Script[]>;
  getScript(id: number): Promise<Script | undefined>;
  createScript(script: InsertScript): Promise<Script>;
  seed(): Promise<void>;
  // Purchase methods
  getPurchasesByUser(userId: string): Promise<(Purchase & { script: Script })[]>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  hasPurchased(userId: string, scriptId: number): Promise<boolean>;
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

  async seed(): Promise<void> {
    const existing = await this.getScripts();
    if (existing.length > 0) return;

    const defaultScripts: InsertScript[] = [
      {
        os: "Windows",
        name: "Windows Security Audit",
        description: "Audit complet basé sur les guides ANSSI et benchmarks CIS pour environnements Windows.",
        filename: "win_audit.ps1",
        icon: "Monitor",
        compliance: "ANSSI & CIS",
        features: ["Génération de rapport PDF", "Graphiques de score", "Recommandations de correction"],
        content: `# Windows Security Audit\nWrite-Host "Audit basé sur ANSSI/CIS..."`,
        priceCents: 4900, // 49€
      },
      {
        os: "Linux",
        name: "Linux Hardening Check",
        description: "Vérification de la conformité ANSSI (BP-028) et CIS pour serveurs Linux.",
        filename: "linux_audit.sh",
        icon: "Terminal",
        compliance: "ANSSI & CIS",
        features: ["Génération de rapport HTML", "Graphiques de score", "Recommandations de correction"],
        content: `#!/bin/bash\necho "Audit basé sur ANSSI/CIS..."`,
        priceCents: 4900,
      },
      {
        os: "VMware",
        name: "ESXi Host Validator",
        description: "Contrôle de sécurité pour hôtes ESXi selon les recommandations CIS.",
        filename: "esxi_check.py",
        icon: "Server",
        compliance: "CIS",
        features: ["Génération de rapport", "Recommandations de correction"],
        content: `#!/usr/bin/env python3\nprint("Audit basé sur CIS...")`,
        priceCents: 5900,
      },
      {
        os: "Docker",
        name: "Container Security Scanner",
        description: "Scan de configuration Docker selon le benchmark CIS.",
        filename: "docker_scan.sh",
        icon: "Container",
        compliance: "CIS",
        features: ["Génération de rapport", "Graphiques de score", "Recommandations de correction"],
        content: `#!/bin/bash\necho "Audit basé sur CIS..."`,
        priceCents: 3900,
      }
    ];

    for (const script of defaultScripts) {
      await this.createScript(script);
    }
  }
}

export const storage = new DatabaseStorage();
