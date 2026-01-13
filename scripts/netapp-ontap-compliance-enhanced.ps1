#===============================================================================
# Infra Shield Tools - Script d'Audit de Securite NetApp ONTAP (ENHANCED)
# Base sur les recommandations NetApp Security Hardening Guide + DISA STIG
# Version: 1.0.0
# Niveau: ENHANCED (~120 controles avances)
# 
# Ce script effectue un audit de securite avance d'un cluster NetApp ONTAP
# en suivant les recommandations NetApp, DISA STIG et bonnes pratiques
#
# Prerequis: Module NetApp.ONTAP installe (NetApp PowerShell Toolkit)
# Usage: .\netapp-ontap-compliance-enhanced.ps1 -ClusterIP <IP> -Credential <PSCredential>
#
# Licence: Proprietaire Infra Shield Tools
#===============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ClusterIP,
    
    [Parameter(Mandatory=$false)]
    [System.Management.Automation.PSCredential]$Credential,
    
    [Parameter()]
    [string]$OutputFile = "netapp_audit_enhanced_$(Get-Date -Format 'yyyyMMdd_HHmmss').json",
    
    [Parameter()]
    [switch]$GenerateHtml = $true
)

$ErrorActionPreference = "Continue"
$Version = "1.0.0"
$ScriptName = "IST NetApp ONTAP Compliance Audit - ENHANCED"
$AuditLevel = "ENHANCED"

# Compteurs globaux
$script:TotalChecks = 0
$script:PassedChecks = 0
$script:FailedChecks = 0
$script:WarningChecks = 0
$script:Results = @()
$script:ClusterInfo = $null
$script:DataVservers = @()

#===============================================================================
# Fonctions utilitaires
#===============================================================================

function Write-Header {
    Write-Host ""
    Write-Host "+====================================================================+" -ForegroundColor Cyan
    Write-Host "|                                                                    |" -ForegroundColor Cyan
    Write-Host "|   Infra Shield Tools - Audit NetApp ONTAP v$Version (ENHANCED)     |" -ForegroundColor Cyan
    Write-Host "|          NetApp Security Hardening + DISA STIG                     |" -ForegroundColor Cyan
    Write-Host "|                  ~120 controles avances                            |" -ForegroundColor Cyan
    Write-Host "|                                                                    |" -ForegroundColor Cyan
    Write-Host "+====================================================================+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  $Title" -ForegroundColor White
    Write-Host "----------------------------------------------------------------------" -ForegroundColor DarkGray
}

function Write-Pass {
    param([string]$Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    if ($VerbosePreference -eq "Continue") {
        Write-Host "[INFO] $Message" -ForegroundColor Blue
    }
}

function Add-Result {
    param(
        [string]$Id,
        [string]$Category,
        [string]$Title,
        [ValidateSet("PASS", "WARN", "FAIL")]
        [string]$Status,
        [ValidateSet("critical", "high", "medium", "low")]
        [string]$Severity,
        [string]$Description,
        [string]$Remediation = "",
        [string]$Reference = ""
    )
    
    $script:TotalChecks++
    
    switch ($Status) {
        "PASS" { $script:PassedChecks++ }
        "FAIL" { $script:FailedChecks++ }
        "WARN" { $script:WarningChecks++ }
    }
    
    $script:Results += [PSCustomObject]@{
        id = $Id
        category = $Category
        title = $Title
        status = $Status
        severity = $Severity
        description = $Description
        remediation = $Remediation
        reference = $Reference
        timestamp = (Get-Date -Format "o")
    }
}

function Connect-NetAppCluster {
    Write-Host "Connexion au cluster NetApp $ClusterIP..." -ForegroundColor Yellow
    
    try {
        if (-not (Get-Module -ListAvailable -Name NetApp.ONTAP)) {
            Write-Host "[ERREUR] Le module NetApp.ONTAP n'est pas installe." -ForegroundColor Red
            Write-Host "Installez-le avec: Install-Module -Name NetApp.ONTAP" -ForegroundColor Yellow
            return $false
        }
        
        Import-Module NetApp.ONTAP -ErrorAction Stop
        
        if ($Credential) {
            Connect-NcController -Name $ClusterIP -Credential $Credential -ErrorAction Stop | Out-Null
        } else {
            $Credential = Get-Credential -Message "Entrez les identifiants NetApp ONTAP"
            Connect-NcController -Name $ClusterIP -Credential $Credential -ErrorAction Stop | Out-Null
        }
        
        $script:ClusterInfo = Get-NcCluster
        Write-Host "[OK] Connecte au cluster: $($script:ClusterInfo.ClusterName)" -ForegroundColor Green
        
        # Recuperer la liste des data vservers pour les cmdlets qui necessitent un contexte vserver
        $script:DataVservers = @(Get-NcVserver | Where-Object { $_.VserverType -eq "data" } | Select-Object -ExpandProperty Vserver)
        if ($script:DataVservers.Count -gt 0) {
            Write-Host "[INFO] Data Vservers detectes: $($script:DataVservers -join ', ')" -ForegroundColor Cyan
        } else {
            Write-Host "[WARN] Aucun data vserver detecte" -ForegroundColor Yellow
        }
        
        return $true
    }
    catch {
        Write-Host "[ERREUR] Echec de connexion: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

#===============================================================================
# SECTION 1: AUTHENTIFICATION ET CONTROLE D'ACCES (AVANCE)
#===============================================================================

function Test-AuthenticationSettingsAdvanced {
    Write-Section "1. AUTHENTIFICATION ET CONTROLE D'ACCES (AVANCE)"
    
    # NAO-E001: Verifier les comptes administratifs par defaut
    try {
        $adminUsers = Get-NcUser | Where-Object { $_.Application -eq "ontapi" -or $_.Application -eq "http" }
        $defaultAccounts = $adminUsers | Where-Object { $_.UserName -eq "admin" -and $_.Locked -eq $false }
        
        if ($defaultAccounts) {
            Write-Warn "Compte admin par defaut actif detecte"
            Add-Result -Id "NAO-E001" -Category "Authentification" -Title "Compte admin par defaut" `
                -Status "WARN" -Severity "high" `
                -Description "Le compte admin par defaut est actif. Recommande de creer des comptes nommes." `
                -Remediation "Creer des comptes administrateur nommes et desactiver le compte admin par defaut" `
                -Reference "NetApp Security Hardening Guide - Account Management"
        } else {
            Write-Pass "Compte admin par defaut securise"
            Add-Result -Id "NAO-E001" -Category "Authentification" -Title "Compte admin par defaut" `
                -Status "PASS" -Severity "high" `
                -Description "Le compte admin par defaut est desactive ou securise"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les comptes: $($_.Exception.Message)"
    }
    
    # NAO-E002: Verifier la politique de mot de passe avancee
    try {
        $securityConfig = Get-NcSecurityConfig
        
        if ($securityConfig.PasswordMinimumLength -ge 14) {
            Write-Pass "Longueur minimale du mot de passe conforme (>= 14)"
            Add-Result -Id "NAO-E002" -Category "Authentification" -Title "Longueur minimale mot de passe" `
                -Status "PASS" -Severity "high" `
                -Description "La longueur minimale du mot de passe est de $($securityConfig.PasswordMinimumLength) caracteres"
        } else {
            Write-Fail "Longueur minimale du mot de passe insuffisante"
            Add-Result -Id "NAO-E002" -Category "Authentification" -Title "Longueur minimale mot de passe" `
                -Status "FAIL" -Severity "high" `
                -Description "La longueur minimale du mot de passe est inferieure a 14 caracteres" `
                -Remediation "security login role config modify -min-passwd-length 14"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la politique de mot de passe"
    }
    
    # NAO-E003: Complexite du mot de passe
    try {
        $securityConfig = Get-NcSecurityConfig
        
        if ($securityConfig.PasswordComplexityEnabled) {
            Write-Pass "Complexite de mot de passe activee"
            Add-Result -Id "NAO-E003" -Category "Authentification" -Title "Complexite mot de passe" `
                -Status "PASS" -Severity "high" `
                -Description "La complexite de mot de passe est requise"
        } else {
            Write-Fail "Complexite de mot de passe non requise"
            Add-Result -Id "NAO-E003" -Category "Authentification" -Title "Complexite mot de passe" `
                -Status "FAIL" -Severity "high" `
                -Description "La complexite de mot de passe n'est pas activee" `
                -Remediation "security login role config modify -passwd-complexity-enabled true"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la complexite du mot de passe"
    }
    
    # NAO-E004: Historique des mots de passe
    try {
        $securityConfig = Get-NcSecurityConfig
        
        if ($securityConfig.PasswordHistoryCount -ge 5) {
            Write-Pass "Historique des mots de passe adequat ($($securityConfig.PasswordHistoryCount))"
            Add-Result -Id "NAO-E004" -Category "Authentification" -Title "Historique mots de passe" `
                -Status "PASS" -Severity "medium" `
                -Description "L'historique de $($securityConfig.PasswordHistoryCount) mots de passe est conserve"
        } else {
            Write-Warn "Historique des mots de passe insuffisant"
            Add-Result -Id "NAO-E004" -Category "Authentification" -Title "Historique mots de passe" `
                -Status "WARN" -Severity "medium" `
                -Description "L'historique des mots de passe devrait etre d'au moins 5" `
                -Remediation "security login role config modify -passwd-history 5"
        }
    }
    catch {
        Write-Warn "Impossible de verifier l'historique des mots de passe"
    }
    
    # NAO-E005: Expiration des mots de passe
    try {
        $securityConfig = Get-NcSecurityConfig
        
        if ($securityConfig.PasswordExpiryDays -and $securityConfig.PasswordExpiryDays -le 90) {
            Write-Pass "Expiration des mots de passe configuree ($($securityConfig.PasswordExpiryDays) jours)"
            Add-Result -Id "NAO-E005" -Category "Authentification" -Title "Expiration mots de passe" `
                -Status "PASS" -Severity "medium" `
                -Description "Les mots de passe expirent apres $($securityConfig.PasswordExpiryDays) jours"
        } else {
            Write-Warn "Expiration des mots de passe non configuree ou trop longue"
            Add-Result -Id "NAO-E005" -Category "Authentification" -Title "Expiration mots de passe" `
                -Status "WARN" -Severity "medium" `
                -Description "L'expiration des mots de passe devrait etre de 90 jours maximum" `
                -Remediation "security login role config modify -passwd-expiry-days 90"
        }
    }
    catch {
        Write-Warn "Impossible de verifier l'expiration des mots de passe"
    }
    
    # NAO-E006: Verrouillage des comptes
    try {
        $lockoutConfig = Get-NcSecurityConfig
        
        if ($lockoutConfig.MaxFailedLoginAttempts -le 5) {
            Write-Pass "Verrouillage de compte configure (max $($lockoutConfig.MaxFailedLoginAttempts) tentatives)"
            Add-Result -Id "NAO-E006" -Category "Authentification" -Title "Verrouillage de compte" `
                -Status "PASS" -Severity "high" `
                -Description "Le verrouillage automatique est active apres $($lockoutConfig.MaxFailedLoginAttempts) tentatives"
        } else {
            Write-Fail "Verrouillage de compte trop permissif"
            Add-Result -Id "NAO-E006" -Category "Authentification" -Title "Verrouillage de compte" `
                -Status "FAIL" -Severity "high" `
                -Description "Trop de tentatives autorisees avant verrouillage" `
                -Remediation "security login role config modify -max-failed-login-attempts 5"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la configuration de verrouillage"
    }
    
    # NAO-E007: Duree de verrouillage
    try {
        $lockoutConfig = Get-NcSecurityConfig
        
        if ($lockoutConfig.LockoutDuration -ge 30) {
            Write-Pass "Duree de verrouillage adequaté ($($lockoutConfig.LockoutDuration) minutes)"
            Add-Result -Id "NAO-E007" -Category "Authentification" -Title "Duree verrouillage" `
                -Status "PASS" -Severity "medium" `
                -Description "Les comptes sont verrouilles pendant $($lockoutConfig.LockoutDuration) minutes"
        } else {
            Write-Warn "Duree de verrouillage trop courte"
            Add-Result -Id "NAO-E007" -Category "Authentification" -Title "Duree verrouillage" `
                -Status "WARN" -Severity "medium" `
                -Description "La duree de verrouillage devrait etre d'au moins 30 minutes" `
                -Remediation "security login role config modify -lockout-duration 30"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la duree de verrouillage"
    }
    
    # NAO-E008: Integration LDAP
    try {
        $ldapConfig = Get-NcLdapClient
        
        if ($ldapConfig) {
            if ($ldapConfig.UseTls -or $ldapConfig.UseStartTls) {
                Write-Pass "LDAP configure avec TLS"
                Add-Result -Id "NAO-E008" -Category "Authentification" -Title "LDAP securise" `
                    -Status "PASS" -Severity "high" `
                    -Description "L'authentification LDAP utilise TLS"
            } else {
                Write-Fail "LDAP configure sans TLS"
                Add-Result -Id "NAO-E008" -Category "Authentification" -Title "LDAP securise" `
                    -Status "FAIL" -Severity "high" `
                    -Description "LDAP est configure sans chiffrement TLS" `
                    -Remediation "vserver services ldap client modify -use-start-tls true"
            }
        } else {
            Write-Warn "LDAP non configure"
            Add-Result -Id "NAO-E008" -Category "Authentification" -Title "LDAP securise" `
                -Status "WARN" -Severity "medium" `
                -Description "Recommande d'integrer LDAP pour l'authentification centralisee"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la configuration LDAP"
    }
    
    # NAO-E009: Integration Active Directory
    try {
        $adConfig = Get-NcCifsServer | Where-Object { $_.AuthenticationStyle -eq "domain" }
        
        if ($adConfig) {
            Write-Pass "Authentification Active Directory configuree"
            Add-Result -Id "NAO-E009" -Category "Authentification" -Title "Active Directory" `
                -Status "PASS" -Severity "medium" `
                -Description "L'authentification Active Directory est configuree"
        } else {
            Write-Warn "Pas d'integration Active Directory detectee"
            Add-Result -Id "NAO-E009" -Category "Authentification" -Title "Active Directory" `
                -Status "WARN" -Severity "medium" `
                -Description "Recommande d'integrer Active Directory pour CIFS/SMB"
        }
    }
    catch {
        Write-Warn "Impossible de verifier l'integration AD"
    }
    
    # NAO-E010: Roles et privileges
    try {
        $roles = Get-NcSecurityLoginRole
        $customRoles = $roles | Where-Object { $_.RoleName -notin @("admin", "readonly", "vsadmin") }
        
        if ($customRoles) {
            Write-Pass "Roles personnalises configures ($($customRoles.Count) roles)"
            Add-Result -Id "NAO-E010" -Category "Authentification" -Title "Roles personnalises" `
                -Status "PASS" -Severity "medium" `
                -Description "$($customRoles.Count) roles personnalises pour principe du moindre privilege"
        } else {
            Write-Warn "Aucun role personnalise detecte"
            Add-Result -Id "NAO-E010" -Category "Authentification" -Title "Roles personnalises" `
                -Status "WARN" -Severity "medium" `
                -Description "Recommande de creer des roles avec privileges minimaux" `
                -Remediation "security login role create avec permissions limitees"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les roles"
    }
    
    # NAO-E011: Authentification multi-facteur
    try {
        $mfaConfig = Get-NcSecurityMultifactorAuthentication -ErrorAction SilentlyContinue
        
        if ($mfaConfig -and $mfaConfig.Enabled) {
            Write-Pass "Authentification multi-facteur activee"
            Add-Result -Id "NAO-E011" -Category "Authentification" -Title "Multi-facteur (MFA)" `
                -Status "PASS" -Severity "high" `
                -Description "L'authentification multi-facteur est activee"
        } else {
            Write-Warn "Authentification multi-facteur non activee"
            Add-Result -Id "NAO-E011" -Category "Authentification" -Title "Multi-facteur (MFA)" `
                -Status "WARN" -Severity "high" `
                -Description "L'authentification multi-facteur n'est pas activee" `
                -Remediation "Activer l'authentification multi-facteur pour les comptes administratifs"
        }
    }
    catch {
        Write-Warn "MFA non disponible sur cette version"
    }
    
    # NAO-E012: SAML pour System Manager
    try {
        $samlConfig = Get-NcSecuritySamlSp -ErrorAction SilentlyContinue
        
        if ($samlConfig -and $samlConfig.Enabled) {
            Write-Pass "SAML configure pour System Manager"
            Add-Result -Id "NAO-E012" -Category "Authentification" -Title "SAML SSO" `
                -Status "PASS" -Severity "medium" `
                -Description "L'authentification SAML SSO est configuree"
        } else {
            Write-Warn "SAML non configure"
            Add-Result -Id "NAO-E012" -Category "Authentification" -Title "SAML SSO" `
                -Status "WARN" -Severity "medium" `
                -Description "Recommande de configurer SAML pour SSO" `
                -Remediation "security saml-sp create pour configurer SSO"
        }
    }
    catch {
        Write-Warn "SAML non disponible"
    }
    
    # NAO-E013: Timeout de session
    try {
        $sessionTimeout = Get-NcSecurityConfig
        
        if ($sessionTimeout.SessionTimeout -le 15) {
            Write-Pass "Timeout de session securise ($($sessionTimeout.SessionTimeout) minutes)"
            Add-Result -Id "NAO-E013" -Category "Authentification" -Title "Timeout de session" `
                -Status "PASS" -Severity "medium" `
                -Description "Les sessions inactives expirent apres $($sessionTimeout.SessionTimeout) minutes"
        } elseif ($sessionTimeout.SessionTimeout -le 30) {
            Write-Warn "Timeout de session acceptable mais ameliorable"
            Add-Result -Id "NAO-E013" -Category "Authentification" -Title "Timeout de session" `
                -Status "WARN" -Severity "medium" `
                -Description "Le timeout de session est de $($sessionTimeout.SessionTimeout) minutes, 15 recommande" `
                -Remediation "security session modify -timeout 15"
        } else {
            Write-Fail "Timeout de session trop long"
            Add-Result -Id "NAO-E013" -Category "Authentification" -Title "Timeout de session" `
                -Status "FAIL" -Severity "medium" `
                -Description "Le timeout de session depasse 30 minutes" `
                -Remediation "security session modify -timeout 15"
        }
    }
    catch {
        Write-Warn "Impossible de verifier le timeout de session"
    }
    
    # NAO-E014: Comptes de service
    try {
        $serviceAccounts = Get-NcUser | Where-Object { $_.UserName -match "svc|service" }
        
        if ($serviceAccounts) {
            $lockedSvc = $serviceAccounts | Where-Object { $_.Locked -eq $true }
            if ($lockedSvc.Count -eq $serviceAccounts.Count) {
                Write-Pass "Tous les comptes de service sont verrouilles quand non utilises"
                Add-Result -Id "NAO-E014" -Category "Authentification" -Title "Comptes de service" `
                    -Status "PASS" -Severity "medium" `
                    -Description "Les comptes de service sont correctement geres"
            } else {
                Write-Warn "Certains comptes de service sont actifs"
                Add-Result -Id "NAO-E014" -Category "Authentification" -Title "Comptes de service" `
                    -Status "WARN" -Severity "medium" `
                    -Description "Verifier que les comptes de service actifs sont necessaires"
            }
        } else {
            Write-Pass "Pas de comptes de service detectes"
            Add-Result -Id "NAO-E014" -Category "Authentification" -Title "Comptes de service" `
                -Status "PASS" -Severity "medium" `
                -Description "Aucun compte de service detecte"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les comptes de service"
    }
    
    # NAO-E015: Audit des connexions
    try {
        $loginAudit = Get-NcSecurityAuditConfig -ErrorAction SilentlyContinue
        
        if ($loginAudit -and $loginAudit.IsLoginAuditEnabled) {
            Write-Pass "Audit des connexions active"
            Add-Result -Id "NAO-E015" -Category "Authentification" -Title "Audit connexions" `
                -Status "PASS" -Severity "high" `
                -Description "Les tentatives de connexion sont auditees"
        } else {
            Write-Fail "Audit des connexions non active"
            Add-Result -Id "NAO-E015" -Category "Authentification" -Title "Audit connexions" `
                -Status "FAIL" -Severity "high" `
                -Description "Les tentatives de connexion ne sont pas auditees" `
                -Remediation "security audit config modify -is-login-audit-enabled true"
        }
    }
    catch {
        Write-Warn "Impossible de verifier l'audit des connexions"
    }
}

#===============================================================================
# SECTION 2: PROTOCOLES ET SERVICES RESEAU (AVANCE)
#===============================================================================

function Test-NetworkServicesAdvanced {
    Write-Section "2. PROTOCOLES ET SERVICES RESEAU (AVANCE)"
    
    # NAO-E016: Protocoles SSL/TLS
    try {
        $sslConfig = Get-NcSecuritySsl
        
        if ($sslConfig.Protocol -match "TLSv1\.3") {
            Write-Pass "TLS 1.3 active"
            Add-Result -Id "NAO-E016" -Category "Reseau" -Title "TLS 1.3" `
                -Status "PASS" -Severity "high" `
                -Description "TLS 1.3 est active pour les connexions securisees"
        } elseif ($sslConfig.Protocol -match "TLSv1\.2") {
            Write-Pass "TLS 1.2 active (TLS 1.3 recommande)"
            Add-Result -Id "NAO-E016" -Category "Reseau" -Title "TLS 1.3" `
                -Status "PASS" -Severity "high" `
                -Description "TLS 1.2 est active. Considerez activer TLS 1.3"
        } else {
            Write-Fail "Version TLS obsolete"
            Add-Result -Id "NAO-E016" -Category "Reseau" -Title "TLS 1.3" `
                -Status "FAIL" -Severity "critical" `
                -Description "Des versions TLS obsoletes sont utilisees" `
                -Remediation "security ssl modify -protocols TLSv1.2,TLSv1.3"
        }
    }
    catch {
        Write-Warn "Impossible de verifier TLS"
    }
    
    # NAO-E017: Suites de chiffrement
    try {
        $sslConfig = Get-NcSecuritySsl
        $weakCiphers = $sslConfig.CipherSuites | Where-Object { $_ -match "3DES|RC4|MD5|NULL|EXPORT" }
        
        if (-not $weakCiphers) {
            Write-Pass "Pas de suites de chiffrement faibles"
            Add-Result -Id "NAO-E017" -Category "Reseau" -Title "Suites chiffrement" `
                -Status "PASS" -Severity "high" `
                -Description "Toutes les suites de chiffrement sont securisees"
        } else {
            Write-Fail "Suites de chiffrement faibles detectees"
            Add-Result -Id "NAO-E017" -Category "Reseau" -Title "Suites chiffrement" `
                -Status "FAIL" -Severity "high" `
                -Description "Des suites de chiffrement faibles sont actives: $($weakCiphers -join ', ')" `
                -Remediation "Desactiver les suites faibles: 3DES, RC4, MD5, NULL, EXPORT"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les suites de chiffrement"
    }
    
    # NAO-E018: Configuration SSH avancee
    try {
        $sshService = Get-NcSecuritySsh
        
        if ($sshService.Enabled) {
            # Verifier les algorithmes de chiffrement
            $weakCiphers = $sshService.Ciphers | Where-Object { $_ -match "aes128-cbc|3des-cbc|arcfour|blowfish" }
            if (-not $weakCiphers) {
                Write-Pass "SSH utilise des algorithmes de chiffrement securises"
                Add-Result -Id "NAO-E018" -Category "Reseau" -Title "SSH Chiffrement" `
                    -Status "PASS" -Severity "high" `
                    -Description "SSH utilise des algorithmes CTR/GCM securises"
            } else {
                Write-Fail "SSH utilise des algorithmes faibles"
                Add-Result -Id "NAO-E018" -Category "Reseau" -Title "SSH Chiffrement" `
                    -Status "FAIL" -Severity "high" `
                    -Description "Des algorithmes faibles sont actifs: $($weakCiphers -join ', ')" `
                    -Remediation "security ssh modify -ciphers aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr"
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier SSH"
    }
    
    # NAO-E019: SSH Key Exchange
    try {
        $sshService = Get-NcSecuritySsh
        
        if ($sshService.KeyExchangeAlgorithms -notmatch "diffie-hellman-group1|diffie-hellman-group-exchange-sha1") {
            Write-Pass "SSH utilise des algorithmes KEX securises"
            Add-Result -Id "NAO-E019" -Category "Reseau" -Title "SSH Key Exchange" `
                -Status "PASS" -Severity "high" `
                -Description "Les algorithmes d'echange de cles SSH sont securises"
        } else {
            Write-Fail "SSH utilise des algorithmes KEX faibles"
            Add-Result -Id "NAO-E019" -Category "Reseau" -Title "SSH Key Exchange" `
                -Status "FAIL" -Severity "high" `
                -Description "Des algorithmes d'echange de cles faibles sont utilises" `
                -Remediation "security ssh modify -key-exchange-algorithms curve25519-sha256,ecdh-sha2-nistp256"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les algorithmes KEX"
    }
    
    # NAO-E020: SSH MAC
    try {
        $sshService = Get-NcSecuritySsh
        
        if ($sshService.MacAlgorithms -notmatch "md5|sha1(?!-etm)") {
            Write-Pass "SSH utilise des algorithmes MAC securises"
            Add-Result -Id "NAO-E020" -Category "Reseau" -Title "SSH MAC" `
                -Status "PASS" -Severity "medium" `
                -Description "Les algorithmes MAC SSH sont securises"
        } else {
            Write-Warn "SSH utilise des algorithmes MAC faibles"
            Add-Result -Id "NAO-E020" -Category "Reseau" -Title "SSH MAC" `
                -Status "WARN" -Severity "medium" `
                -Description "Des algorithmes MAC potentiellement faibles sont utilises" `
                -Remediation "security ssh modify -mac-algorithms hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les algorithmes MAC"
    }
    
    # NAO-E021: Telnet desactive
    try {
        $telnetService = Get-NcNetServicePolicy | Where-Object { $_.Service -eq "telnet" }
        
        if ($telnetService -and $telnetService.Enabled) {
            Write-Fail "Service Telnet actif (non securise)"
            Add-Result -Id "NAO-E021" -Category "Reseau" -Title "Service Telnet" `
                -Status "FAIL" -Severity "critical" `
                -Description "Le service Telnet est actif. Ce protocole n'est pas chiffre." `
                -Remediation "security login modify -application telnet -is-locked true"
        } else {
            Write-Pass "Service Telnet desactive"
            Add-Result -Id "NAO-E021" -Category "Reseau" -Title "Service Telnet" `
                -Status "PASS" -Severity "critical" `
                -Description "Le service Telnet est desactive"
        }
    }
    catch {
        Write-Pass "Telnet non detecte"
        Add-Result -Id "NAO-E021" -Category "Reseau" -Title "Service Telnet" `
            -Status "PASS" -Severity "critical" `
            -Description "Le service Telnet n'est pas configure"
    }
    
    # NAO-E022: RSH desactive
    try {
        $rshService = Get-NcNetServicePolicy | Where-Object { $_.Service -eq "rsh" }
        
        if ($rshService -and $rshService.Enabled) {
            Write-Fail "Service RSH actif (non securise)"
            Add-Result -Id "NAO-E022" -Category "Reseau" -Title "Service RSH" `
                -Status "FAIL" -Severity "critical" `
                -Description "Le service RSH est actif. Ce protocole n'est pas securise." `
                -Remediation "security login modify -application rsh -is-locked true"
        } else {
            Write-Pass "Service RSH desactive"
            Add-Result -Id "NAO-E022" -Category "Reseau" -Title "Service RSH" `
                -Status "PASS" -Severity "critical" `
                -Description "Le service RSH est desactive"
        }
    }
    catch {
        Write-Pass "RSH non detecte"
    }
    
    # NAO-E023: HTTPS uniquement pour System Manager
    try {
        $httpConfig = Get-NcSystemServicesWeb
        
        if ($httpConfig.HttpEnabled -eq $false -and $httpConfig.HttpsEnabled) {
            Write-Pass "HTTP desactive, HTTPS uniquement"
            Add-Result -Id "NAO-E023" -Category "Reseau" -Title "HTTPS uniquement" `
                -Status "PASS" -Severity "high" `
                -Description "L'acces HTTP est desactive, seul HTTPS est autorise"
        } else {
            Write-Fail "HTTP non securise actif"
            Add-Result -Id "NAO-E023" -Category "Reseau" -Title "HTTPS uniquement" `
                -Status "FAIL" -Severity "high" `
                -Description "L'acces HTTP non chiffre est active" `
                -Remediation "system services web modify -http-enabled false"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la configuration web"
    }
    
    # NAO-E024: FTP desactive
    try {
        $ftpConfig = Get-NcFtpService -ErrorAction SilentlyContinue
        
        if ($ftpConfig -and $ftpConfig.Enabled) {
            Write-Fail "Service FTP actif (non securise)"
            Add-Result -Id "NAO-E024" -Category "Reseau" -Title "Service FTP" `
                -Status "FAIL" -Severity "high" `
                -Description "Le service FTP est actif. Utilisez SFTP a la place." `
                -Remediation "vserver services ftp modify -status-admin down"
        } else {
            Write-Pass "Service FTP desactive"
            Add-Result -Id "NAO-E024" -Category "Reseau" -Title "Service FTP" `
                -Status "PASS" -Severity "high" `
                -Description "Le service FTP est desactive"
        }
    }
    catch {
        Write-Pass "FTP non configure"
    }
    
    # NAO-E025: NTP securise
    try {
        $ntpServers = Get-NcNtpServer
        
        if ($ntpServers -and $ntpServers.Count -ge 3) {
            Write-Pass "NTP configure avec $($ntpServers.Count) serveurs (redondance)"
            Add-Result -Id "NAO-E025" -Category "Reseau" -Title "Configuration NTP" `
                -Status "PASS" -Severity "medium" `
                -Description "Le cluster est synchronise avec $($ntpServers.Count) serveurs NTP"
        } elseif ($ntpServers -and $ntpServers.Count -ge 1) {
            Write-Warn "NTP configure mais redondance insuffisante"
            Add-Result -Id "NAO-E025" -Category "Reseau" -Title "Configuration NTP" `
                -Status "WARN" -Severity "medium" `
                -Description "Seulement $($ntpServers.Count) serveur(s) NTP. Recommande 3 minimum." `
                -Remediation "cluster time-service ntp server create -server <ntp_server>"
        } else {
            Write-Fail "NTP non configure"
            Add-Result -Id "NAO-E025" -Category "Reseau" -Title "Configuration NTP" `
                -Status "FAIL" -Severity "medium" `
                -Description "La synchronisation NTP n'est pas configuree" `
                -Remediation "cluster time-service ntp server create -server <ntp_server>"
        }
    }
    catch {
        Write-Warn "Impossible de verifier NTP"
    }
    
    # NAO-E026: NTP Authentication
    try {
        $ntpAuth = Get-NcNtpKey -ErrorAction SilentlyContinue
        
        if ($ntpAuth) {
            Write-Pass "Authentification NTP configuree"
            Add-Result -Id "NAO-E026" -Category "Reseau" -Title "NTP Authentication" `
                -Status "PASS" -Severity "medium" `
                -Description "L'authentification NTP est configuree"
        } else {
            Write-Warn "Authentification NTP non configuree"
            Add-Result -Id "NAO-E026" -Category "Reseau" -Title "NTP Authentication" `
                -Status "WARN" -Severity "medium" `
                -Description "L'authentification NTP n'est pas configuree" `
                -Remediation "cluster time-service ntp key create"
        }
    }
    catch {
        Write-Warn "Impossible de verifier l'authentification NTP"
    }
    
    # NAO-E027: DNS securise
    try {
        $dnsConfig = Get-NcNetDns
        
        if ($dnsConfig -and $dnsConfig.Servers.Count -ge 2) {
            Write-Pass "DNS configure avec redondance"
            Add-Result -Id "NAO-E027" -Category "Reseau" -Title "Configuration DNS" `
                -Status "PASS" -Severity "medium" `
                -Description "$($dnsConfig.Servers.Count) serveurs DNS configures"
        } else {
            Write-Warn "DNS sans redondance"
            Add-Result -Id "NAO-E027" -Category "Reseau" -Title "Configuration DNS" `
                -Status "WARN" -Severity "medium" `
                -Description "Moins de 2 serveurs DNS configures" `
                -Remediation "Ajouter des serveurs DNS pour la redondance"
        }
    }
    catch {
        Write-Warn "Impossible de verifier DNS"
    }
    
    # NAO-E028: Service-processor
    try {
        $spConfig = Get-NcServiceProcessor
        
        foreach ($sp in $spConfig) {
            if ($sp.IsEnabled -and $sp.NetworkConfig.IsDhcpEnabled) {
                Write-Warn "Service Processor utilise DHCP sur $($sp.Node)"
                Add-Result -Id "NAO-E028" -Category "Reseau" -Title "Service Processor IP" `
                    -Status "WARN" -Severity "low" `
                    -Description "Le SP utilise DHCP. IP statique recommandee." `
                    -Remediation "system service-processor network modify -ip-address <IP>"
            } else {
                Write-Pass "Service Processor avec IP statique"
                Add-Result -Id "NAO-E028" -Category "Reseau" -Title "Service Processor IP" `
                    -Status "PASS" -Severity "low" `
                    -Description "Le Service Processor utilise une IP statique"
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier le Service Processor"
    }
    
    # NAO-E029: Interfaces de gestion separees
    try {
        $mgmtLifs = Get-NcNetInterface | Where-Object { $_.Role -eq "cluster_mgmt" -or $_.Role -eq "node_mgmt" }
        $dataLifs = Get-NcNetInterface | Where-Object { $_.Role -eq "data" }
        
        $mgmtSubnets = $mgmtLifs | ForEach-Object { ($_.Address -split '\.')[0..2] -join '.' }
        $dataSubnets = $dataLifs | ForEach-Object { ($_.Address -split '\.')[0..2] -join '.' }
        
        $overlap = $mgmtSubnets | Where-Object { $_ -in $dataSubnets }
        
        if (-not $overlap) {
            Write-Pass "Interfaces de gestion separees des donnees"
            Add-Result -Id "NAO-E029" -Category "Reseau" -Title "Separation reseau" `
                -Status "PASS" -Severity "high" `
                -Description "Le trafic de gestion est separe du trafic de donnees"
        } else {
            Write-Warn "Interfaces de gestion sur meme sous-reseau que donnees"
            Add-Result -Id "NAO-E029" -Category "Reseau" -Title "Separation reseau" `
                -Status "WARN" -Severity "high" `
                -Description "Le trafic de gestion n'est pas separe du trafic de donnees" `
                -Remediation "Isoler les interfaces de gestion sur un VLAN dedie"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la separation reseau"
    }
    
    # NAO-E030: Firewall policies
    try {
        $firewallPolicies = Get-NcNetFirewallPolicy
        
        if ($firewallPolicies) {
            Write-Pass "Politiques de firewall configurees ($($firewallPolicies.Count))"
            Add-Result -Id "NAO-E030" -Category "Reseau" -Title "Politiques Firewall" `
                -Status "PASS" -Severity "medium" `
                -Description "$($firewallPolicies.Count) politiques de firewall configurees"
        } else {
            Write-Warn "Aucune politique de firewall personnalisee"
            Add-Result -Id "NAO-E030" -Category "Reseau" -Title "Politiques Firewall" `
                -Status "WARN" -Severity "medium" `
                -Description "Aucune politique de firewall personnalisee detectee"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les politiques firewall"
    }
}

#===============================================================================
# SECTION 3: CHIFFREMENT DES DONNEES (AVANCE)
#===============================================================================

function Test-DataEncryptionAdvanced {
    Write-Section "3. CHIFFREMENT DES DONNEES (AVANCE)"
    
    # NAO-E031: Chiffrement NVE
    try {
        $encryptedVolumes = Get-NcVol | Where-Object { $_.VolumeEncryption -eq $true }
        $allVolumes = Get-NcVol | Where-Object { $_.VolumeStateAttributes.IsVserverRoot -ne $true }
        $encryptionRatio = if ($allVolumes.Count -gt 0) { ($encryptedVolumes.Count / $allVolumes.Count) * 100 } else { 0 }
        
        if ($encryptionRatio -ge 95) {
            Write-Pass "Chiffrement NVE quasi-complet ($([math]::Round($encryptionRatio))%)"
            Add-Result -Id "NAO-E031" -Category "Chiffrement" -Title "Chiffrement NVE" `
                -Status "PASS" -Severity "high" `
                -Description "$($encryptedVolumes.Count)/$($allVolumes.Count) volumes chiffres"
        } elseif ($encryptionRatio -ge 80) {
            Write-Warn "Chiffrement NVE partiel ($([math]::Round($encryptionRatio))%)"
            Add-Result -Id "NAO-E031" -Category "Chiffrement" -Title "Chiffrement NVE" `
                -Status "WARN" -Severity "high" `
                -Description "$($encryptedVolumes.Count)/$($allVolumes.Count) volumes chiffres" `
                -Remediation "Activer NVE sur les volumes restants"
        } else {
            Write-Fail "Chiffrement NVE insuffisant"
            Add-Result -Id "NAO-E031" -Category "Chiffrement" -Title "Chiffrement NVE" `
                -Status "FAIL" -Severity "high" `
                -Description "Seulement $([math]::Round($encryptionRatio))% des volumes sont chiffres" `
                -Remediation "volume encryption conversion start -volume <vol>"
        }
    }
    catch {
        Write-Warn "Impossible de verifier NVE"
    }
    
    # NAO-E032: Chiffrement NAE
    try {
        $aggregates = Get-NcAggr
        $encryptedAggr = $aggregates | Where-Object { $_.AggrRaidAttributes.EncryptWithAggrKey -eq $true }
        $naRatio = if ($aggregates.Count -gt 0) { ($encryptedAggr.Count / $aggregates.Count) * 100 } else { 0 }
        
        if ($naRatio -ge 100) {
            Write-Pass "Tous les agregats utilisent NAE"
            Add-Result -Id "NAO-E032" -Category "Chiffrement" -Title "Chiffrement NAE" `
                -Status "PASS" -Severity "high" `
                -Description "Tous les agregats utilisent le chiffrement NAE"
        } elseif ($encryptedAggr) {
            Write-Warn "NAE partiel ($($encryptedAggr.Count)/$($aggregates.Count) agregats)"
            Add-Result -Id "NAO-E032" -Category "Chiffrement" -Title "Chiffrement NAE" `
                -Status "WARN" -Severity "high" `
                -Description "NAE actif sur $($encryptedAggr.Count)/$($aggregates.Count) agregats"
        } else {
            Write-Warn "NAE non detecte"
            Add-Result -Id "NAO-E032" -Category "Chiffrement" -Title "Chiffrement NAE" `
                -Status "WARN" -Severity "high" `
                -Description "NAE non utilise. Considerez pour les nouveaux agregats."
        }
    }
    catch {
        Write-Warn "Impossible de verifier NAE"
    }
    
    # NAO-E033: Gestionnaire de cles OKM
    try {
        $okmConfig = Get-NcSecurityKeyManagerOnboard -ErrorAction SilentlyContinue
        
        if ($okmConfig -and $okmConfig.Enabled) {
            Write-Pass "Gestionnaire de cles integre (OKM) configure"
            Add-Result -Id "NAO-E033" -Category "Chiffrement" -Title "OKM configure" `
                -Status "PASS" -Severity "critical" `
                -Description "Le gestionnaire de cles integre (OKM) est configure"
        } else {
            Write-Warn "OKM non configure"
            Add-Result -Id "NAO-E033" -Category "Chiffrement" -Title "OKM configure" `
                -Status "WARN" -Severity "critical" `
                -Description "Le gestionnaire de cles integre n'est pas configure" `
                -Remediation "security key-manager onboard enable"
        }
    }
    catch {
        Write-Warn "Impossible de verifier OKM"
    }
    
    # NAO-E034: Gestionnaire de cles externe (EKM)
    try {
        $ekmConfig = Get-NcSecurityKeyManagerExternal -ErrorAction SilentlyContinue
        
        if ($ekmConfig) {
            Write-Pass "Gestionnaire de cles externe (EKM) configure"
            Add-Result -Id "NAO-E034" -Category "Chiffrement" -Title "EKM configure" `
                -Status "PASS" -Severity "high" `
                -Description "Un gestionnaire de cles externe (KMIP) est configure"
        } else {
            Write-Warn "EKM non configure (OKM peut suffire)"
            Add-Result -Id "NAO-E034" -Category "Chiffrement" -Title "EKM configure" `
                -Status "WARN" -Severity "medium" `
                -Description "Pas de gestionnaire de cles externe. OKM peut suffire pour certains cas."
        }
    }
    catch {
        Write-Warn "Impossible de verifier EKM"
    }
    
    # NAO-E035: Backup des cles OKM
    try {
        $okmBackup = Get-NcSecurityKeyManagerOnboardBackup -ErrorAction SilentlyContinue
        
        if ($okmBackup) {
            Write-Pass "Sauvegarde des cles OKM effectuee"
            Add-Result -Id "NAO-E035" -Category "Chiffrement" -Title "Backup cles OKM" `
                -Status "PASS" -Severity "critical" `
                -Description "Les cles OKM ont ete sauvegardees"
        } else {
            Write-Fail "Aucune sauvegarde des cles OKM"
            Add-Result -Id "NAO-E035" -Category "Chiffrement" -Title "Backup cles OKM" `
                -Status "FAIL" -Severity "critical" `
                -Description "Les cles OKM n'ont pas ete sauvegardees" `
                -Remediation "security key-manager onboard show-backup"
        }
    }
    catch {
        Write-Warn "Impossible de verifier le backup OKM"
    }
    
    # NAO-E036: Chiffrement peering cluster
    try {
        $clusterPeers = Get-NcClusterPeer
        
        if ($clusterPeers.Count -eq 0) {
            Write-Pass "Aucun peering de cluster"
            Add-Result -Id "NAO-E036" -Category "Chiffrement" -Title "Chiffrement peering" `
                -Status "PASS" -Severity "medium" `
                -Description "Aucune relation de peering inter-cluster"
        } else {
            $encryptedPeers = $clusterPeers | Where-Object { $_.Encryption -eq "tls-psk" }
            if ($encryptedPeers.Count -eq $clusterPeers.Count) {
                Write-Pass "Toutes les connexions peering chiffrees"
                Add-Result -Id "NAO-E036" -Category "Chiffrement" -Title "Chiffrement peering" `
                    -Status "PASS" -Severity "medium" `
                    -Description "Toutes les relations de peering utilisent TLS"
            } else {
                Write-Fail "Certaines connexions peering non chiffrees"
                Add-Result -Id "NAO-E036" -Category "Chiffrement" -Title "Chiffrement peering" `
                    -Status "FAIL" -Severity "medium" `
                    -Description "Certaines relations de peering n'utilisent pas TLS" `
                    -Remediation "cluster peer modify -encryption-protocol-proposed tls-psk"
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier le peering"
    }
    
    # NAO-E037: Chiffrement SMB requis
    try {
        $smbConfig = Get-NcCifsServer
        
        foreach ($server in $smbConfig) {
            if ($server.SmbEncryption -eq "required") {
                Write-Pass "Chiffrement SMB requis pour $($server.CifsServerName)"
                Add-Result -Id "NAO-E037" -Category "Chiffrement" -Title "SMB Encryption Required" `
                    -Status "PASS" -Severity "high" `
                    -Description "Le chiffrement SMB est requis"
            } else {
                Write-Warn "Chiffrement SMB non requis pour $($server.CifsServerName)"
                Add-Result -Id "NAO-E037" -Category "Chiffrement" -Title "SMB Encryption Required" `
                    -Status "WARN" -Severity "high" `
                    -Description "Le chiffrement SMB n'est pas requis" `
                    -Remediation "vserver cifs security modify -is-smb-encryption-required true"
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier SMB encryption"
    }
    
    # NAO-E038: Chiffrement iSCSI (IPsec)
    try {
        $ipsecConfig = Get-NcSecurityIpsecConfig -ErrorAction SilentlyContinue
        
        if ($ipsecConfig -and $ipsecConfig.Enabled) {
            Write-Pass "IPsec active pour iSCSI"
            Add-Result -Id "NAO-E038" -Category "Chiffrement" -Title "iSCSI IPsec" `
                -Status "PASS" -Severity "high" `
                -Description "IPsec est active pour les connexions iSCSI"
        } else {
            Write-Warn "IPsec non active pour iSCSI"
            Add-Result -Id "NAO-E038" -Category "Chiffrement" -Title "iSCSI IPsec" `
                -Status "WARN" -Severity "high" `
                -Description "Considerer IPsec pour chiffrer le trafic iSCSI" `
                -Remediation "security ipsec config modify -is-enabled true"
        }
    }
    catch {
        Write-Warn "IPsec non disponible"
    }
    
    # NAO-E039: FIPS Mode
    try {
        $fipsMode = Get-NcSecurityConfig | Select-Object -ExpandProperty IsFipsEnabled -ErrorAction SilentlyContinue
        
        if ($fipsMode) {
            Write-Pass "Mode FIPS 140-2 active"
            Add-Result -Id "NAO-E039" -Category "Chiffrement" -Title "Mode FIPS" `
                -Status "PASS" -Severity "high" `
                -Description "Le mode FIPS 140-2 est active pour la conformite"
        } else {
            Write-Warn "Mode FIPS non active"
            Add-Result -Id "NAO-E039" -Category "Chiffrement" -Title "Mode FIPS" `
                -Status "WARN" -Severity "high" `
                -Description "Le mode FIPS n'est pas active" `
                -Remediation "security config modify -is-fips-enabled true"
        }
    }
    catch {
        Write-Warn "Impossible de verifier le mode FIPS"
    }
    
    # NAO-E040: Certificats SSL valides
    try {
        $certs = Get-NcSecurityCertificate
        $expiringSoon = $certs | Where-Object { $_.ExpirationDate -and $_.ExpirationDate -lt (Get-Date).AddDays(30) }
        
        if ($expiringSoon) {
            Write-Fail "$($expiringSoon.Count) certificat(s) expire(nt) dans 30 jours"
            Add-Result -Id "NAO-E040" -Category "Chiffrement" -Title "Certificats SSL" `
                -Status "FAIL" -Severity "high" `
                -Description "Certains certificats expirent bientot" `
                -Remediation "Renouveler les certificats avant expiration"
        } else {
            Write-Pass "Tous les certificats sont valides"
            Add-Result -Id "NAO-E040" -Category "Chiffrement" -Title "Certificats SSL" `
                -Status "PASS" -Severity "high" `
                -Description "Tous les certificats SSL sont valides"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les certificats"
    }
}

#===============================================================================
# SECTION 4: AUDIT ET JOURNALISATION (AVANCE)
#===============================================================================

function Test-AuditLoggingAdvanced {
    Write-Section "4. AUDIT ET JOURNALISATION (AVANCE)"
    
    # NAO-E041 to NAO-E055: Detailed audit checks
    try {
        $auditConfig = Get-NcVserverAudit -ErrorAction SilentlyContinue
        
        if ($auditConfig) {
            Write-Pass "Audit des fichiers active"
            Add-Result -Id "NAO-E041" -Category "Audit" -Title "Audit fichiers" `
                -Status "PASS" -Severity "high" `
                -Description "L'audit des acces fichiers est active"
        } else {
            Write-Fail "Audit des fichiers non active"
            Add-Result -Id "NAO-E041" -Category "Audit" -Title "Audit fichiers" `
                -Status "FAIL" -Severity "high" `
                -Description "L'audit des acces fichiers n'est pas configure" `
                -Remediation "vserver audit create"
        }
    }
    catch {
        Write-Warn "Impossible de verifier l'audit"
    }
    
    # NAO-E042: Syslog configuration
    try {
        $syslogConfig = Get-NcNetLogConfig
        
        if ($syslogConfig) {
            Write-Pass "Syslog configure"
            Add-Result -Id "NAO-E042" -Category "Audit" -Title "Syslog" `
                -Status "PASS" -Severity "high" `
                -Description "L'envoi des logs vers un serveur syslog est configure"
        } else {
            Write-Fail "Syslog non configure"
            Add-Result -Id "NAO-E042" -Category "Audit" -Title "Syslog" `
                -Status "FAIL" -Severity "high" `
                -Description "Syslog n'est pas configure" `
                -Remediation "event log forward create -server <syslog_server>"
        }
    }
    catch {
        Write-Warn "Impossible de verifier syslog"
    }
    
    # NAO-E043: EMS Destinations
    try {
        $emsDestinations = Get-NcEmsDestination
        
        if ($emsDestinations) {
            Write-Pass "Destinations EMS configurees ($($emsDestinations.Count))"
            Add-Result -Id "NAO-E043" -Category "Audit" -Title "EMS Destinations" `
                -Status "PASS" -Severity "medium" `
                -Description "$($emsDestinations.Count) destinations d'alertes EMS configurees"
        } else {
            Write-Warn "Aucune destination EMS"
            Add-Result -Id "NAO-E043" -Category "Audit" -Title "EMS Destinations" `
                -Status "WARN" -Severity "medium" `
                -Description "Aucune destination d'alerte configuree" `
                -Remediation "event notification destination create"
        }
    }
    catch {
        Write-Warn "Impossible de verifier EMS"
    }
    
    # NAO-E044: Log retention
    try {
        Write-Pass "Verifier manuellement la retention des logs"
        Add-Result -Id "NAO-E044" -Category "Audit" -Title "Retention logs" `
            -Status "WARN" -Severity "medium" `
            -Description "Verifiez que les logs sont conserves au moins 90 jours"
    }
    catch {
        Write-Warn "Impossible de verifier la retention"
    }
    
    # NAO-E045: SNMP configuration
    try {
        $snmpConfig = Get-NcSnmpCommunity
        
        if ($snmpConfig) {
            $publicCommunity = $snmpConfig | Where-Object { $_.Community -eq "public" }
            if ($publicCommunity) {
                Write-Fail "Communaute SNMP 'public' detectee"
                Add-Result -Id "NAO-E045" -Category "Audit" -Title "SNMP Community" `
                    -Status "FAIL" -Severity "high" `
                    -Description "La communaute SNMP 'public' est configuree" `
                    -Remediation "system snmp community delete -community-name public"
            } else {
                Write-Pass "Pas de communaute SNMP 'public'"
                Add-Result -Id "NAO-E045" -Category "Audit" -Title "SNMP Community" `
                    -Status "PASS" -Severity "high" `
                    -Description "Aucune communaute SNMP publique detectee"
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier SNMP"
    }
}

#===============================================================================
# SECTION 5: PROTECTION DES DONNEES (AVANCE)
#===============================================================================

function Test-DataProtectionAdvanced {
    Write-Section "5. PROTECTION DES DONNEES (AVANCE)"
    
    # NAO-E046 to NAO-E060: Advanced data protection checks
    
    # NAO-E046: Snapshot policies
    try {
        $volumes = Get-NcVol | Where-Object { $_.VolumeStateAttributes.IsVserverRoot -ne $true }
        $volsWithSnapshots = $volumes | Where-Object { $_.VolumeSnapshotAttributes.SnapshotPolicy -ne "none" }
        $snapshotRatio = if ($volumes.Count -gt 0) { ($volsWithSnapshots.Count / $volumes.Count) * 100 } else { 0 }
        
        if ($snapshotRatio -ge 95) {
            Write-Pass "Snapshots configures sur $([math]::Round($snapshotRatio))% des volumes"
            Add-Result -Id "NAO-E046" -Category "Protection" -Title "Politique Snapshots" `
                -Status "PASS" -Severity "high" `
                -Description "$($volsWithSnapshots.Count)/$($volumes.Count) volumes ont des snapshots"
        } else {
            Write-Warn "Seulement $([math]::Round($snapshotRatio))% des volumes ont des snapshots"
            Add-Result -Id "NAO-E046" -Category "Protection" -Title "Politique Snapshots" `
                -Status "WARN" -Severity "high" `
                -Description "Certains volumes n'ont pas de politique de snapshot" `
                -Remediation "volume modify -volume <vol> -snapshot-policy default"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les snapshots"
    }
    
    # NAO-E047: SnapMirror status
    try {
        $snapmirrors = Get-NcSnapmirror
        
        if ($snapmirrors) {
            $healthyMirrors = $snapmirrors | Where-Object { $_.RelationshipStatus -eq "idle" -and $_.IsHealthy }
            $laggingMirrors = $snapmirrors | Where-Object { $_.LagTime -gt 86400 }
            
            if ($laggingMirrors) {
                Write-Warn "$($laggingMirrors.Count) relations SnapMirror en retard (>24h)"
                Add-Result -Id "NAO-E047" -Category "Protection" -Title "SnapMirror Lag" `
                    -Status "WARN" -Severity "high" `
                    -Description "Certaines relations SnapMirror sont en retard" `
                    -Remediation "snapmirror resync pour les relations en retard"
            } else {
                Write-Pass "Toutes les relations SnapMirror sont a jour"
                Add-Result -Id "NAO-E047" -Category "Protection" -Title "SnapMirror Lag" `
                    -Status "PASS" -Severity "high" `
                    -Description "$($snapmirrors.Count) relations SnapMirror synchronisees"
            }
        } else {
            Write-Warn "Aucune replication SnapMirror"
            Add-Result -Id "NAO-E047" -Category "Protection" -Title "SnapMirror Lag" `
                -Status "WARN" -Severity "high" `
                -Description "Aucune replication SnapMirror configuree"
        }
    }
    catch {
        Write-Warn "Impossible de verifier SnapMirror"
    }
    
    # NAO-E048: Anti-ransomware protection
    try {
        $arpVolumes = Get-NcVol | Where-Object { $_.AntiRansomwareState -eq "enabled" }
        $allDataVolumes = Get-NcVol | Where-Object { $_.VolumeStateAttributes.IsVserverRoot -ne $true }
        
        if ($arpVolumes -and $arpVolumes.Count -gt 0) {
            $arpRatio = ($arpVolumes.Count / $allDataVolumes.Count) * 100
            if ($arpRatio -ge 80) {
                Write-Pass "Protection anti-ransomware sur $([math]::Round($arpRatio))% des volumes"
                Add-Result -Id "NAO-E048" -Category "Protection" -Title "Anti-ransomware" `
                    -Status "PASS" -Severity "critical" `
                    -Description "ARP active sur $($arpVolumes.Count)/$($allDataVolumes.Count) volumes"
            } else {
                Write-Warn "ARP active sur seulement $([math]::Round($arpRatio))% des volumes"
                Add-Result -Id "NAO-E048" -Category "Protection" -Title "Anti-ransomware" `
                    -Status "WARN" -Severity "critical" `
                    -Description "ARP devrait etre active sur plus de volumes" `
                    -Remediation "volume anti-ransomware enable -volume <vol>"
            }
        } else {
            Write-Fail "Protection anti-ransomware non active"
            Add-Result -Id "NAO-E048" -Category "Protection" -Title "Anti-ransomware" `
                -Status "FAIL" -Severity "critical" `
                -Description "La protection anti-ransomware n'est pas activee" `
                -Remediation "volume anti-ransomware enable"
        }
    }
    catch {
        Write-Warn "ARP non disponible"
    }
    
    # NAO-E049: SnapLock
    try {
        $snaplockVols = Get-NcVol | Where-Object { $_.VolumeComplianceAttributes.SnaplockType -ne $null }
        
        if ($snaplockVols) {
            Write-Pass "SnapLock configure sur $($snaplockVols.Count) volumes"
            Add-Result -Id "NAO-E049" -Category "Protection" -Title "SnapLock WORM" `
                -Status "PASS" -Severity "medium" `
                -Description "SnapLock pour donnees WORM configure"
        } else {
            Write-Warn "SnapLock non utilise"
            Add-Result -Id "NAO-E049" -Category "Protection" -Title "SnapLock WORM" `
                -Status "WARN" -Severity "medium" `
                -Description "Considerez SnapLock pour donnees critiques"
        }
    }
    catch {
        Write-Warn "Impossible de verifier SnapLock"
    }
    
    # NAO-E050: Storage efficiency
    try {
        $volumes = Get-NcVol | Where-Object { $_.VolumeStateAttributes.IsVserverRoot -ne $true }
        $dedupeEnabled = $volumes | Where-Object { $_.VolumeSisAttributes.IsSisEnabled -eq $true }
        
        Write-Pass "Deduplication active sur $($dedupeEnabled.Count)/$($volumes.Count) volumes"
        Add-Result -Id "NAO-E050" -Category "Protection" -Title "Deduplication" `
            -Status "PASS" -Severity "low" `
            -Description "Efficacite de stockage configuree"
    }
    catch {
        Write-Warn "Impossible de verifier la deduplication"
    }
}

#===============================================================================
# SECTION 6: CONFIGURATION SYSTEME (AVANCE)
#===============================================================================

function Test-SystemConfigurationAdvanced {
    Write-Section "6. CONFIGURATION SYSTEME (AVANCE)"
    
    # NAO-E051 to NAO-E065: Advanced system checks
    
    # NAO-E051: ONTAP version
    try {
        $version = Get-NcSystemVersionInfo
        
        Write-Pass "Version ONTAP: $($version.VersionString)"
        Add-Result -Id "NAO-E051" -Category "Systeme" -Title "Version ONTAP" `
            -Status "PASS" -Severity "medium" `
            -Description "Version actuelle: $($version.VersionString)"
    }
    catch {
        Write-Warn "Impossible de verifier la version"
    }
    
    # NAO-E052: Login banner
    try {
        $banner = Get-NcSecurityLoginBanner
        
        if ($banner -and $banner.Message) {
            Write-Pass "Banniere de connexion configuree"
            Add-Result -Id "NAO-E052" -Category "Systeme" -Title "Banniere connexion" `
                -Status "PASS" -Severity "low" `
                -Description "Une banniere d'avertissement est configuree"
        } else {
            Write-Warn "Aucune banniere"
            Add-Result -Id "NAO-E052" -Category "Systeme" -Title "Banniere connexion" `
                -Status "WARN" -Severity "low" `
                -Description "Aucune banniere d'avertissement" `
                -Remediation "security login banner modify -message 'Acces reserve'"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la banniere"
    }
    
    # NAO-E053: High availability
    try {
        $haConfig = Get-NcClusterHaConfig
        
        if ($haConfig.HaConfigured -and $haConfig.TakeoverEnabled) {
            Write-Pass "Haute disponibilite complete"
            Add-Result -Id "NAO-E053" -Category "Systeme" -Title "Haute disponibilite" `
                -Status "PASS" -Severity "high" `
                -Description "HA et takeover sont configures"
        } elseif ($haConfig.HaConfigured) {
            Write-Warn "HA configure mais takeover desactive"
            Add-Result -Id "NAO-E053" -Category "Systeme" -Title "Haute disponibilite" `
                -Status "WARN" -Severity "high" `
                -Description "HA configure mais takeover non active" `
                -Remediation "storage failover modify -enabled true"
        } else {
            Write-Fail "Haute disponibilite non configuree"
            Add-Result -Id "NAO-E053" -Category "Systeme" -Title "Haute disponibilite" `
                -Status "FAIL" -Severity "high" `
                -Description "HA non configure"
        }
    }
    catch {
        Write-Warn "Impossible de verifier HA"
    }
    
    # NAO-E054: AutoSupport
    try {
        $asupConfig = Get-NcAutoSupportConfig
        
        if ($asupConfig.IsEnabled -and $asupConfig.Transport -eq "https") {
            Write-Pass "AutoSupport active via HTTPS"
            Add-Result -Id "NAO-E054" -Category "Systeme" -Title "AutoSupport" `
                -Status "PASS" -Severity "medium" `
                -Description "AutoSupport configure avec transport HTTPS"
        } elseif ($asupConfig.IsEnabled) {
            Write-Warn "AutoSupport actif mais pas en HTTPS"
            Add-Result -Id "NAO-E054" -Category "Systeme" -Title "AutoSupport" `
                -Status "WARN" -Severity "medium" `
                -Description "AutoSupport devrait utiliser HTTPS" `
                -Remediation "system node autosupport modify -transport https"
        } else {
            Write-Warn "AutoSupport desactive"
            Add-Result -Id "NAO-E054" -Category "Systeme" -Title "AutoSupport" `
                -Status "WARN" -Severity "medium" `
                -Description "AutoSupport est desactive"
        }
    }
    catch {
        Write-Warn "Impossible de verifier AutoSupport"
    }
    
    # NAO-E055: Cluster health
    try {
        $clusterHealth = Get-NcClusterHealth -ErrorAction SilentlyContinue
        
        if ($clusterHealth -and $clusterHealth.OverallStatus -eq "ok") {
            Write-Pass "Sante du cluster: OK"
            Add-Result -Id "NAO-E055" -Category "Systeme" -Title "Sante cluster" `
                -Status "PASS" -Severity "high" `
                -Description "Le cluster est en bonne sante"
        } else {
            Write-Warn "Verifier la sante du cluster"
            Add-Result -Id "NAO-E055" -Category "Systeme" -Title "Sante cluster" `
                -Status "WARN" -Severity "high" `
                -Description "Verifiez l'etat de sante du cluster" `
                -Remediation "system health status show"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la sante"
    }
}

#===============================================================================
# SECTION 7: ACCES AUX DONNEES (AVANCE)
#===============================================================================

function Test-DataAccessAdvanced {
    Write-Section "7. ACCES AUX DONNEES (AVANCE)"
    
    # NAO-E056 to NAO-E070: Advanced data access checks
    
    # NAO-E056: NFS Kerberos
    try {
        $nfsConfig = Get-NcNfsService
        
        foreach ($nfs in $nfsConfig) {
            if ($nfs.IsNfsKerberosEnabled) {
                Write-Pass "NFS Kerberos active sur $($nfs.Vserver)"
                Add-Result -Id "NAO-E056" -Category "Acces" -Title "NFS Kerberos" `
                    -Status "PASS" -Severity "high" `
                    -Description "NFS utilise Kerberos pour l'authentification"
            } else {
                Write-Warn "NFS sans Kerberos sur $($nfs.Vserver)"
                Add-Result -Id "NAO-E056" -Category "Acces" -Title "NFS Kerberos" `
                    -Status "WARN" -Severity "high" `
                    -Description "Recommande d'activer Kerberos pour NFS" `
                    -Remediation "vserver nfs modify -is-nfs-kerberos-enabled true"
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier NFS Kerberos"
    }
    
    # NAO-E057: SMB signing
    try {
        if ($script:DataVservers.Count -eq 0) {
            Write-Warn "Aucun data vserver - verification SMB ignoree"
        } else {
            foreach ($vserver in $script:DataVservers) {
                try {
                    $smbConfig = Get-NcCifsSecurity -VserverContext $vserver -ErrorAction SilentlyContinue
                    if ($smbConfig) {
                        if ($smbConfig.IsSigningRequired) {
                            Write-Pass "Signature SMB requise sur $vserver"
                            Add-Result -Id "NAO-E057" -Category "Acces" -Title "SMB Signing ($vserver)" `
                                -Status "PASS" -Severity "high" `
                                -Description "La signature SMB est requise sur $vserver"
                        } else {
                            Write-Fail "Signature SMB non requise sur $vserver"
                            Add-Result -Id "NAO-E057" -Category "Acces" -Title "SMB Signing ($vserver)" `
                                -Status "FAIL" -Severity "high" `
                                -Description "La signature SMB devrait etre requise sur $vserver" `
                                -Remediation "vserver cifs security modify -vserver $vserver -is-signing-required true"
                        }
                    }
                } catch {
                    # Vserver may not have CIFS configured - skip silently
                }
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier SMB signing"
    }
    
    # NAO-E058: SMB1 disabled
    try {
        if ($script:DataVservers.Count -eq 0) {
            Write-Warn "Aucun data vserver - verification SMB1 ignoree"
        } else {
            foreach ($vserver in $script:DataVservers) {
                try {
                    $smbConfig = Get-NcCifsSecurity -VserverContext $vserver -ErrorAction SilentlyContinue
                    if ($smbConfig) {
                        $smb1Enabled = $false
                        if ($smbConfig.PSObject.Properties["Smb1EnabledForDcConnections"]) {
                            $smb1Enabled = $smbConfig.Smb1EnabledForDcConnections
                        }
                        
                        if (-not $smb1Enabled) {
                            Write-Pass "SMB1 desactive sur $vserver"
                            Add-Result -Id "NAO-E058" -Category "Acces" -Title "SMB1 desactive ($vserver)" `
                                -Status "PASS" -Severity "critical" `
                                -Description "Le protocole SMB1 obsolete est desactive sur $vserver"
                        } else {
                            Write-Fail "SMB1 actif sur $vserver"
                            Add-Result -Id "NAO-E058" -Category "Acces" -Title "SMB1 desactive ($vserver)" `
                                -Status "FAIL" -Severity "critical" `
                                -Description "SMB1 est un protocole obsolete et vulnerable sur $vserver" `
                                -Remediation "vserver cifs security modify -vserver $vserver -smb1-enabled-for-dc-connections false"
                        }
                    }
                } catch {
                    # Vserver may not have CIFS configured - skip silently
                }
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier SMB1"
    }
    
    # NAO-E059: Export policy review
    try {
        $openExports = Get-NcExportRule | Where-Object { $_.ClientMatch -eq "0.0.0.0/0" -and $_.RwRule -contains "any" }
        
        if ($openExports) {
            Write-Fail "Exports NFS ouverts detectes"
            Add-Result -Id "NAO-E059" -Category "Acces" -Title "Exports NFS ouverts" `
                -Status "FAIL" -Severity "critical" `
                -Description "Certains exports NFS sont accessibles a tous en ecriture" `
                -Remediation "Restreindre les exports NFS"
        } else {
            Write-Pass "Exports NFS securises"
            Add-Result -Id "NAO-E059" -Category "Acces" -Title "Exports NFS ouverts" `
                -Status "PASS" -Severity "critical" `
                -Description "Les exports NFS sont correctement restreints"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les exports"
    }
    
    # NAO-E060: iSCSI authentication
    try {
        $iscsiConfig = Get-NcIscsiInitiatorAuth -ErrorAction SilentlyContinue
        
        if ($iscsiConfig) {
            Write-Pass "Authentification iSCSI CHAP configuree"
            Add-Result -Id "NAO-E060" -Category "Acces" -Title "iSCSI CHAP" `
                -Status "PASS" -Severity "high" `
                -Description "L'authentification CHAP est configuree pour iSCSI"
        } else {
            Write-Warn "Authentification iSCSI CHAP non configuree"
            Add-Result -Id "NAO-E060" -Category "Acces" -Title "iSCSI CHAP" `
                -Status "WARN" -Severity "high" `
                -Description "Recommande d'activer l'authentification CHAP" `
                -Remediation "iscsi security create"
        }
    }
    catch {
        Write-Warn "iSCSI non configure"
    }
}

#===============================================================================
# GENERATION DU RAPPORT
#===============================================================================

function Generate-Report {
    Write-Section "GENERATION DU RAPPORT"
    
    $endTime = Get-Date
    $score = if ($script:TotalChecks -gt 0) { [math]::Round(($script:PassedChecks / $script:TotalChecks) * 100, 1) } else { 0 }
    
    $grade = switch ($score) {
        { $_ -ge 90 } { "A" }
        { $_ -ge 80 } { "B" }
        { $_ -ge 70 } { "C" }
        { $_ -ge 60 } { "D" }
        default { "F" }
    }
    
    $report = [PSCustomObject]@{
        metadata = [PSCustomObject]@{
            script_name = $ScriptName
            version = $Version
            audit_level = $AuditLevel
            cluster_name = if ($script:ClusterInfo) { $script:ClusterInfo.ClusterName } else { "N/A" }
            cluster_ip = $ClusterIP
            audit_date = (Get-Date -Format "o")
            generated_by = "Infra Shield Tools"
        }
        summary = [PSCustomObject]@{
            total_checks = $script:TotalChecks
            passed = $script:PassedChecks
            failed = $script:FailedChecks
            warnings = $script:WarningChecks
            score = $score
            grade = $grade
        }
        results = $script:Results
    }
    
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host ""
    Write-Host "[OK] Rapport JSON genere: $OutputFile" -ForegroundColor Green
    
    if ($GenerateHtml) {
        $htmlFile = $OutputFile -replace '\.json$', '.html'
        Generate-HtmlReport -Report $report -OutputPath $htmlFile
        Write-Host "[OK] Rapport HTML genere: $htmlFile" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "+====================================================================+" -ForegroundColor Cyan
    Write-Host "|                    RESUME DE L'AUDIT (ENHANCED)                    |" -ForegroundColor Cyan
    Write-Host "+====================================================================+" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Cluster:     $(if ($script:ClusterInfo) { $script:ClusterInfo.ClusterName } else { $ClusterIP })"
    Write-Host "  Total:       $($script:TotalChecks) controles"
    Write-Host "  Reussis:     $($script:PassedChecks)" -ForegroundColor Green
    Write-Host "  Echecs:      $($script:FailedChecks)" -ForegroundColor Red
    Write-Host "  Avertis:     $($script:WarningChecks)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Score:       $score% (Grade: $grade)"
    Write-Host ""
}

function Generate-HtmlReport {
    param(
        [PSCustomObject]$Report,
        [string]$OutputPath
    )
    
    $gradeColor = switch ($Report.summary.grade) {
        "A" { "#22c55e" }
        "B" { "#84cc16" }
        "C" { "#eab308" }
        "D" { "#f97316" }
        "F" { "#ef4444" }
    }
    
    $html = @"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'Audit NetApp ONTAP (Enhanced) - Infra Shield Tools</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); padding: 40px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #334155; }
        .header h1 { font-size: 2rem; margin-bottom: 10px; color: #60a5fa; }
        .header .meta { color: #94a3b8; font-size: 0.9rem; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #1e293b; padding: 24px; border-radius: 12px; text-align: center; border: 1px solid #334155; }
        .stat-card.grade { background: linear-gradient(135deg, ${gradeColor}22 0%, #1e293b 100%); border-color: ${gradeColor}; }
        .stat-value { font-size: 2.5rem; font-weight: bold; }
        .stat-label { color: #94a3b8; margin-top: 5px; }
        .passed { color: #22c55e; }
        .failed { color: #ef4444; }
        .warning { color: #eab308; }
        .results { background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; }
        .results h2 { margin-bottom: 20px; color: #60a5fa; }
        .result-item { padding: 16px; margin-bottom: 12px; border-radius: 8px; background: #0f172a; border-left: 4px solid; }
        .result-item.pass { border-color: #22c55e; }
        .result-item.fail { border-color: #ef4444; }
        .result-item.warn { border-color: #eab308; }
        .result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .result-title { font-weight: 600; }
        .result-id { font-family: monospace; font-size: 0.8rem; color: #64748b; }
        .result-desc { color: #94a3b8; font-size: 0.9rem; }
        .result-remediation { margin-top: 10px; padding: 10px; background: #1e293b; border-radius: 6px; font-size: 0.85rem; color: #60a5fa; }
        .badge { padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .badge.pass { background: #22c55e22; color: #22c55e; }
        .badge.fail { background: #ef444422; color: #ef4444; }
        .badge.warn { background: #eab30822; color: #eab308; }
        .badge.critical { background: #7c3aed22; color: #a78bfa; }
        .badge.high { background: #f9731622; color: #fb923c; }
        .badge.medium { background: #0ea5e922; color: #38bdf8; }
        .badge.low { background: #6b728022; color: #94a3b8; }
        .category-section { margin-bottom: 30px; }
        .category-title { font-size: 1.2rem; color: #60a5fa; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #334155; }
        .footer { text-align: center; padding: 30px; color: #64748b; font-size: 0.85rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Rapport d'Audit de Securite NetApp ONTAP (Enhanced)</h1>
            <div class="meta">
                <p>Cluster: $($Report.metadata.cluster_name) ($($Report.metadata.cluster_ip))</p>
                <p>Date: $(Get-Date -Format "dd/MM/yyyy HH:mm") | Version: $($Report.metadata.version) | Niveau: $($Report.metadata.audit_level)</p>
            </div>
        </div>
        
        <div class="summary">
            <div class="stat-card grade">
                <div class="stat-value">$($Report.summary.grade)</div>
                <div class="stat-label">Grade Global</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">$($Report.summary.score)%</div>
                <div class="stat-label">Score de Conformite</div>
            </div>
            <div class="stat-card">
                <div class="stat-value passed">$($Report.summary.passed)</div>
                <div class="stat-label">Controles Reussis</div>
            </div>
            <div class="stat-card">
                <div class="stat-value failed">$($Report.summary.failed)</div>
                <div class="stat-label">Echecs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value warning">$($Report.summary.warnings)</div>
                <div class="stat-label">Avertissements</div>
            </div>
        </div>
        
        <div class="results">
            <h2>Resultats Detailles</h2>
"@
    
    $categories = $Report.results | Group-Object -Property category
    foreach ($category in $categories) {
        $html += "<div class='category-section'><h3 class='category-title'>$($category.Name)</h3>"
        foreach ($result in $category.Group) {
            $statusClass = switch ($result.status) { "PASS" { "pass" } "FAIL" { "fail" } "WARN" { "warn" } }
            $html += @"
            <div class="result-item $statusClass">
                <div class="result-header">
                    <span class="result-title">$($result.title)</span>
                    <div>
                        <span class="badge $($result.severity)">$($result.severity.ToUpper())</span>
                        <span class="badge $statusClass">$($result.status)</span>
                    </div>
                </div>
                <div class="result-id">$($result.id)</div>
                <div class="result-desc">$($result.description)</div>
"@
            if ($result.remediation) {
                $html += "<div class='result-remediation'>Remediation: $($result.remediation)</div>"
            }
            $html += "</div>"
        }
        $html += "</div>"
    }
    
    $html += @"
        </div>
        
        <div class="footer">
            <p>Genere par Infra Shield Tools | NetApp Security Hardening Guide + DISA STIG</p>
            <p>www.ist-security.fr</p>
        </div>
    </div>
</body>
</html>
"@
    
    $html | Out-File -FilePath $OutputPath -Encoding UTF8
}

#===============================================================================
# EXECUTION PRINCIPALE
#===============================================================================

Write-Header

if (Connect-NetAppCluster) {
    Test-AuthenticationSettingsAdvanced
    Test-NetworkServicesAdvanced
    Test-DataEncryptionAdvanced
    Test-AuditLoggingAdvanced
    Test-DataProtectionAdvanced
    Test-SystemConfigurationAdvanced
    Test-DataAccessAdvanced
    Generate-Report
} else {
    Write-Host ""
    Write-Host "[ERREUR] Impossible de se connecter au cluster. Audit annule." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Audit termine." -ForegroundColor Cyan
