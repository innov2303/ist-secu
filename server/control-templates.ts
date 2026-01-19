// Control code templates for different security standards
// These templates generate PowerShell or Bash code for security checks

export interface ControlTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  reference: string;
  scriptType: "powershell" | "bash" | "both";
  powershellCode?: string;
  bashCode?: string;
}

// OWASP Web Security Control Templates (PowerShell)
export const owaspWebTemplates: ControlTemplate[] = [
  {
    id: "OWASP-HEADERS-01",
    name: "Strict-Transport-Security Check",
    description: "Verifie la presence et configuration du header HSTS",
    category: "Headers HTTP",
    severity: "high",
    reference: "OWASP ASVS 9.1.1",
    scriptType: "powershell",
    powershellCode: `
function Test-HSTS {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop
        $hsts = $response.Headers["Strict-Transport-Security"]
        if ($hsts) {
            $maxAge = if ($hsts -match "max-age=(\\d+)") { [int]$Matches[1] } else { 0 }
            $includeSubdomains = $hsts -match "includeSubDomains"
            return @{
                Status = if ($maxAge -ge 31536000) { "PASS" } else { "WARN" }
                Value = $hsts
                MaxAge = $maxAge
                IncludeSubdomains = $includeSubdomains
                Recommendation = if ($maxAge -lt 31536000) { "max-age should be at least 31536000 (1 year)" } else { $null }
            }
        }
        return @{ Status = "FAIL"; Value = $null; Recommendation = "Add Strict-Transport-Security header" }
    } catch { return @{ Status = "ERROR"; Error = $_.Exception.Message } }
}
$results["OWASP-HEADERS-01"] = Test-HSTS -Url $TargetUrl`,
  },
  {
    id: "OWASP-HEADERS-02",
    name: "Content-Security-Policy Check",
    description: "Verifie la presence et configuration du header CSP",
    category: "Headers HTTP",
    severity: "high",
    reference: "OWASP ASVS 14.4.3",
    scriptType: "powershell",
    powershellCode: `
function Test-CSP {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop
        $csp = $response.Headers["Content-Security-Policy"]
        if ($csp) {
            $hasDefaultSrc = $csp -match "default-src"
            $hasScriptSrc = $csp -match "script-src"
            $hasUnsafeInline = $csp -match "'unsafe-inline'"
            $hasUnsafeEval = $csp -match "'unsafe-eval'"
            return @{
                Status = if ($hasDefaultSrc -and -not $hasUnsafeInline -and -not $hasUnsafeEval) { "PASS" } elseif ($csp) { "WARN" } else { "FAIL" }
                Value = $csp
                HasDefaultSrc = $hasDefaultSrc
                HasUnsafeInline = $hasUnsafeInline
                HasUnsafeEval = $hasUnsafeEval
                Recommendation = if ($hasUnsafeInline) { "Remove 'unsafe-inline' from CSP" } elseif ($hasUnsafeEval) { "Remove 'unsafe-eval' from CSP" } else { $null }
            }
        }
        return @{ Status = "FAIL"; Value = $null; Recommendation = "Add Content-Security-Policy header" }
    } catch { return @{ Status = "ERROR"; Error = $_.Exception.Message } }
}
$results["OWASP-HEADERS-02"] = Test-CSP -Url $TargetUrl`,
  },
  {
    id: "OWASP-HEADERS-03",
    name: "X-Content-Type-Options Check",
    description: "Verifie la presence du header X-Content-Type-Options: nosniff",
    category: "Headers HTTP",
    severity: "medium",
    reference: "OWASP ASVS 14.4.4",
    scriptType: "powershell",
    powershellCode: `
function Test-XContentTypeOptions {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop
        $header = $response.Headers["X-Content-Type-Options"]
        if ($header -eq "nosniff") {
            return @{ Status = "PASS"; Value = $header }
        }
        return @{ Status = "FAIL"; Value = $header; Recommendation = "Set X-Content-Type-Options: nosniff" }
    } catch { return @{ Status = "ERROR"; Error = $_.Exception.Message } }
}
$results["OWASP-HEADERS-03"] = Test-XContentTypeOptions -Url $TargetUrl`,
  },
  {
    id: "OWASP-HEADERS-04",
    name: "X-Frame-Options Check",
    description: "Verifie la protection contre le clickjacking",
    category: "Headers HTTP",
    severity: "medium",
    reference: "OWASP ASVS 14.4.7",
    scriptType: "powershell",
    powershellCode: `
function Test-XFrameOptions {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop
        $xfo = $response.Headers["X-Frame-Options"]
        $csp = $response.Headers["Content-Security-Policy"]
        $hasFrameAncestors = $csp -match "frame-ancestors"
        if ($xfo -match "^(DENY|SAMEORIGIN)$" -or $hasFrameAncestors) {
            return @{ Status = "PASS"; Value = if ($xfo) { $xfo } else { "CSP frame-ancestors" } }
        }
        return @{ Status = "FAIL"; Value = $xfo; Recommendation = "Set X-Frame-Options: DENY or SAMEORIGIN" }
    } catch { return @{ Status = "ERROR"; Error = $_.Exception.Message } }
}
$results["OWASP-HEADERS-04"] = Test-XFrameOptions -Url $TargetUrl`,
  },
  {
    id: "OWASP-TLS-01",
    name: "TLS Version Check",
    description: "Verifie que seuls TLS 1.2+ sont actives",
    category: "TLS/SSL",
    severity: "critical",
    reference: "OWASP ASVS 9.1.2",
    scriptType: "powershell",
    powershellCode: `
function Test-TLSVersion {
    param([string]$Hostname, [int]$Port = 443)
    $results = @{}
    $protocols = @{
        "SSL3" = [System.Security.Authentication.SslProtocols]::Ssl3
        "TLS10" = [System.Security.Authentication.SslProtocols]::Tls
        "TLS11" = [System.Security.Authentication.SslProtocols]::Tls11
        "TLS12" = [System.Security.Authentication.SslProtocols]::Tls12
        "TLS13" = [System.Security.Authentication.SslProtocols]::Tls13
    }
    foreach ($proto in $protocols.GetEnumerator()) {
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient($Hostname, $Port)
            $sslStream = New-Object System.Net.Security.SslStream($tcpClient.GetStream())
            $sslStream.AuthenticateAsClient($Hostname, $null, $proto.Value, $false)
            $results[$proto.Key] = "Enabled"
            $sslStream.Close()
            $tcpClient.Close()
        } catch {
            $results[$proto.Key] = "Disabled"
        }
    }
    $insecure = @("SSL3", "TLS10", "TLS11") | Where-Object { $results[$_] -eq "Enabled" }
    return @{
        Status = if ($insecure.Count -eq 0) { "PASS" } else { "FAIL" }
        Protocols = $results
        InsecureProtocols = $insecure
        Recommendation = if ($insecure.Count -gt 0) { "Disable: $($insecure -join ', ')" } else { $null }
    }
}
$uri = [System.Uri]$TargetUrl
$results["OWASP-TLS-01"] = Test-TLSVersion -Hostname $uri.Host`,
  },
  {
    id: "OWASP-COOKIES-01",
    name: "Cookie Security Flags",
    description: "Verifie les flags Secure, HttpOnly et SameSite sur les cookies",
    category: "Cookies",
    severity: "high",
    reference: "OWASP ASVS 3.4.1",
    scriptType: "powershell",
    powershellCode: `
function Test-CookieFlags {
    param([string]$Url)
    try {
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -SessionVariable session -ErrorAction Stop
        $cookies = $session.Cookies.GetCookies($Url)
        $issues = @()
        foreach ($cookie in $cookies) {
            if (-not $cookie.Secure) { $issues += "$($cookie.Name): Missing Secure flag" }
            if (-not $cookie.HttpOnly) { $issues += "$($cookie.Name): Missing HttpOnly flag" }
        }
        $setCookieHeaders = $response.Headers["Set-Cookie"]
        if ($setCookieHeaders) {
            foreach ($header in $setCookieHeaders) {
                if ($header -notmatch "SameSite") { 
                    $name = if ($header -match "^([^=]+)=") { $Matches[1] } else { "Unknown" }
                    $issues += "$name: Missing SameSite attribute"
                }
            }
        }
        return @{
            Status = if ($issues.Count -eq 0) { "PASS" } else { "WARN" }
            CookieCount = $cookies.Count
            Issues = $issues
            Recommendation = if ($issues.Count -gt 0) { "Fix cookie security flags" } else { $null }
        }
    } catch { return @{ Status = "ERROR"; Error = $_.Exception.Message } }
}
$results["OWASP-COOKIES-01"] = Test-CookieFlags -Url $TargetUrl`,
  },
];

// Linux/ANSSI Control Templates (Bash)
export const anssiLinuxTemplates: ControlTemplate[] = [
  {
    id: "ANSSI-R1",
    name: "Partition /tmp separee",
    description: "Verifie que /tmp est sur une partition separee avec noexec,nosuid",
    category: "Partitionnement",
    severity: "high",
    reference: "ANSSI-BP-028 R1",
    scriptType: "bash",
    bashCode: `
check_tmp_partition() {
    local mount_info=$(findmnt -n -o OPTIONS /tmp 2>/dev/null)
    if [ -z "$mount_info" ]; then
        echo '{"status":"FAIL","message":"/tmp is not a separate partition","recommendation":"Create separate partition for /tmp"}'
        return 1
    fi
    local has_noexec=$(echo "$mount_info" | grep -c "noexec")
    local has_nosuid=$(echo "$mount_info" | grep -c "nosuid")
    if [ "$has_noexec" -gt 0 ] && [ "$has_nosuid" -gt 0 ]; then
        echo '{"status":"PASS","options":"'"$mount_info"'"}'
        return 0
    else
        echo '{"status":"WARN","options":"'"$mount_info"'","recommendation":"Add noexec,nosuid options to /tmp"}'
        return 1
    fi
}
results["ANSSI-R1"]=$(check_tmp_partition)`,
  },
  {
    id: "ANSSI-R8",
    name: "Permissions fichiers sensibles",
    description: "Verifie les permissions sur /etc/passwd, /etc/shadow, /etc/group",
    category: "Permissions",
    severity: "critical",
    reference: "ANSSI-BP-028 R8",
    scriptType: "bash",
    bashCode: `
check_sensitive_files_perms() {
    local issues=()
    local passwd_perms=$(stat -c "%a" /etc/passwd 2>/dev/null)
    local shadow_perms=$(stat -c "%a" /etc/shadow 2>/dev/null)
    local group_perms=$(stat -c "%a" /etc/group 2>/dev/null)
    
    [ "$passwd_perms" != "644" ] && issues+=("/etc/passwd should be 644, is $passwd_perms")
    [ "$shadow_perms" != "000" ] && [ "$shadow_perms" != "400" ] && issues+=("/etc/shadow should be 000 or 400, is $shadow_perms")
    [ "$group_perms" != "644" ] && issues+=("/etc/group should be 644, is $group_perms")
    
    if [ \${#issues[@]} -eq 0 ]; then
        echo '{"status":"PASS","passwd":"'"$passwd_perms"'","shadow":"'"$shadow_perms"'","group":"'"$group_perms"'"}'
    else
        echo '{"status":"FAIL","issues":'"$(printf '%s\n' "\${issues[@]}" | jq -R . | jq -s .)"'}'
    fi
}
results["ANSSI-R8"]=$(check_sensitive_files_perms)`,
  },
  {
    id: "ANSSI-R29",
    name: "SSH Root Login Disabled",
    description: "Verifie que la connexion root SSH est desactivee",
    category: "SSH",
    severity: "critical",
    reference: "ANSSI-BP-028 R29",
    scriptType: "bash",
    bashCode: `
check_ssh_root_login() {
    local sshd_config="/etc/ssh/sshd_config"
    if [ ! -f "$sshd_config" ]; then
        echo '{"status":"N/A","message":"SSH not installed"}'
        return 0
    fi
    local permit_root=$(grep -E "^PermitRootLogin" "$sshd_config" 2>/dev/null | awk '{print $2}')
    if [ "$permit_root" = "no" ]; then
        echo '{"status":"PASS","value":"no"}'
    elif [ -z "$permit_root" ] || [ "$permit_root" = "prohibit-password" ]; then
        echo '{"status":"WARN","value":"'"$permit_root"'","recommendation":"Set PermitRootLogin no"}'
    else
        echo '{"status":"FAIL","value":"'"$permit_root"'","recommendation":"Set PermitRootLogin no in sshd_config"}'
    fi
}
results["ANSSI-R29"]=$(check_ssh_root_login)`,
  },
];

// Windows/CIS Control Templates (PowerShell)
export const cisWindowsTemplates: ControlTemplate[] = [
  {
    id: "CIS-WIN-1.1.1",
    name: "Password History",
    description: "Verifie que l'historique des mots de passe est configure a 24 ou plus",
    category: "Account Policies",
    severity: "medium",
    reference: "CIS Windows Server Benchmark 1.1.1",
    scriptType: "powershell",
    powershellCode: `
function Test-PasswordHistory {
    try {
        $policy = Get-ADDefaultDomainPasswordPolicy -ErrorAction Stop
        $historyCount = $policy.PasswordHistoryCount
        return @{
            Status = if ($historyCount -ge 24) { "PASS" } else { "FAIL" }
            Value = $historyCount
            Recommendation = if ($historyCount -lt 24) { "Set password history to 24 or more" } else { $null }
        }
    } catch {
        $netAccounts = net accounts 2>&1
        $historyLine = $netAccounts | Select-String "Length of password history"
        $history = if ($historyLine -match "(\\d+)") { [int]$Matches[1] } else { 0 }
        return @{
            Status = if ($history -ge 24) { "PASS" } else { "FAIL" }
            Value = $history
            Recommendation = if ($history -lt 24) { "Set password history to 24 or more" } else { $null }
        }
    }
}
$results["CIS-WIN-1.1.1"] = Test-PasswordHistory`,
  },
  {
    id: "CIS-WIN-2.3.1",
    name: "Audit Policy Configuration",
    description: "Verifie que l'audit des evenements de securite est active",
    category: "Audit Policy",
    severity: "high",
    reference: "CIS Windows Server Benchmark 17.x",
    scriptType: "powershell",
    powershellCode: `
function Test-AuditPolicy {
    $auditpol = auditpol /get /category:* 2>&1
    $logon = $auditpol | Select-String "Logon" | Select-Object -First 1
    $hasSuccess = $logon -match "Success"
    $hasFailure = $logon -match "Failure"
    return @{
        Status = if ($hasSuccess -and $hasFailure) { "PASS" } elseif ($hasSuccess -or $hasFailure) { "WARN" } else { "FAIL" }
        LogonAudit = $logon.ToString().Trim()
        Recommendation = if (-not ($hasSuccess -and $hasFailure)) { "Enable Success and Failure auditing for Logon events" } else { $null }
    }
}
$results["CIS-WIN-2.3.1"] = Test-AuditPolicy`,
  },
];

// Function to get code template based on control ID and script type
export function getControlCode(controlId: string, scriptOS: string): string | null {
  const allTemplates = [...owaspWebTemplates, ...anssiLinuxTemplates, ...cisWindowsTemplates];
  const template = allTemplates.find(t => t.id === controlId);
  
  if (!template) return null;
  
  if (scriptOS.toLowerCase() === "linux" || scriptOS.toLowerCase() === "docker") {
    return template.bashCode || null;
  } else if (scriptOS.toLowerCase() === "windows" || scriptOS.toLowerCase() === "web" || scriptOS.toLowerCase() === "vmware") {
    return template.powershellCode || null;
  }
  
  return template.powershellCode || template.bashCode || null;
}

// Generate control code from suggestion data
export function generateControlCode(
  controlId: string,
  name: string,
  description: string,
  category: string,
  severity: string,
  reference: string,
  scriptOS: string
): string {
  // First check if we have a predefined template
  const templateCode = getControlCode(controlId, scriptOS);
  if (templateCode) return templateCode;
  
  // Otherwise generate a generic template based on OS
  const isWindows = ["windows", "web", "vmware"].includes(scriptOS.toLowerCase());
  
  if (isWindows) {
    return `
# ${controlId}: ${name}
# ${description}
# Reference: ${reference}
# Severity: ${severity}
function Test-${controlId.replace(/[^a-zA-Z0-9]/g, '')} {
    # TODO: Implement check for ${name}
    # Category: ${category}
    return @{
        Status = "MANUAL"
        ControlId = "${controlId}"
        Name = "${name}"
        Description = "${description}"
        Recommendation = "Manual verification required"
    }
}
$results["${controlId}"] = Test-${controlId.replace(/[^a-zA-Z0-9]/g, '')}`;
  } else {
    return `
# ${controlId}: ${name}
# ${description}
# Reference: ${reference}
# Severity: ${severity}
check_${controlId.toLowerCase().replace(/[^a-z0-9]/g, '_')}() {
    # TODO: Implement check for ${name}
    # Category: ${category}
    echo '{"status":"MANUAL","controlId":"${controlId}","name":"${name}","recommendation":"Manual verification required"}'
}
results["${controlId}"]=$(check_${controlId.toLowerCase().replace(/[^a-z0-9]/g, '_')})`;
  }
}
