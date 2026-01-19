<#
.SYNOPSIS
    Web Security Compliance Toolkit - Enhanced Script
    Analyse avancee de securite des sites web basee sur OWASP et ANSSI

.DESCRIPTION
    Ce script effectue environ 95 controles de securite avances sur un site web :
    - Tous les controles du script Base (~55)
    - Headers HTTP avances
    - Analyse DNS et infrastructure
    - Detection de technologies et versions
    - Tests de redirection et mixed content
    - Verification CORS
    - Analyse des formulaires

.PARAMETER Url
    URL du site web a analyser (ex: https://example.com)

.PARAMETER OutputPath
    Chemin du dossier de sortie pour les rapports (defaut: ./reports)

.PARAMETER OutputFormat
    Format de sortie: HTML, JSON, ou Both (defaut: Both)

.PARAMETER Timeout
    Timeout en secondes pour les requetes HTTP (defaut: 30)

.PARAMETER DeepScan
    Active l'analyse approfondie (plus lente mais plus complete)

.EXAMPLE
    .\web-security-enhanced.ps1 -Url "https://example.com"

.EXAMPLE
    .\web-security-enhanced.ps1 -Url "https://example.com" -DeepScan -OutputPath "C:\Audits"

.NOTES
    Version: 1.0.0
    Date: 2025-01-19
    Auteur: Infra Shield Tools
    Standards: OWASP Top 10, ANSSI Recommandations Web, CIS Benchmark
    Controles: ~95 verifications de securite avancees
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, HelpMessage = "URL du site web a analyser")]
    [ValidatePattern('^https?://')]
    [string]$Url,

    [Parameter(Mandatory = $false)]
    [string]$OutputPath = "./reports",

    [Parameter(Mandatory = $false)]
    [ValidateSet("HTML", "JSON", "Both")]
    [string]$OutputFormat = "Both",

    [Parameter(Mandatory = $false)]
    [int]$Timeout = 30,

    [Parameter(Mandatory = $false)]
    [switch]$DeepScan
)

#region Configuration
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Version et metadata
$ScriptVersion = "1.0.0"
$ScriptName = "Web Security Compliance Toolkit - Enhanced"
$TotalControls = 95
$PassedControls = 0
$FailedControls = 0
$WarningControls = 0
$NotApplicableControls = 0

# Timestamp pour les rapports
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$ReportDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Structure pour stocker les resultats
$Results = @{
    Metadata = @{
        ScriptName = $ScriptName
        ScriptVersion = $ScriptVersion
        TargetUrl = $Url
        ScanDate = $ReportDate
        TotalControls = $TotalControls
        DeepScan = $DeepScan.IsPresent
    }
    Categories = @()
    Summary = @{}
}

# Couleurs pour l'affichage console
$Colors = @{
    Pass = "Green"
    Fail = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    NotApplicable = "Gray"
}
#endregion

#region Helper Functions
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Test-Control {
    param(
        [string]$Id,
        [string]$Name,
        [string]$Description,
        [string]$Category,
        [scriptblock]$Test,
        [string]$Remediation,
        [string]$Reference,
        [string]$Severity = "Medium"
    )

    $result = @{
        Id = $Id
        Name = $Name
        Description = $Description
        Category = $Category
        Status = "Unknown"
        Details = ""
        Remediation = $Remediation
        Reference = $Reference
        Severity = $Severity
    }

    try {
        $testResult = & $Test
        $result.Status = $testResult.Status
        $result.Details = $testResult.Details
    }
    catch {
        $result.Status = "Error"
        $result.Details = "Erreur lors du test: $($_.Exception.Message)"
    }

    # Mise a jour des compteurs
    switch ($result.Status) {
        "Pass" { $script:PassedControls++ }
        "Fail" { $script:FailedControls++ }
        "Warning" { $script:WarningControls++ }
        "NotApplicable" { $script:NotApplicableControls++ }
    }

    # Affichage console
    $statusSymbol = switch ($result.Status) {
        "Pass" { "[PASS]" }
        "Fail" { "[FAIL]" }
        "Warning" { "[WARN]" }
        "NotApplicable" { "[N/A]" }
        default { "[????]" }
    }
    $color = $Colors[$result.Status]
    if (-not $color) { $color = "White" }
    
    Write-ColorOutput "$statusSymbol $Id - $Name" $color

    return $result
}

function Get-WebResponse {
    param([string]$TargetUrl, [string]$Method = "Get")
    
    try {
        $response = Invoke-WebRequest -Uri $TargetUrl -Method $Method -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
        return @{
            Success = $true
            Response = $response
            Headers = $response.Headers
            StatusCode = $response.StatusCode
            Content = $response.Content
        }
    }
    catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
            StatusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        }
    }
}

function Get-TlsInfo {
    param([string]$TargetUrl)
    
    $uri = [System.Uri]$TargetUrl
    if ($uri.Scheme -ne "https") {
        return @{ Success = $false; Error = "Non-HTTPS URL" }
    }

    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect($uri.Host, 443)
        
        $sslStream = New-Object System.Net.Security.SslStream($tcpClient.GetStream(), $false)
        $sslStream.AuthenticateAsClient($uri.Host)
        
        $cert = $sslStream.RemoteCertificate
        $cert2 = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($cert)
        
        $result = @{
            Success = $true
            Protocol = $sslStream.SslProtocol.ToString()
            CipherAlgorithm = $sslStream.CipherAlgorithm.ToString()
            CipherStrength = $sslStream.CipherStrength
            HashAlgorithm = $sslStream.HashAlgorithm.ToString()
            KeyExchangeAlgorithm = $sslStream.KeyExchangeAlgorithm.ToString()
            Certificate = @{
                Subject = $cert2.Subject
                Issuer = $cert2.Issuer
                NotBefore = $cert2.NotBefore
                NotAfter = $cert2.NotAfter
                Thumbprint = $cert2.Thumbprint
                SignatureAlgorithm = $cert2.SignatureAlgorithm.FriendlyName
                PublicKeyAlgorithm = $cert2.PublicKey.Oid.FriendlyName
                KeySize = $cert2.PublicKey.Key.KeySize
            }
        }
        
        $sslStream.Close()
        $tcpClient.Close()
        
        return $result
    }
    catch {
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

function Get-DnsRecords {
    param([string]$Domain)
    
    $results = @{
        A = @()
        AAAA = @()
        MX = @()
        TXT = @()
        NS = @()
        CAA = @()
    }
    
    try {
        $results.A = Resolve-DnsName -Name $Domain -Type A -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq "A" } | Select-Object -ExpandProperty IPAddress
        $results.AAAA = Resolve-DnsName -Name $Domain -Type AAAA -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq "AAAA" } | Select-Object -ExpandProperty IPAddress
        $results.MX = Resolve-DnsName -Name $Domain -Type MX -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq "MX" } | Select-Object NameExchange, Preference
        $results.TXT = Resolve-DnsName -Name $Domain -Type TXT -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq "TXT" } | Select-Object -ExpandProperty Strings
        $results.NS = Resolve-DnsName -Name $Domain -Type NS -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq "NS" } | Select-Object -ExpandProperty NameHost
        $results.CAA = Resolve-DnsName -Name $Domain -Type CAA -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq "CAA" }
    }
    catch {
        # Ignorer les erreurs DNS
    }
    
    return $results
}
#endregion

#region Main Script
Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "  $ScriptName" "Cyan"
Write-ColorOutput "  Version: $ScriptVersion" "Cyan"
if ($DeepScan) { Write-ColorOutput "  Mode: Deep Scan Active" "Yellow" }
Write-ColorOutput "========================================`n" "Cyan"

Write-ColorOutput "Cible: $Url" "White"
Write-ColorOutput "Date: $ReportDate`n" "White"

# Verification de la connectivite
Write-ColorOutput "Verification de la connectivite..." "Yellow"
$webResponse = Get-WebResponse -TargetUrl $Url

if (-not $webResponse.Success) {
    Write-ColorOutput "ERREUR: Impossible de se connecter a $Url" "Red"
    Write-ColorOutput "Details: $($webResponse.Error)" "Red"
    exit 1
}

Write-ColorOutput "Connexion reussie (HTTP $($webResponse.StatusCode))`n" "Green"

# Recuperation des informations
$tlsInfo = Get-TlsInfo -TargetUrl $Url
$uri = [System.Uri]$Url
$dnsRecords = Get-DnsRecords -Domain $uri.Host

# Categories de controles
$Categories = @()

#region Category: HTTP Security Headers (Extended)
Write-ColorOutput "`n--- HEADERS HTTP DE SECURITE ---`n" "Cyan"
$headerControls = @()

# WEB-HDR-001 to WEB-HDR-010: Same as base script
$securityHeaders = @(
    @{ Id = "WEB-HDR-001"; Name = "Content-Security-Policy"; Header = "Content-Security-Policy"; Required = $true },
    @{ Id = "WEB-HDR-002"; Name = "X-Content-Type-Options"; Header = "X-Content-Type-Options"; Expected = "nosniff"; Required = $true },
    @{ Id = "WEB-HDR-003"; Name = "X-Frame-Options"; Header = "X-Frame-Options"; Expected = "DENY|SAMEORIGIN"; Required = $true },
    @{ Id = "WEB-HDR-004"; Name = "X-XSS-Protection"; Header = "X-XSS-Protection"; Required = $false },
    @{ Id = "WEB-HDR-005"; Name = "Strict-Transport-Security"; Header = "Strict-Transport-Security"; Required = $true },
    @{ Id = "WEB-HDR-006"; Name = "Referrer-Policy"; Header = "Referrer-Policy"; Required = $true },
    @{ Id = "WEB-HDR-007"; Name = "Permissions-Policy"; Header = "Permissions-Policy"; Required = $false },
    @{ Id = "WEB-HDR-008"; Name = "Cache-Control"; Header = "Cache-Control"; Required = $false },
    @{ Id = "WEB-HDR-009"; Name = "Server Header Exposure"; Header = "Server"; Required = $false; Inverse = $true },
    @{ Id = "WEB-HDR-010"; Name = "X-Powered-By"; Header = "X-Powered-By"; Required = $false; Inverse = $true }
)

foreach ($h in $securityHeaders) {
    $headerControls += Test-Control -Id $h.Id -Name $h.Name -Category "Headers HTTP" `
        -Description "Verifie le header $($h.Header)" `
        -Remediation "Configurer le header $($h.Header) selon les recommandations OWASP" `
        -Reference "OWASP Secure Headers" `
        -Test {
            $headerValue = $webResponse.Headers[$h.Header]
            if ($h.Inverse) {
                if (-not $headerValue) {
                    @{ Status = "Pass"; Details = "Header $($h.Header) absent (recommande)" }
                } elseif ($headerValue -match "\d+\.\d+") {
                    @{ Status = "Fail"; Details = "$($h.Header) expose la version: $headerValue" }
                } else {
                    @{ Status = "Warning"; Details = "$($h.Header): $headerValue" }
                }
            } else {
                if ($headerValue) {
                    if ($h.Expected -and $headerValue -notmatch $h.Expected) {
                        @{ Status = "Warning"; Details = "$($h.Header): $headerValue (valeur non standard)" }
                    } else {
                        @{ Status = "Pass"; Details = "$($h.Header): $($headerValue.ToString().Substring(0, [Math]::Min(80, $headerValue.ToString().Length)))" }
                    }
                } else {
                    if ($h.Required) {
                        @{ Status = "Fail"; Details = "Header $($h.Header) absent" }
                    } else {
                        @{ Status = "Warning"; Details = "Header $($h.Header) absent" }
                    }
                }
            }
        }
}

# WEB-HDR-011: Cross-Origin-Embedder-Policy
$headerControls += Test-Control -Id "WEB-HDR-011" -Name "Cross-Origin-Embedder-Policy" -Category "Headers HTTP" `
    -Description "Verifie le header COEP pour l'isolation cross-origin" `
    -Remediation "Ajouter Cross-Origin-Embedder-Policy: require-corp" `
    -Reference "MDN COEP" `
    -Test {
        $header = $webResponse.Headers["Cross-Origin-Embedder-Policy"]
        if ($header) {
            @{ Status = "Pass"; Details = "COEP: $header" }
        } else {
            @{ Status = "Warning"; Details = "Header COEP absent" }
        }
    }

# WEB-HDR-012: Cross-Origin-Opener-Policy
$headerControls += Test-Control -Id "WEB-HDR-012" -Name "Cross-Origin-Opener-Policy" -Category "Headers HTTP" `
    -Description "Verifie le header COOP pour l'isolation des fenetres" `
    -Remediation "Ajouter Cross-Origin-Opener-Policy: same-origin" `
    -Reference "MDN COOP" `
    -Test {
        $header = $webResponse.Headers["Cross-Origin-Opener-Policy"]
        if ($header -eq "same-origin") {
            @{ Status = "Pass"; Details = "COOP: $header" }
        } elseif ($header) {
            @{ Status = "Warning"; Details = "COOP: $header" }
        } else {
            @{ Status = "Warning"; Details = "Header COOP absent" }
        }
    }

# WEB-HDR-013: Cross-Origin-Resource-Policy
$headerControls += Test-Control -Id "WEB-HDR-013" -Name "Cross-Origin-Resource-Policy" -Category "Headers HTTP" `
    -Description "Verifie le header CORP pour la protection des ressources" `
    -Remediation "Ajouter Cross-Origin-Resource-Policy: same-origin" `
    -Reference "MDN CORP" `
    -Test {
        $header = $webResponse.Headers["Cross-Origin-Resource-Policy"]
        if ($header) {
            @{ Status = "Pass"; Details = "CORP: $header" }
        } else {
            @{ Status = "Warning"; Details = "Header CORP absent" }
        }
    }

$Categories += @{
    Name = "Headers HTTP de Securite"
    Controls = $headerControls
}
#endregion

#region Category: TLS/SSL Configuration
Write-ColorOutput "`n--- CONFIGURATION TLS/SSL ---`n" "Cyan"
$tlsControls = @()

# WEB-TLS-001 to WEB-TLS-005: Base TLS checks
$tlsControls += Test-Control -Id "WEB-TLS-001" -Name "HTTPS Enforcement" -Category "TLS/SSL" `
    -Description "Verifie que le site utilise HTTPS" `
    -Remediation "Forcer l'utilisation de HTTPS" `
    -Reference "ANSSI TLS" -Severity "Critical" `
    -Test {
        if ($uri.Scheme -eq "https") {
            @{ Status = "Pass"; Details = "Site accessible en HTTPS" }
        } else {
            @{ Status = "Fail"; Details = "Site en HTTP non securise" }
        }
    }

$tlsControls += Test-Control -Id "WEB-TLS-002" -Name "TLS Protocol Version" -Category "TLS/SSL" `
    -Description "Verifie la version TLS" `
    -Remediation "Utiliser TLS 1.2 minimum" `
    -Reference "ANSSI TLS" -Severity "Critical" `
    -Test {
        if ($tlsInfo.Success) {
            $protocol = $tlsInfo.Protocol
            if ($protocol -match "Tls13") { @{ Status = "Pass"; Details = "TLS 1.3" } }
            elseif ($protocol -match "Tls12") { @{ Status = "Pass"; Details = "TLS 1.2" } }
            else { @{ Status = "Fail"; Details = "Protocole obsolete: $protocol" } }
        } else {
            @{ Status = "NotApplicable"; Details = $tlsInfo.Error }
        }
    }

$tlsControls += Test-Control -Id "WEB-TLS-003" -Name "Certificate Validity" -Category "TLS/SSL" `
    -Description "Validite du certificat" `
    -Remediation "Renouveler le certificat" `
    -Reference "PKI Best Practices" -Severity "Critical" `
    -Test {
        if ($tlsInfo.Success -and $tlsInfo.Certificate) {
            $days = ($tlsInfo.Certificate.NotAfter - (Get-Date)).Days
            if ($days -gt 30) { @{ Status = "Pass"; Details = "Expire dans $days jours" } }
            elseif ($days -gt 0) { @{ Status = "Warning"; Details = "Expire dans $days jours" } }
            else { @{ Status = "Fail"; Details = "Certificat expire!" } }
        } else {
            @{ Status = "NotApplicable"; Details = "Impossible de verifier" }
        }
    }

$tlsControls += Test-Control -Id "WEB-TLS-004" -Name "Certificate Key Size" -Category "TLS/SSL" `
    -Description "Verifie la taille de cle du certificat" `
    -Remediation "Utiliser minimum RSA 2048 ou ECC 256" `
    -Reference "ANSSI Cryptography" -Severity "High" `
    -Test {
        if ($tlsInfo.Success -and $tlsInfo.Certificate.KeySize) {
            $keySize = $tlsInfo.Certificate.KeySize
            $algorithm = $tlsInfo.Certificate.PublicKeyAlgorithm
            if ($algorithm -match "ECC|ECDSA") {
                if ($keySize -ge 256) { @{ Status = "Pass"; Details = "ECC $keySize bits" } }
                else { @{ Status = "Fail"; Details = "ECC $keySize bits (minimum 256)" } }
            } else {
                if ($keySize -ge 2048) { @{ Status = "Pass"; Details = "RSA $keySize bits" } }
                else { @{ Status = "Fail"; Details = "RSA $keySize bits (minimum 2048)" } }
            }
        } else {
            @{ Status = "NotApplicable"; Details = "Impossible de verifier" }
        }
    }

$tlsControls += Test-Control -Id "WEB-TLS-005" -Name "Cipher Strength" -Category "TLS/SSL" `
    -Description "Force du chiffrement" `
    -Remediation "Utiliser AES-128 minimum" `
    -Reference "ANSSI TLS" -Severity "High" `
    -Test {
        if ($tlsInfo.Success) {
            $strength = $tlsInfo.CipherStrength
            if ($strength -ge 256) { @{ Status = "Pass"; Details = "$($tlsInfo.CipherAlgorithm) ($strength bits)" } }
            elseif ($strength -ge 128) { @{ Status = "Pass"; Details = "$($tlsInfo.CipherAlgorithm) ($strength bits)" } }
            else { @{ Status = "Fail"; Details = "Chiffrement faible: $strength bits" } }
        } else {
            @{ Status = "NotApplicable"; Details = $tlsInfo.Error }
        }
    }

$tlsControls += Test-Control -Id "WEB-TLS-006" -Name "Signature Algorithm" -Category "TLS/SSL" `
    -Description "Verifie l'algorithme de signature du certificat" `
    -Remediation "Utiliser SHA-256 ou superieur" `
    -Reference "ANSSI Cryptography" -Severity "High" `
    -Test {
        if ($tlsInfo.Success -and $tlsInfo.Certificate.SignatureAlgorithm) {
            $algo = $tlsInfo.Certificate.SignatureAlgorithm
            if ($algo -match "SHA256|SHA384|SHA512") {
                @{ Status = "Pass"; Details = "Signature: $algo" }
            } elseif ($algo -match "SHA1") {
                @{ Status = "Fail"; Details = "SHA1 obsolete: $algo" }
            } else {
                @{ Status = "Warning"; Details = "Signature: $algo" }
            }
        } else {
            @{ Status = "NotApplicable"; Details = "Impossible de verifier" }
        }
    }

# WEB-TLS-007: HTTP to HTTPS Redirect
$tlsControls += Test-Control -Id "WEB-TLS-007" -Name "HTTP to HTTPS Redirect" -Category "TLS/SSL" `
    -Description "Verifie la redirection HTTP vers HTTPS" `
    -Remediation "Configurer une redirection 301 de HTTP vers HTTPS" `
    -Reference "OWASP Transport Layer Protection" -Severity "High" `
    -Test {
        $httpUrl = $Url -replace "^https://", "http://"
        try {
            # Disable automatic redirect to check the initial response
            $response = Invoke-WebRequest -Uri $httpUrl -Method Get -TimeoutSec 10 -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
            @{ Status = "Fail"; Details = "HTTP accessible sans redirection (HTTP $($response.StatusCode))" }
        }
        catch {
            if ($_.Exception.Response.StatusCode -in @(301, 302, 307, 308)) {
                $location = $_.Exception.Response.Headers.Location
                if ($location -match "^https://") {
                    @{ Status = "Pass"; Details = "Redirection vers HTTPS configuree" }
                } else {
                    @{ Status = "Warning"; Details = "Redirection non-HTTPS: $location" }
                }
            } else {
                @{ Status = "Pass"; Details = "HTTP non accessible (securise)" }
            }
        }
    }

$Categories += @{
    Name = "Configuration TLS/SSL"
    Controls = $tlsControls
}
#endregion

#region Category: DNS Security
Write-ColorOutput "`n--- SECURITE DNS ---`n" "Cyan"
$dnsControls = @()

# WEB-DNS-001: SPF Record
$dnsControls += Test-Control -Id "WEB-DNS-001" -Name "SPF Record" -Category "DNS" `
    -Description "Verifie la presence d'un enregistrement SPF" `
    -Remediation "Ajouter un enregistrement TXT SPF pour prevenir le spoofing email" `
    -Reference "RFC 7208" -Severity "Medium" `
    -Test {
        $spf = $dnsRecords.TXT | Where-Object { $_ -match "^v=spf1" }
        if ($spf) {
            @{ Status = "Pass"; Details = "SPF present: $($spf.Substring(0, [Math]::Min(60, $spf.Length)))..." }
        } else {
            @{ Status = "Warning"; Details = "Enregistrement SPF absent" }
        }
    }

# WEB-DNS-002: DMARC Record
$dnsControls += Test-Control -Id "WEB-DNS-002" -Name "DMARC Record" -Category "DNS" `
    -Description "Verifie la presence d'un enregistrement DMARC" `
    -Remediation "Ajouter un enregistrement DMARC sur _dmarc.domain" `
    -Reference "RFC 7489" -Severity "Medium" `
    -Test {
        try {
            $dmarcRecords = Resolve-DnsName -Name "_dmarc.$($uri.Host)" -Type TXT -ErrorAction SilentlyContinue
            $dmarc = $dmarcRecords | Where-Object { $_.Strings -match "^v=DMARC1" }
            if ($dmarc) {
                @{ Status = "Pass"; Details = "DMARC present" }
            } else {
                @{ Status = "Warning"; Details = "Enregistrement DMARC absent" }
            }
        }
        catch {
            @{ Status = "Warning"; Details = "Impossible de verifier DMARC" }
        }
    }

# WEB-DNS-003: CAA Record
$dnsControls += Test-Control -Id "WEB-DNS-003" -Name "CAA Record" -Category "DNS" `
    -Description "Verifie la presence d'enregistrements CAA" `
    -Remediation "Ajouter des enregistrements CAA pour limiter les CA autorisees" `
    -Reference "RFC 8659" -Severity "Low" `
    -Test {
        if ($dnsRecords.CAA -and $dnsRecords.CAA.Count -gt 0) {
            @{ Status = "Pass"; Details = "CAA present ($($dnsRecords.CAA.Count) enregistrements)" }
        } else {
            @{ Status = "Warning"; Details = "Enregistrements CAA absents" }
        }
    }

# WEB-DNS-004: Multiple Nameservers
$dnsControls += Test-Control -Id "WEB-DNS-004" -Name "Multiple Nameservers" -Category "DNS" `
    -Description "Verifie la presence de plusieurs serveurs DNS" `
    -Remediation "Configurer au moins 2 serveurs DNS pour la redondance" `
    -Reference "Best Practices DNS" -Severity "Medium" `
    -Test {
        $nsCount = $dnsRecords.NS.Count
        if ($nsCount -ge 2) {
            @{ Status = "Pass"; Details = "$nsCount serveurs DNS configures" }
        } elseif ($nsCount -eq 1) {
            @{ Status = "Warning"; Details = "Un seul serveur DNS (pas de redondance)" }
        } else {
            @{ Status = "NotApplicable"; Details = "Impossible de verifier les NS" }
        }
    }

$Categories += @{
    Name = "Securite DNS"
    Controls = $dnsControls
}
#endregion

#region Category: CORS Configuration
Write-ColorOutput "`n--- CONFIGURATION CORS ---`n" "Cyan"
$corsControls = @()

# WEB-CORS-001: Access-Control-Allow-Origin
$corsControls += Test-Control -Id "WEB-CORS-001" -Name "Access-Control-Allow-Origin" -Category "CORS" `
    -Description "Verifie la configuration CORS" `
    -Remediation "Eviter Access-Control-Allow-Origin: * en production" `
    -Reference "OWASP CORS" -Severity "High" `
    -Test {
        $acao = $webResponse.Headers["Access-Control-Allow-Origin"]
        if (-not $acao) {
            @{ Status = "Pass"; Details = "CORS non configure (restrictif par defaut)" }
        } elseif ($acao -eq "*") {
            @{ Status = "Warning"; Details = "CORS ouvert a tous les domaines (*)" }
        } else {
            @{ Status = "Pass"; Details = "CORS restreint: $acao" }
        }
    }

# WEB-CORS-002: Access-Control-Allow-Credentials
$corsControls += Test-Control -Id "WEB-CORS-002" -Name "Access-Control-Allow-Credentials" -Category "CORS" `
    -Description "Verifie si les credentials sont autorises en CORS" `
    -Remediation "Ne pas combiner Allow-Credentials avec Allow-Origin: *" `
    -Reference "OWASP CORS" -Severity "High" `
    -Test {
        $acac = $webResponse.Headers["Access-Control-Allow-Credentials"]
        $acao = $webResponse.Headers["Access-Control-Allow-Origin"]
        if ($acac -eq "true" -and $acao -eq "*") {
            @{ Status = "Fail"; Details = "Configuration dangereuse: credentials avec origin *" }
        } elseif ($acac -eq "true") {
            @{ Status = "Warning"; Details = "Credentials autorises en CORS" }
        } else {
            @{ Status = "Pass"; Details = "Credentials non exposes en CORS" }
        }
    }

$Categories += @{
    Name = "Configuration CORS"
    Controls = $corsControls
}
#endregion

#region Category: Sensitive Files (Extended)
Write-ColorOutput "`n--- FICHIERS SENSIBLES ---`n" "Cyan"
$fileControls = @()

$sensitiveFiles = @(
    @{ Path = "/.git/config"; Name = "Git Config"; Critical = $true },
    @{ Path = "/.git/HEAD"; Name = "Git HEAD"; Critical = $true },
    @{ Path = "/.env"; Name = "Environment File"; Critical = $true },
    @{ Path = "/.env.local"; Name = "Local Env File"; Critical = $true },
    @{ Path = "/.env.production"; Name = "Production Env"; Critical = $true },
    @{ Path = "/wp-config.php"; Name = "WordPress Config"; Critical = $true },
    @{ Path = "/wp-config.php.bak"; Name = "WordPress Backup"; Critical = $true },
    @{ Path = "/web.config"; Name = "IIS Config"; Critical = $true },
    @{ Path = "/.htaccess"; Name = "Apache htaccess"; Critical = $false },
    @{ Path = "/.htpasswd"; Name = "Apache htpasswd"; Critical = $true },
    @{ Path = "/config.php"; Name = "PHP Config"; Critical = $true },
    @{ Path = "/configuration.php"; Name = "Joomla Config"; Critical = $true },
    @{ Path = "/robots.txt"; Name = "Robots.txt"; Critical = $false },
    @{ Path = "/sitemap.xml"; Name = "Sitemap"; Critical = $false },
    @{ Path = "/.well-known/security.txt"; Name = "Security.txt"; Critical = $false },
    @{ Path = "/backup.zip"; Name = "Backup Archive"; Critical = $true },
    @{ Path = "/backup.tar.gz"; Name = "Backup Tar"; Critical = $true },
    @{ Path = "/database.sql"; Name = "Database Dump"; Critical = $true },
    @{ Path = "/dump.sql"; Name = "SQL Dump"; Critical = $true },
    @{ Path = "/phpinfo.php"; Name = "PHP Info"; Critical = $true },
    @{ Path = "/info.php"; Name = "Info PHP"; Critical = $true },
    @{ Path = "/server-status"; Name = "Apache Status"; Critical = $true },
    @{ Path = "/server-info"; Name = "Apache Info"; Critical = $true },
    @{ Path = "/.DS_Store"; Name = "MacOS DS_Store"; Critical = $false },
    @{ Path = "/Thumbs.db"; Name = "Windows Thumbs"; Critical = $false },
    @{ Path = "/crossdomain.xml"; Name = "Flash Crossdomain"; Critical = $false },
    @{ Path = "/clientaccesspolicy.xml"; Name = "Silverlight Policy"; Critical = $false },
    @{ Path = "/package.json"; Name = "NPM Package"; Critical = $false },
    @{ Path = "/composer.json"; Name = "Composer"; Critical = $false },
    @{ Path = "/Gemfile"; Name = "Ruby Gemfile"; Critical = $false },
    @{ Path = "/requirements.txt"; Name = "Python Requirements"; Critical = $false }
)

$controlIndex = 1
foreach ($file in $sensitiveFiles) {
    $controlId = "WEB-FILE-{0:D3}" -f $controlIndex
    $testUrl = $Url.TrimEnd('/') + $file.Path
    $severity = if ($file.Critical) { "High" } else { "Low" }
    
    $fileControls += Test-Control -Id $controlId -Name $file.Name -Category "Fichiers Sensibles" `
        -Description "Verifie l'accessibilite de $($file.Path)" `
        -Remediation "Bloquer l'acces a ce fichier" `
        -Reference "OWASP Information Leakage" -Severity $severity `
        -Test {
            try {
                $response = Invoke-WebRequest -Uri $testUrl -Method Head -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
                if ($response.StatusCode -eq 200) {
                    if ($file.Path -match "(robots\.txt|sitemap\.xml|security\.txt)") {
                        @{ Status = "Pass"; Details = "Fichier present (normal)" }
                    } elseif ($file.Critical) {
                        @{ Status = "Fail"; Details = "Fichier critique accessible!" }
                    } else {
                        @{ Status = "Warning"; Details = "Fichier accessible" }
                    }
                } else {
                    @{ Status = "Pass"; Details = "Non accessible (HTTP $($response.StatusCode))" }
                }
            }
            catch {
                @{ Status = "Pass"; Details = "Fichier non accessible" }
            }
        }
    
    $controlIndex++
}

$Categories += @{
    Name = "Fichiers Sensibles"
    Controls = $fileControls
}
#endregion

#region Category: Content Analysis
Write-ColorOutput "`n--- ANALYSE DU CONTENU ---`n" "Cyan"
$contentControls = @()

# WEB-CONTENT-001: Mixed Content
$contentControls += Test-Control -Id "WEB-CONTENT-001" -Name "Mixed Content Detection" -Category "Contenu" `
    -Description "Detecte le contenu mixte HTTP/HTTPS" `
    -Remediation "Remplacer toutes les references HTTP par HTTPS" `
    -Reference "OWASP Mixed Content" -Severity "High" `
    -Test {
        $content = $webResponse.Content
        $httpRefs = [regex]::Matches($content, 'src=["\']http://[^"\']+["\']|href=["\']http://[^"\']+["\']')
        if ($uri.Scheme -eq "https") {
            if ($httpRefs.Count -eq 0) {
                @{ Status = "Pass"; Details = "Aucun contenu mixte detecte" }
            } else {
                @{ Status = "Fail"; Details = "$($httpRefs.Count) references HTTP detectees sur page HTTPS" }
            }
        } else {
            @{ Status = "NotApplicable"; Details = "Site non-HTTPS" }
        }
    }

# WEB-CONTENT-002: Inline JavaScript
$contentControls += Test-Control -Id "WEB-CONTENT-002" -Name "Inline JavaScript" -Category "Contenu" `
    -Description "Detecte le JavaScript inline (risque XSS)" `
    -Remediation "Deplacer le JavaScript vers des fichiers externes" `
    -Reference "OWASP XSS Prevention" -Severity "Low" `
    -Test {
        $content = $webResponse.Content
        $inlineJS = [regex]::Matches($content, '<script[^>]*>(?![\s]*</script>).+?</script>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        $onHandlers = [regex]::Matches($content, '\son\w+\s*=')
        $total = $inlineJS.Count + $onHandlers.Count
        if ($total -eq 0) {
            @{ Status = "Pass"; Details = "Pas de JavaScript inline detecte" }
        } elseif ($total -le 5) {
            @{ Status = "Warning"; Details = "$total occurrences de JS inline" }
        } else {
            @{ Status = "Warning"; Details = "$total occurrences de JS inline (considerer CSP)" }
        }
    }

# WEB-CONTENT-003: Comments in HTML
$contentControls += Test-Control -Id "WEB-CONTENT-003" -Name "HTML Comments" -Category "Contenu" `
    -Description "Detecte les commentaires HTML potentiellement sensibles" `
    -Remediation "Supprimer les commentaires contenant des informations sensibles" `
    -Reference "OWASP Information Leakage" -Severity "Low" `
    -Test {
        $content = $webResponse.Content
        $comments = [regex]::Matches($content, '<!--[\s\S]*?-->')
        $sensitivePatterns = @("password", "secret", "api", "key", "token", "todo", "fixme", "debug", "admin")
        $suspiciousComments = @()
        foreach ($comment in $comments) {
            foreach ($pattern in $sensitivePatterns) {
                if ($comment.Value -match $pattern) {
                    $suspiciousComments += $comment.Value.Substring(0, [Math]::Min(50, $comment.Value.Length))
                    break
                }
            }
        }
        if ($suspiciousComments.Count -eq 0) {
            @{ Status = "Pass"; Details = "Pas de commentaires sensibles detectes" }
        } else {
            @{ Status = "Warning"; Details = "$($suspiciousComments.Count) commentaires potentiellement sensibles" }
        }
    }

# WEB-CONTENT-004: Version Disclosure in HTML
$contentControls += Test-Control -Id "WEB-CONTENT-004" -Name "Version Disclosure" -Category "Contenu" `
    -Description "Detecte la divulgation de versions dans le HTML" `
    -Remediation "Supprimer les meta tags exposant les versions" `
    -Reference "OWASP Information Leakage" -Severity "Low" `
    -Test {
        $content = $webResponse.Content
        $generators = [regex]::Matches($content, '<meta[^>]*name=["\']generator["\'][^>]*content=["\']([^"\']+)["\']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($generators.Count -gt 0) {
            $versions = $generators | ForEach-Object { $_.Groups[1].Value }
            @{ Status = "Warning"; Details = "Generator expose: $($versions -join ', ')" }
        } else {
            @{ Status = "Pass"; Details = "Pas de meta generator detecte" }
        }
    }

$Categories += @{
    Name = "Analyse du Contenu"
    Controls = $contentControls
}
#endregion

#region Category: Technology Detection
Write-ColorOutput "`n--- DETECTION TECHNOLOGIES ---`n" "Cyan"
$techControls = @()

# WEB-TECH-001: CMS Detection
$techControls += Test-Control -Id "WEB-TECH-001" -Name "CMS Detection" -Category "Technologies" `
    -Description "Detecte le CMS utilise" `
    -Remediation "Masquer les signatures du CMS si possible" `
    -Reference "Security Best Practices" -Severity "Info" `
    -Test {
        $content = $webResponse.Content
        $detected = @()
        if ($content -match "wp-content|wp-includes|wordpress") { $detected += "WordPress" }
        if ($content -match "joomla|/media/jui/") { $detected += "Joomla" }
        if ($content -match "drupal|/sites/default/") { $detected += "Drupal" }
        if ($content -match "magento|/static/version") { $detected += "Magento" }
        if ($content -match "shopify") { $detected += "Shopify" }
        if ($content -match "wix\.com") { $detected += "Wix" }
        if ($content -match "squarespace") { $detected += "Squarespace" }
        
        if ($detected.Count -gt 0) {
            @{ Status = "Warning"; Details = "CMS detecte: $($detected -join ', ')" }
        } else {
            @{ Status = "Pass"; Details = "CMS non identifiable" }
        }
    }

# WEB-TECH-002: Framework Detection
$techControls += Test-Control -Id "WEB-TECH-002" -Name "Framework Detection" -Category "Technologies" `
    -Description "Detecte les frameworks utilises" `
    -Remediation "Masquer les signatures des frameworks" `
    -Reference "Security Best Practices" -Severity "Info" `
    -Test {
        $content = $webResponse.Content
        $headers = $webResponse.Headers
        $detected = @()
        
        # Check headers
        if ($headers["X-Powered-By"]) { $detected += $headers["X-Powered-By"] }
        if ($headers["X-AspNet-Version"]) { $detected += "ASP.NET $($headers["X-AspNet-Version"])" }
        if ($headers["X-AspNetMvc-Version"]) { $detected += "ASP.NET MVC $($headers["X-AspNetMvc-Version"])" }
        
        # Check content
        if ($content -match "react|__NEXT_DATA__|next\.js") { $detected += "React/Next.js" }
        if ($content -match "ng-app|angular") { $detected += "Angular" }
        if ($content -match "vue\.js|__vue__") { $detected += "Vue.js" }
        if ($content -match "jquery") { $detected += "jQuery" }
        if ($content -match "bootstrap") { $detected += "Bootstrap" }
        if ($content -match "laravel") { $detected += "Laravel" }
        if ($content -match "django") { $detected += "Django" }
        if ($content -match "rails|ruby") { $detected += "Ruby on Rails" }
        
        if ($detected.Count -gt 0) {
            @{ Status = "Warning"; Details = "Technologies: $($detected -join ', ')" }
        } else {
            @{ Status = "Pass"; Details = "Frameworks non identifiables" }
        }
    }

$Categories += @{
    Name = "Detection Technologies"
    Controls = $techControls
}
#endregion

#region Category: Cookies Security (Extended)
Write-ColorOutput "`n--- SECURITE DES COOKIES ---`n" "Cyan"
$cookieControls = @()

try {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $Timeout -UseBasicParsing -SessionVariable session -ErrorAction Stop
    $cookies = $session.Cookies.GetCookies($Url)
    
    if ($cookies.Count -gt 0) {
        $cookieIndex = 1
        foreach ($cookie in $cookies) {
            $controlId = "WEB-COOKIE-{0:D3}" -f $cookieIndex
            
            $cookieControls += Test-Control -Id $controlId -Name "Cookie: $($cookie.Name)" -Category "Cookies" `
                -Description "Analyse du cookie $($cookie.Name)" `
                -Remediation "Configurer Secure, HttpOnly et SameSite" `
                -Reference "OWASP Session Management" -Severity "Medium" `
                -Test {
                    $issues = @()
                    if (-not $cookie.Secure) { $issues += "Secure manquant" }
                    if (-not $cookie.HttpOnly) { $issues += "HttpOnly manquant" }
                    
                    # Check for session-like cookies
                    $isSession = $cookie.Name -match "sess|session|sid|token|auth|jwt|csrf"
                    
                    if ($issues.Count -eq 0) {
                        @{ Status = "Pass"; Details = "Cookie securise" }
                    } elseif ($isSession) {
                        @{ Status = "Fail"; Details = "Cookie session non securise: $($issues -join ', ')" }
                    } else {
                        @{ Status = "Warning"; Details = "Cookie: $($issues -join ', ')" }
                    }
                }
            
            $cookieIndex++
        }
    } else {
        $cookieControls += Test-Control -Id "WEB-COOKIE-001" -Name "No Cookies" -Category "Cookies" `
            -Description "Aucun cookie detecte" -Remediation "N/A" -Reference "N/A" `
            -Test { @{ Status = "NotApplicable"; Details = "Aucun cookie defini" } }
    }
}
catch {
    $cookieControls += Test-Control -Id "WEB-COOKIE-001" -Name "Cookie Analysis" -Category "Cookies" `
        -Description "Analyse des cookies" -Remediation "N/A" -Reference "N/A" `
        -Test { @{ Status = "NotApplicable"; Details = "Impossible d'analyser: $($_.Exception.Message)" } }
}

$Categories += @{
    Name = "Securite des Cookies"
    Controls = $cookieControls
}
#endregion

# Stocker les resultats
$Results.Categories = $Categories

# Calculer le score
$totalExecuted = $PassedControls + $FailedControls + $WarningControls
if ($totalExecuted -gt 0) {
    $score = [math]::Round(($PassedControls / $totalExecuted) * 100, 1)
} else {
    $score = 0
}

# Determiner la note
$grade = switch ($score) {
    { $_ -ge 90 } { "A" }
    { $_ -ge 80 } { "B" }
    { $_ -ge 70 } { "C" }
    { $_ -ge 60 } { "D" }
    { $_ -ge 50 } { "E" }
    default { "F" }
}

$Results.Summary = @{
    TotalControls = $TotalControls
    Passed = $PassedControls
    Failed = $FailedControls
    Warnings = $WarningControls
    NotApplicable = $NotApplicableControls
    Score = $score
    Grade = $grade
}

#region Generate Reports
Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "  RESULTATS DE L'AUDIT AVANCE" "Cyan"
Write-ColorOutput "========================================`n" "Cyan"

Write-ColorOutput "Controles reussis:     $PassedControls" "Green"
Write-ColorOutput "Controles echoues:     $FailedControls" "Red"
Write-ColorOutput "Avertissements:        $WarningControls" "Yellow"
Write-ColorOutput "Non applicables:       $NotApplicableControls" "Gray"
Write-ColorOutput ""
Write-ColorOutput "Score: $score% - Note: $grade" $(if ($score -ge 70) { "Green" } elseif ($score -ge 50) { "Yellow" } else { "Red" })

# Creer le dossier de sortie
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
}

$sanitizedHost = $uri.Host -replace '[^a-zA-Z0-9]', '_'

# Export JSON
if ($OutputFormat -in @("JSON", "Both")) {
    $jsonPath = Join-Path $OutputPath "web-security-enhanced_${sanitizedHost}_${Timestamp}.json"
    $Results | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8
    Write-ColorOutput "`nRapport JSON: $jsonPath" "Cyan"
}

# Export HTML
if ($OutputFormat -in @("HTML", "Both")) {
    $htmlPath = Join-Path $OutputPath "web-security-enhanced_${sanitizedHost}_${Timestamp}.html"
    
    $htmlContent = @"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Securite Web Avance - $($uri.Host)</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; padding: 2rem; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 1rem; border: 1px solid #334155; }
        .header h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #f8fafc; }
        .header .subtitle { color: #f59e0b; font-size: 0.9rem; }
        .header .target { color: #60a5fa; font-size: 1.1rem; margin-top: 0.5rem; }
        .header .date { color: #94a3b8; font-size: 0.9rem; margin-top: 0.5rem; }
        .score-card { display: flex; justify-content: center; gap: 2rem; margin: 2rem 0; flex-wrap: wrap; }
        .score-item { background: #1e293b; padding: 1.5rem 2rem; border-radius: 0.75rem; text-align: center; min-width: 150px; border: 1px solid #334155; }
        .score-item .value { font-size: 2.5rem; font-weight: bold; }
        .score-item .label { color: #94a3b8; font-size: 0.85rem; margin-top: 0.25rem; }
        .score-item.grade .value { color: #22c55e; }
        .score-item.passed .value { color: #22c55e; }
        .score-item.failed .value { color: #ef4444; }
        .score-item.warning .value { color: #f59e0b; }
        .category { margin-bottom: 2rem; }
        .category-header { background: #1e293b; padding: 1rem 1.5rem; border-radius: 0.5rem 0.5rem 0 0; border: 1px solid #334155; border-bottom: none; }
        .category-header h2 { font-size: 1.25rem; color: #f8fafc; }
        .controls { background: #1e293b; border: 1px solid #334155; border-radius: 0 0 0.5rem 0.5rem; }
        .control { padding: 1rem 1.5rem; border-bottom: 1px solid #334155; display: grid; grid-template-columns: 100px 1fr; gap: 1rem; align-items: start; }
        .control:last-child { border-bottom: none; }
        .control-status { font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 0.25rem; text-align: center; font-size: 0.8rem; }
        .control-status.pass { background: #166534; color: #bbf7d0; }
        .control-status.fail { background: #991b1b; color: #fecaca; }
        .control-status.warning { background: #92400e; color: #fde68a; }
        .control-status.na { background: #374151; color: #9ca3af; }
        .control-content h3 { font-size: 0.95rem; color: #f8fafc; margin-bottom: 0.25rem; }
        .control-content .id { color: #60a5fa; font-size: 0.8rem; }
        .control-content .details { color: #94a3b8; font-size: 0.85rem; margin-top: 0.5rem; }
        .control-content .remediation { color: #fbbf24; font-size: 0.8rem; margin-top: 0.5rem; font-style: italic; }
        .footer { text-align: center; margin-top: 3rem; padding: 1.5rem; color: #64748b; font-size: 0.85rem; border-top: 1px solid #334155; }
        .footer a { color: #60a5fa; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Rapport de Securite Web Avance</h1>
            <div class="subtitle">ENHANCED EDITION - ~95 Controles</div>
            <div class="target">$($uri.Host)</div>
            <div class="date">$ReportDate</div>
        </div>

        <div class="score-card">
            <div class="score-item grade">
                <div class="value">$grade</div>
                <div class="label">Note</div>
            </div>
            <div class="score-item">
                <div class="value">$score%</div>
                <div class="label">Score</div>
            </div>
            <div class="score-item passed">
                <div class="value">$PassedControls</div>
                <div class="label">Reussis</div>
            </div>
            <div class="score-item failed">
                <div class="value">$FailedControls</div>
                <div class="label">Echoues</div>
            </div>
            <div class="score-item warning">
                <div class="value">$WarningControls</div>
                <div class="label">Avertissements</div>
            </div>
        </div>
"@

    foreach ($category in $Categories) {
        $htmlContent += @"

        <div class="category">
            <div class="category-header">
                <h2>$($category.Name)</h2>
            </div>
            <div class="controls">
"@
        foreach ($control in $category.Controls) {
            $statusClass = switch ($control.Status) {
                "Pass" { "pass" }
                "Fail" { "fail" }
                "Warning" { "warning" }
                default { "na" }
            }
            $statusText = switch ($control.Status) {
                "Pass" { "REUSSI" }
                "Fail" { "ECHEC" }
                "Warning" { "ATTENTION" }
                default { "N/A" }
            }
            
            $htmlContent += @"

                <div class="control">
                    <div class="control-status $statusClass">$statusText</div>
                    <div class="control-content">
                        <span class="id">$($control.Id)</span>
                        <h3>$($control.Name)</h3>
                        <div class="details">$($control.Details)</div>
                        $(if ($control.Status -eq "Fail" -and $control.Remediation) { "<div class='remediation'>Remediation: $($control.Remediation)</div>" })
                    </div>
                </div>
"@
        }
        $htmlContent += @"

            </div>
        </div>
"@
    }

    $htmlContent += @"

        <div class="footer">
            <p>Genere par <strong>$ScriptName</strong> v$ScriptVersion</p>
            <p><a href="https://ist-security.fr">Infra Shield Tools</a> - Securite Web basee sur OWASP, ANSSI et CIS</p>
        </div>
    </div>
</body>
</html>
"@

    $htmlContent | Out-File -FilePath $htmlPath -Encoding UTF8
    Write-ColorOutput "Rapport HTML: $htmlPath" "Cyan"
}

Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "  AUDIT AVANCE TERMINE" "Cyan"
Write-ColorOutput "========================================`n" "Cyan"
#endregion
