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
        description: "Comprehensive security check for Windows Server & Desktop. Checks firewall, updates, and user privileges.",
        filename: "win_audit.ps1",
        icon: "Monitor",
        content: `# Windows Security Audit Script
Write-Host "Starting Windows Security Audit..."
Write-Host "Checking Firewall Status..."
Get-NetFirewallProfile | Select-Object Name, Enabled
Write-Host "Checking Windows Update Status..."
# Add real checks here
Write-Host "Audit Complete."
`
      },
      {
        os: "Linux",
        name: "Linux Hardening Check",
        description: "Standard hardening verification for Linux systems (Ubuntu/RHEL). Checks SSH config, permissions, and running services.",
        filename: "linux_audit.sh",
        icon: "Terminal",
        content: `#!/bin/bash
echo "Starting Linux Security Audit..."
echo "Checking SSH Config..."
grep "^PermitRootLogin" /etc/ssh/sshd_config
echo "Checking Firewalld..."
systemctl status firewalld
echo "Audit Complete."
`
      },
      {
        os: "VMware",
        name: "ESXi Host Validator",
        description: "Validates ESXi host configuration against security best practices. Checks network policies and shell access.",
        filename: "esxi_check.py",
        icon: "Server",
        content: `#!/usr/bin/env python3
print("Starting ESXi Security Audit...")
# Placeholder for pyVmomi checks
print("Checking vSwitch Security Policies...")
print("Audit Complete.")
`
      },
      {
        os: "Docker",
        name: "Container Security Scanner",
        description: "Scans running containers for common misconfigurations. Checks for privileged mode and root users.",
        filename: "docker_scan.sh",
        icon: "Container",
        content: `#!/bin/bash
echo "Starting Docker Security Audit..."
docker ps --quiet | xargs docker inspect --format '{{ .Id }}: {{ .HostConfig.Privileged }}'
echo "Audit Complete."
`
      }
    ];

    for (const script of defaultScripts) {
      await this.createScript(script);
    }
  }
}

export const storage = new DatabaseStorage();
