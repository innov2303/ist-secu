import { scripts, type Script, type InsertScript } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getScripts(): Promise<Script[]>;
  getScript(id: number): Promise<Script | undefined>;
  createScript(script: InsertScript): Promise<Script>;
  seed(): Promise<void>;
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
        content: `# Windows Security Audit\nWrite-Host "Audit basé sur ANSSI/CIS..."`
      },
      {
        os: "Linux",
        name: "Linux Hardening Check",
        description: "Vérification de la conformité ANSSI (BP-028) et CIS pour serveurs Linux.",
        filename: "linux_audit.sh",
        icon: "Terminal",
        compliance: "ANSSI & CIS",
        features: ["Génération de rapport HTML", "Graphiques de score", "Recommandations de correction"],
        content: `#!/bin/bash\necho "Audit basé sur ANSSI/CIS..."`
      },
      {
        os: "VMware",
        name: "ESXi Host Validator",
        description: "Contrôle de sécurité pour hôtes ESXi selon les recommandations CIS.",
        filename: "esxi_check.py",
        icon: "Server",
        compliance: "CIS",
        features: ["Génération de rapport", "Recommandations de correction"],
        content: `#!/usr/bin/env python3\nprint("Audit basé sur CIS...")`
      },
      {
        os: "Docker",
        name: "Container Security Scanner",
        description: "Scan de configuration Docker selon le benchmark CIS.",
        filename: "docker_scan.sh",
        icon: "Container",
        compliance: "CIS",
        features: ["Génération de rapport", "Graphiques de score", "Recommandations de correction"],
        content: `#!/bin/bash\necho "Audit basé sur CIS..."`
      }
    ];

    for (const script of defaultScripts) {
      await this.createScript(script);
    }
  }
}

export const storage = new DatabaseStorage();
