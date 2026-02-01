import crypto from 'crypto';

const LICENSE_SECRET = process.env.LICENSE_SECRET || process.env.SESSION_SECRET || 'ist-license-key-2026';

interface LicenseData {
  clientId: string;
  clientEmail: string;
  scriptId: number;
  scriptName: string;
  expiresAt: Date;
  generatedAt: Date;
}

/**
 * Generate a cryptographic signature for license data
 */
function generateSignature(data: Omit<LicenseData, 'generatedAt'> & { generatedAt: string }): string {
  const payload = JSON.stringify(data);
  return crypto.createHmac('sha256', LICENSE_SECRET).update(payload).digest('hex').substring(0, 32);
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
  
  const licenseData = {
    clientId,
    clientEmail,
    scriptId,
    scriptName,
    expiresAt,
    generatedAt: generatedAtStr
  };
  
  const signature = generateSignature(licenseData);
  const licenseId = `IST-${generatedAt.getFullYear()}-${scriptId.toString().padStart(4, '0')}-${signature.substring(0, 8).toUpperCase()}`;
  
  // Encode client info for watermark (base64 of client ID + email)
  const watermark = Buffer.from(`${clientId}:${clientEmail}`).toString('base64');
  
  if (isShellScript) {
    return `#!/bin/bash
#================================================================
# INFRA SHIELD TOOLS - Script sous licence
# https://ist-security.fr
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
    echo " Renouvelez votre abonnement sur https://ist-security.fr"
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
# https://ist-security.fr
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
        Write-Host " Renouvelez votre abonnement sur https://ist-security.fr"
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
  
  // Only inject license for shell and PowerShell scripts
  if (!isShellScript && !isPowerShell) {
    return originalContent;
  }
  
  const licenseHeader = generateLicenseHeader(
    clientId,
    clientEmail,
    scriptId,
    scriptName,
    expiresAt,
    isShellScript
  );
  
  // Remove existing shebang if present (for shell scripts)
  let cleanContent = originalContent;
  if (isShellScript && originalContent.startsWith('#!/')) {
    const lines = originalContent.split('\n');
    lines.shift(); // Remove shebang
    cleanContent = lines.join('\n');
  }
  
  return licenseHeader + cleanContent;
}
