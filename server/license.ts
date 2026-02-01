import crypto from 'crypto';

const LICENSE_SECRET = process.env.LICENSE_SECRET || process.env.SESSION_SECRET || 'ist-license-key-2026';

interface LicensePayload {
  clientId: string;
  clientEmail: string;
  scriptId: number;
  expiresAt: string;
  generatedAt: string;
}

/**
 * Generate a cryptographic signature for license data
 */
function generateSignature(payload: LicensePayload): string {
  const data = `${payload.clientId}|${payload.scriptId}|${payload.expiresAt}|${payload.generatedAt}`;
  return crypto.createHmac('sha256', LICENSE_SECRET).update(data).digest('hex').substring(0, 32);
}

/**
 * Generate license header to inject into scripts
 */
export function generateLicenseHeader(
  clientId: string,
  clientEmail: string,
  scriptId: number,
  scriptName: string,
  expiresAt: Date,
  isShellScript: boolean = true
): string {
  const generatedAt = new Date();
  const expiresAtStr = expiresAt.toISOString().split('T')[0];
  const generatedAtStr = generatedAt.toISOString().split('T')[0];
  
  const payload: LicensePayload = {
    clientId,
    clientEmail,
    scriptId,
    expiresAt: expiresAtStr,
    generatedAt: generatedAtStr
  };
  
  const signature = generateSignature(payload);
  const licenseId = `IST-${generatedAt.getFullYear()}-${scriptId.toString().padStart(4, '0')}-${signature.substring(0, 8).toUpperCase()}`;
  
  // Encode client info for watermark (hashed for privacy)
  const watermark = crypto.createHash('sha256').update(`${clientId}:${clientEmail}`).digest('hex').substring(0, 16);
  
  if (isShellScript) {
    return `#!/bin/bash
#================================================================
# INFRA SHIELD TOOLS - Script sous licence
# https://ist-secu.com
#================================================================
# Licence: ${licenseId}
# Client: ${clientEmail}
# Expire: ${expiresAtStr}
# Genere: ${generatedAtStr}
# WM: ${watermark}
# Sig: ${signature}
#================================================================

# Verification de licence - Ne pas modifier
_ist_verify_license() {
  local exp_date="${expiresAtStr}"
  local today=\$(date +%Y-%m-%d)
  if [[ "\$today" > "\$exp_date" ]]; then
    echo ""
    echo "================================================================"
    echo " LICENCE EXPIREE"
    echo " Votre licence a expire le \$exp_date"
    echo " Renouvelez votre abonnement sur https://ist-secu.com"
    echo "================================================================"
    echo ""
    exit 1
  fi
}
_ist_verify_license

`;
  } else {
    // PowerShell script
    return `#================================================================
# INFRA SHIELD TOOLS - Script sous licence
# https://ist-secu.com
#================================================================
# Licence: ${licenseId}
# Client: ${clientEmail}
# Expire: ${expiresAtStr}
# Genere: ${generatedAtStr}
# WM: ${watermark}
# Sig: ${signature}
#================================================================

# Verification de licence - Ne pas modifier
function Test-ISTLicense {
    \$expDate = [DateTime]::ParseExact("${expiresAtStr}", "yyyy-MM-dd", \$null)
    \$today = Get-Date
    if (\$today -gt \$expDate) {
        Write-Host ""
        Write-Host "================================================================"
        Write-Host " LICENCE EXPIREE"
        Write-Host " Votre licence a expire le ${expiresAtStr}"
        Write-Host " Renouvelez votre abonnement sur https://ist-secu.com"
        Write-Host "================================================================"
        Write-Host ""
        exit 1
    }
}
Test-ISTLicense

`;
  }
}

/**
 * Generate Python license header
 */
function generatePythonLicenseHeader(
  clientEmail: string,
  expiresAtStr: string,
  generatedAtStr: string,
  licenseId: string,
  watermark: string,
  signature: string
): string {
  return `#!/usr/bin/env python3
#================================================================
# INFRA SHIELD TOOLS - Script sous licence
# https://ist-secu.com
#================================================================
# Licence: ${licenseId}
# Client: ${clientEmail}
# Expire: ${expiresAtStr}
# Genere: ${generatedAtStr}
# WM: ${watermark}
# Sig: ${signature}
#================================================================

# Verification de licence - Ne pas modifier
import sys
from datetime import datetime

def _ist_verify_license():
    exp_date = datetime.strptime("${expiresAtStr}", "%Y-%m-%d")
    today = datetime.now()
    if today > exp_date:
        print("")
        print("================================================================")
        print(" LICENCE EXPIREE")
        print(f" Votre licence a expire le ${expiresAtStr}")
        print(" Renouvelez votre abonnement sur https://ist-secu.com")
        print("================================================================")
        print("")
        sys.exit(1)

_ist_verify_license()

`;
}

/**
 * Inject license into script content
 * Replaces the shebang line with licensed header + original content
 */
export function injectLicense(
  originalContent: string,
  clientId: string,
  clientEmail: string,
  scriptId: number,
  scriptName: string,
  expiresAt: Date,
  filename: string
): string {
  const isShellScript = filename.endsWith('.sh') || filename.endsWith('.bash');
  const isPowerShell = filename.endsWith('.ps1');
  const isPython = filename.endsWith('.py');
  
  // Only inject license for supported script types
  if (!isShellScript && !isPowerShell && !isPython) {
    return originalContent;
  }
  
  const generatedAt = new Date();
  const expiresAtStr = expiresAt.toISOString().split('T')[0];
  const generatedAtStr = generatedAt.toISOString().split('T')[0];
  
  const payload: LicensePayload = {
    clientId,
    clientEmail,
    scriptId,
    expiresAt: expiresAtStr,
    generatedAt: generatedAtStr
  };
  
  const signature = generateSignature(payload);
  const licenseId = `IST-${generatedAt.getFullYear()}-${scriptId.toString().padStart(4, '0')}-${signature.substring(0, 8).toUpperCase()}`;
  const watermark = crypto.createHash('sha256').update(`${clientId}:${clientEmail}`).digest('hex').substring(0, 16);
  
  let licenseHeader: string;
  if (isPython) {
    licenseHeader = generatePythonLicenseHeader(clientEmail, expiresAtStr, generatedAtStr, licenseId, watermark, signature);
  } else {
    licenseHeader = generateLicenseHeader(clientId, clientEmail, scriptId, scriptName, expiresAt, isShellScript);
  }
  
  // Remove existing shebang if present
  let cleanContent = originalContent;
  if ((isShellScript || isPython) && originalContent.startsWith('#!/')) {
    const lines = originalContent.split('\n');
    lines.shift(); // Remove shebang
    cleanContent = lines.join('\n');
  }
  
  return licenseHeader + cleanContent;
}
