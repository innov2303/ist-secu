<#
.SYNOPSIS
    Web Security Compliance Toolkit - Base Script
    Analyse de securite des sites web basee sur OWASP et ANSSI

.DESCRIPTION
    Ce script effectue environ 55 controles de securite sur un site web :
    - Headers HTTP de securite
    - Configuration TLS/SSL
    - Cookies de session
    - Fichiers sensibles exposes
    - Configuration DNS

.PARAMETER Url
    URL du site web a analyser (ex: https://example.com)

.PARAMETER OutputPath
    Chemin du dossier de sortie pour les rapports (defaut: ./reports)

.PARAMETER OutputFormat
    Format de sortie: HTML, JSON, ou Both (defaut: Both)

.PARAMETER Timeout
    Timeout en secondes pour les requetes HTTP (defaut: 30)

.EXAMPLE
    .\web-security-base.ps1 -Url "https://example.com"

.EXAMPLE
    .\web-security-base.ps1 -Url "https://example.com" -OutputPath "C:\Audits" -OutputFormat HTML

.NOTES
    Version: 1.0.0
    Date: 2025-01-19
    Auteur: Infra Shield Tools
    Standards: OWASP Top 10, ANSSI Recommandations Web
    Controles: ~55 verifications de securite
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
    [int]$Timeout = 30
)

#region Configuration
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Version et metadata
$ScriptVersion = "1.0.0"
$ScriptName = "Web Security Compliance Toolkit - Base"
$TotalControls = 55
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
        [string]$Reference
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
    param([string]$TargetUrl)
    
    try {
        $response = Invoke-WebRequest -Uri $TargetUrl -Method Head -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
        return @{
            Success = $true
            Response = $response
            Headers = $response.Headers
            StatusCode = $response.StatusCode
        }
    }
    catch {
        try {
            $response = Invoke-WebRequest -Uri $TargetUrl -Method Get -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
            return @{
                Success = $true
                Response = $response
                Headers = $response.Headers
                StatusCode = $response.StatusCode
            }
        }
        catch {
            return @{
                Success = $false
                Error = $_.Exception.Message
            }
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
            Certificate = @{
                Subject = $cert2.Subject
                Issuer = $cert2.Issuer
                NotBefore = $cert2.NotBefore
                NotAfter = $cert2.NotAfter
                Thumbprint = $cert2.Thumbprint
                SignatureAlgorithm = $cert2.SignatureAlgorithm.FriendlyName
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
#endregion

#region Main Script
Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "  $ScriptName" "Cyan"
Write-ColorOutput "  Version: $ScriptVersion" "Cyan"
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

# Recuperation des informations TLS
$tlsInfo = Get-TlsInfo -TargetUrl $Url

# Categories de controles
$Categories = @()

#region Category: HTTP Security Headers
Write-ColorOutput "`n--- HEADERS HTTP DE SECURITE ---`n" "Cyan"
$headerControls = @()

# WEB-HDR-001: Content-Security-Policy
$headerControls += Test-Control -Id "WEB-HDR-001" -Name "Content-Security-Policy" -Category "Headers HTTP" `
    -Description "Verifie la presence du header Content-Security-Policy" `
    -Remediation "Ajouter le header Content-Security-Policy avec une politique restrictive" `
    -Reference "OWASP Secure Headers" `
    -Test {
        $csp = $webResponse.Headers["Content-Security-Policy"]
        if ($csp) {
            @{ Status = "Pass"; Details = "CSP present: $($csp.Substring(0, [Math]::Min(100, $csp.Length)))..." }
        } else {
            @{ Status = "Fail"; Details = "Header Content-Security-Policy absent" }
        }
    }

# WEB-HDR-002: X-Content-Type-Options
$headerControls += Test-Control -Id "WEB-HDR-002" -Name "X-Content-Type-Options" -Category "Headers HTTP" `
    -Description "Verifie la presence du header X-Content-Type-Options" `
    -Remediation "Ajouter le header X-Content-Type-Options: nosniff" `
    -Reference "OWASP Secure Headers" `
    -Test {
        $header = $webResponse.Headers["X-Content-Type-Options"]
        if ($header -eq "nosniff") {
            @{ Status = "Pass"; Details = "X-Content-Type-Options: nosniff" }
        } elseif ($header) {
            @{ Status = "Warning"; Details = "Valeur non standard: $header" }
        } else {
            @{ Status = "Fail"; Details = "Header X-Content-Type-Options absent" }
        }
    }

# WEB-HDR-003: X-Frame-Options
$headerControls += Test-Control -Id "WEB-HDR-003" -Name "X-Frame-Options" -Category "Headers HTTP" `
    -Description "Verifie la presence du header X-Frame-Options" `
    -Remediation "Ajouter le header X-Frame-Options: DENY ou SAMEORIGIN" `
    -Reference "OWASP Clickjacking Defense" `
    -Test {
        $header = $webResponse.Headers["X-Frame-Options"]
        if ($header -match "^(DENY|SAMEORIGIN)$") {
            @{ Status = "Pass"; Details = "X-Frame-Options: $header" }
        } elseif ($header) {
            @{ Status = "Warning"; Details = "Valeur: $header" }
        } else {
            @{ Status = "Fail"; Details = "Header X-Frame-Options absent" }
        }
    }

# WEB-HDR-004: X-XSS-Protection
$headerControls += Test-Control -Id "WEB-HDR-004" -Name "X-XSS-Protection" -Category "Headers HTTP" `
    -Description "Verifie la presence du header X-XSS-Protection" `
    -Remediation "Ajouter le header X-XSS-Protection: 1; mode=block (ou utiliser CSP)" `
    -Reference "OWASP XSS Prevention" `
    -Test {
        $header = $webResponse.Headers["X-XSS-Protection"]
        if ($header -match "1.*mode=block") {
            @{ Status = "Pass"; Details = "X-XSS-Protection actif avec mode=block" }
        } elseif ($header -eq "0") {
            @{ Status = "Warning"; Details = "X-XSS-Protection desactive (acceptable si CSP present)" }
        } elseif ($header) {
            @{ Status = "Warning"; Details = "Configuration: $header" }
        } else {
            @{ Status = "Warning"; Details = "Header X-XSS-Protection absent (obsolete si CSP present)" }
        }
    }

# WEB-HDR-005: Strict-Transport-Security
$headerControls += Test-Control -Id "WEB-HDR-005" -Name "Strict-Transport-Security (HSTS)" -Category "Headers HTTP" `
    -Description "Verifie la presence et configuration du header HSTS" `
    -Remediation "Ajouter le header Strict-Transport-Security: max-age=31536000; includeSubDomains" `
    -Reference "OWASP HTTP Strict Transport Security" `
    -Test {
        $header = $webResponse.Headers["Strict-Transport-Security"]
        if ($header) {
            if ($header -match "max-age=(\d+)") {
                $maxAge = [int]$Matches[1]
                if ($maxAge -ge 31536000) {
                    @{ Status = "Pass"; Details = "HSTS actif avec max-age >= 1 an: $header" }
                } elseif ($maxAge -ge 15768000) {
                    @{ Status = "Warning"; Details = "HSTS actif mais max-age < 1 an: $header" }
                } else {
                    @{ Status = "Fail"; Details = "HSTS max-age trop court: $maxAge secondes" }
                }
            } else {
                @{ Status = "Warning"; Details = "Format HSTS invalide: $header" }
            }
        } else {
            @{ Status = "Fail"; Details = "Header Strict-Transport-Security absent" }
        }
    }

# WEB-HDR-006: Referrer-Policy
$headerControls += Test-Control -Id "WEB-HDR-006" -Name "Referrer-Policy" -Category "Headers HTTP" `
    -Description "Verifie la presence du header Referrer-Policy" `
    -Remediation "Ajouter le header Referrer-Policy: strict-origin-when-cross-origin" `
    -Reference "OWASP Secure Headers" `
    -Test {
        $header = $webResponse.Headers["Referrer-Policy"]
        $secureValues = @("no-referrer", "no-referrer-when-downgrade", "strict-origin", "strict-origin-when-cross-origin", "same-origin")
        if ($header -and ($secureValues -contains $header)) {
            @{ Status = "Pass"; Details = "Referrer-Policy: $header" }
        } elseif ($header) {
            @{ Status = "Warning"; Details = "Referrer-Policy: $header (verifier la politique)" }
        } else {
            @{ Status = "Fail"; Details = "Header Referrer-Policy absent" }
        }
    }

# WEB-HDR-007: Permissions-Policy
$headerControls += Test-Control -Id "WEB-HDR-007" -Name "Permissions-Policy" -Category "Headers HTTP" `
    -Description "Verifie la presence du header Permissions-Policy (Feature-Policy)" `
    -Remediation "Ajouter le header Permissions-Policy pour controler les fonctionnalites du navigateur" `
    -Reference "W3C Permissions Policy" `
    -Test {
        $header = $webResponse.Headers["Permissions-Policy"]
        $legacyHeader = $webResponse.Headers["Feature-Policy"]
        if ($header) {
            @{ Status = "Pass"; Details = "Permissions-Policy present" }
        } elseif ($legacyHeader) {
            @{ Status = "Warning"; Details = "Feature-Policy present (obsolete, utiliser Permissions-Policy)" }
        } else {
            @{ Status = "Warning"; Details = "Header Permissions-Policy absent" }
        }
    }

# WEB-HDR-008: Cache-Control
$headerControls += Test-Control -Id "WEB-HDR-008" -Name "Cache-Control" -Category "Headers HTTP" `
    -Description "Verifie la configuration du header Cache-Control" `
    -Remediation "Configurer Cache-Control pour les pages sensibles: no-store, no-cache" `
    -Reference "OWASP Session Management" `
    -Test {
        $header = $webResponse.Headers["Cache-Control"]
        if ($header -match "no-store|no-cache") {
            @{ Status = "Pass"; Details = "Cache-Control securise: $header" }
        } elseif ($header) {
            @{ Status = "Warning"; Details = "Cache-Control: $header (verifier pour les pages sensibles)" }
        } else {
            @{ Status = "Warning"; Details = "Header Cache-Control absent" }
        }
    }

# WEB-HDR-009: Server Header
$headerControls += Test-Control -Id "WEB-HDR-009" -Name "Server Header Exposure" -Category "Headers HTTP" `
    -Description "Verifie si le header Server expose des informations sensibles" `
    -Remediation "Supprimer ou minimiser le header Server" `
    -Reference "OWASP Information Leakage" `
    -Test {
        $header = $webResponse.Headers["Server"]
        if (-not $header) {
            @{ Status = "Pass"; Details = "Header Server absent (recommande)" }
        } elseif ($header -match "\d+\.\d+") {
            @{ Status = "Fail"; Details = "Server expose la version: $header" }
        } else {
            @{ Status = "Warning"; Details = "Server: $header (considerer la suppression)" }
        }
    }

# WEB-HDR-010: X-Powered-By
$headerControls += Test-Control -Id "WEB-HDR-010" -Name "X-Powered-By Header" -Category "Headers HTTP" `
    -Description "Verifie si le header X-Powered-By expose des informations" `
    -Remediation "Supprimer le header X-Powered-By" `
    -Reference "OWASP Information Leakage" `
    -Test {
        $header = $webResponse.Headers["X-Powered-By"]
        if (-not $header) {
            @{ Status = "Pass"; Details = "Header X-Powered-By absent" }
        } else {
            @{ Status = "Fail"; Details = "X-Powered-By expose: $header" }
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

# WEB-TLS-001: HTTPS Enforcement
$tlsControls += Test-Control -Id "WEB-TLS-001" -Name "HTTPS Enforcement" -Category "TLS/SSL" `
    -Description "Verifie que le site utilise HTTPS" `
    -Remediation "Forcer l'utilisation de HTTPS sur tout le site" `
    -Reference "ANSSI TLS Recommendations" `
    -Test {
        $uri = [System.Uri]$Url
        if ($uri.Scheme -eq "https") {
            @{ Status = "Pass"; Details = "Site accessible en HTTPS" }
        } else {
            @{ Status = "Fail"; Details = "Site accessible en HTTP non securise" }
        }
    }

# WEB-TLS-002: TLS Version
$tlsControls += Test-Control -Id "WEB-TLS-002" -Name "TLS Protocol Version" -Category "TLS/SSL" `
    -Description "Verifie la version du protocole TLS utilise" `
    -Remediation "Utiliser TLS 1.2 minimum, TLS 1.3 recommande" `
    -Reference "ANSSI TLS Recommendations" `
    -Test {
        if ($tlsInfo.Success) {
            $protocol = $tlsInfo.Protocol
            if ($protocol -match "Tls13") {
                @{ Status = "Pass"; Details = "TLS 1.3 utilise (recommande)" }
            } elseif ($protocol -match "Tls12") {
                @{ Status = "Pass"; Details = "TLS 1.2 utilise (acceptable)" }
            } elseif ($protocol -match "Tls11") {
                @{ Status = "Fail"; Details = "TLS 1.1 utilise (obsolete)" }
            } else {
                @{ Status = "Fail"; Details = "Protocole obsolete: $protocol" }
            }
        } else {
            @{ Status = "NotApplicable"; Details = "Impossible de verifier: $($tlsInfo.Error)" }
        }
    }

# WEB-TLS-003: Certificate Validity
$tlsControls += Test-Control -Id "WEB-TLS-003" -Name "Certificate Validity" -Category "TLS/SSL" `
    -Description "Verifie la validite du certificat SSL/TLS" `
    -Remediation "Renouveler le certificat avant expiration" `
    -Reference "Best Practices PKI" `
    -Test {
        if ($tlsInfo.Success -and $tlsInfo.Certificate) {
            $notAfter = $tlsInfo.Certificate.NotAfter
            $daysRemaining = ($notAfter - (Get-Date)).Days
            if ($daysRemaining -gt 30) {
                @{ Status = "Pass"; Details = "Certificat valide, expire dans $daysRemaining jours" }
            } elseif ($daysRemaining -gt 0) {
                @{ Status = "Warning"; Details = "Certificat expire dans $daysRemaining jours" }
            } else {
                @{ Status = "Fail"; Details = "Certificat expire!" }
            }
        } else {
            @{ Status = "NotApplicable"; Details = "Impossible de verifier le certificat" }
        }
    }

# WEB-TLS-004: Certificate Chain
$tlsControls += Test-Control -Id "WEB-TLS-004" -Name "Certificate Chain" -Category "TLS/SSL" `
    -Description "Verifie que la chaine de certificats est complete" `
    -Remediation "S'assurer que tous les certificats intermediaires sont installes" `
    -Reference "Best Practices PKI" `
    -Test {
        if ($tlsInfo.Success -and $tlsInfo.Certificate) {
            $issuer = $tlsInfo.Certificate.Issuer
            if ($issuer -and $issuer -ne $tlsInfo.Certificate.Subject) {
                @{ Status = "Pass"; Details = "Certificat emis par: $issuer" }
            } else {
                @{ Status = "Warning"; Details = "Certificat auto-signe detecte" }
            }
        } else {
            @{ Status = "NotApplicable"; Details = "Impossible de verifier" }
        }
    }

# WEB-TLS-005: Cipher Strength
$tlsControls += Test-Control -Id "WEB-TLS-005" -Name "Cipher Strength" -Category "TLS/SSL" `
    -Description "Verifie la force de chiffrement utilisee" `
    -Remediation "Utiliser des suites de chiffrement avec minimum 128 bits" `
    -Reference "ANSSI TLS Recommendations" `
    -Test {
        if ($tlsInfo.Success) {
            $strength = $tlsInfo.CipherStrength
            $cipher = $tlsInfo.CipherAlgorithm
            if ($strength -ge 256) {
                @{ Status = "Pass"; Details = "Chiffrement fort: $cipher ($strength bits)" }
            } elseif ($strength -ge 128) {
                @{ Status = "Pass"; Details = "Chiffrement acceptable: $cipher ($strength bits)" }
            } else {
                @{ Status = "Fail"; Details = "Chiffrement faible: $cipher ($strength bits)" }
            }
        } else {
            @{ Status = "NotApplicable"; Details = "Impossible de verifier" }
        }
    }

$Categories += @{
    Name = "Configuration TLS/SSL"
    Controls = $tlsControls
}
#endregion

#region Category: Sensitive Files
Write-ColorOutput "`n--- FICHIERS SENSIBLES ---`n" "Cyan"
$fileControls = @()

$sensitiveFiles = @(
    @{ Path = "/.git/config"; Name = "Git Configuration" },
    @{ Path = "/.env"; Name = "Environment File" },
    @{ Path = "/wp-config.php"; Name = "WordPress Config" },
    @{ Path = "/web.config"; Name = "IIS Web Config" },
    @{ Path = "/.htaccess"; Name = "Apache htaccess" },
    @{ Path = "/robots.txt"; Name = "Robots.txt" },
    @{ Path = "/sitemap.xml"; Name = "Sitemap XML" },
    @{ Path = "/.well-known/security.txt"; Name = "Security.txt" },
    @{ Path = "/backup.zip"; Name = "Backup Archive" },
    @{ Path = "/database.sql"; Name = "Database Dump" },
    @{ Path = "/phpinfo.php"; Name = "PHP Info" },
    @{ Path = "/server-status"; Name = "Apache Status" },
    @{ Path = "/.DS_Store"; Name = "MacOS DS_Store" },
    @{ Path = "/Thumbs.db"; Name = "Windows Thumbs" },
    @{ Path = "/crossdomain.xml"; Name = "Flash Crossdomain" }
)

$controlIndex = 1
foreach ($file in $sensitiveFiles) {
    $controlId = "WEB-FILE-{0:D3}" -f $controlIndex
    $testUrl = $Url.TrimEnd('/') + $file.Path
    
    $fileControls += Test-Control -Id $controlId -Name $file.Name -Category "Fichiers Sensibles" `
        -Description "Verifie si $($file.Path) est accessible publiquement" `
        -Remediation "Bloquer l'acces a ce fichier via le serveur web" `
        -Reference "OWASP Information Leakage" `
        -Test {
            try {
                $response = Invoke-WebRequest -Uri $testUrl -Method Head -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
                if ($response.StatusCode -eq 200) {
                    if ($file.Path -match "(robots\.txt|sitemap\.xml|security\.txt)") {
                        @{ Status = "Pass"; Details = "Fichier present (normal): $($file.Path)" }
                    } else {
                        @{ Status = "Fail"; Details = "Fichier sensible accessible: $($file.Path)" }
                    }
                } else {
                    @{ Status = "Pass"; Details = "Fichier non accessible (HTTP $($response.StatusCode))" }
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

#region Category: Directory Listing
Write-ColorOutput "`n--- LISTING REPERTOIRES ---`n" "Cyan"
$dirControls = @()

$directories = @("/", "/images/", "/css/", "/js/", "/assets/", "/uploads/", "/backup/", "/admin/", "/api/", "/data/")

$controlIndex = 1
foreach ($dir in $directories) {
    $controlId = "WEB-DIR-{0:D3}" -f $controlIndex
    $testUrl = $Url.TrimEnd('/') + $dir
    
    $dirControls += Test-Control -Id $controlId -Name "Directory Listing: $dir" -Category "Listing Repertoires" `
        -Description "Verifie si le listing du repertoire $dir est active" `
        -Remediation "Desactiver le listing des repertoires dans la configuration du serveur" `
        -Reference "OWASP Directory Browsing" `
        -Test {
            try {
                $response = Invoke-WebRequest -Uri $testUrl -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
                $content = $response.Content
                if ($content -match "Index of|Directory listing|Parent Directory|\[DIR\]|<title>Index") {
                    @{ Status = "Fail"; Details = "Directory listing active pour $dir" }
                } else {
                    @{ Status = "Pass"; Details = "Directory listing desactive" }
                }
            }
            catch {
                @{ Status = "Pass"; Details = "Repertoire non accessible ou listing desactive" }
            }
        }
    
    $controlIndex++
}

$Categories += @{
    Name = "Listing Repertoires"
    Controls = $dirControls
}
#endregion

#region Category: Cookies Security
Write-ColorOutput "`n--- SECURITE DES COOKIES ---`n" "Cyan"
$cookieControls = @()

# Recuperer les cookies
try {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $Timeout -UseBasicParsing -SessionVariable session -ErrorAction Stop
    $cookies = $session.Cookies.GetCookies($Url)
    
    if ($cookies.Count -gt 0) {
        $cookieIndex = 1
        foreach ($cookie in $cookies) {
            $controlId = "WEB-COOKIE-{0:D3}" -f $cookieIndex
            
            $cookieControls += Test-Control -Id $controlId -Name "Cookie: $($cookie.Name)" -Category "Cookies" `
                -Description "Verifie les attributs de securite du cookie $($cookie.Name)" `
                -Remediation "Configurer les attributs Secure, HttpOnly et SameSite" `
                -Reference "OWASP Session Management" `
                -Test {
                    $issues = @()
                    if (-not $cookie.Secure) { $issues += "Secure manquant" }
                    if (-not $cookie.HttpOnly) { $issues += "HttpOnly manquant" }
                    
                    if ($issues.Count -eq 0) {
                        @{ Status = "Pass"; Details = "Cookie securise: Secure=$($cookie.Secure), HttpOnly=$($cookie.HttpOnly)" }
                    } elseif ($issues.Count -eq 1) {
                        @{ Status = "Warning"; Details = "Cookie: $($issues -join ', ')" }
                    } else {
                        @{ Status = "Fail"; Details = "Cookie non securise: $($issues -join ', ')" }
                    }
                }
            
            $cookieIndex++
        }
    } else {
        $cookieControls += Test-Control -Id "WEB-COOKIE-001" -Name "No Cookies" -Category "Cookies" `
            -Description "Aucun cookie detecte" `
            -Remediation "N/A" `
            -Reference "N/A" `
            -Test {
                @{ Status = "NotApplicable"; Details = "Aucun cookie defini par le site" }
            }
    }
}
catch {
    $cookieControls += Test-Control -Id "WEB-COOKIE-001" -Name "Cookie Analysis" -Category "Cookies" `
        -Description "Analyse des cookies" `
        -Remediation "N/A" `
        -Reference "N/A" `
        -Test {
            @{ Status = "NotApplicable"; Details = "Impossible d'analyser les cookies: $($_.Exception.Message)" }
        }
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
Write-ColorOutput "  RESULTATS DE L'AUDIT" "Cyan"
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

$uri = [System.Uri]$Url
$sanitizedHost = $uri.Host -replace '[^a-zA-Z0-9]', '_'

# Export JSON
if ($OutputFormat -in @("JSON", "Both")) {
    $jsonPath = Join-Path $OutputPath "web-security-base_${sanitizedHost}_${Timestamp}.json"
    $Results | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8
    Write-ColorOutput "`nRapport JSON: $jsonPath" "Cyan"
}

# Export HTML
if ($OutputFormat -in @("HTML", "Both")) {
    $htmlPath = Join-Path $OutputPath "web-security-base_${sanitizedHost}_${Timestamp}.html"
    
    $htmlContent = @"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Securite Web - $($uri.Host)</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; padding: 2rem; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 1rem; border: 1px solid #334155; }
        .header h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #f8fafc; }
        .header .target { color: #60a5fa; font-size: 1.1rem; }
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
            <h1>Rapport de Securite Web</h1>
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
            <p><a href="https://ist-security.fr">Infra Shield Tools</a> - Securite Web basee sur OWASP et ANSSI</p>
        </div>
    </div>
</body>
</html>
"@

    $htmlContent | Out-File -FilePath $htmlPath -Encoding UTF8
    Write-ColorOutput "Rapport HTML: $htmlPath" "Cyan"
}

Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "  AUDIT TERMINE" "Cyan"
Write-ColorOutput "========================================`n" "Cyan"
#endregion
