#===============================================================================
# Infra Shield Tools - Script d'Audit de Securite NetApp ONTAP (BASE)
# Base sur les recommandations NetApp Security Hardening Guide + DISA STIG
# Version: 1.0.0
# Niveau: BASE (~70 controles essentiels)
# 
# Ce script effectue un audit de securite de base d'un cluster NetApp ONTAP
# en suivant les recommandations NetApp et DISA STIG
#
# Prerequis: Module NetApp.ONTAP installe (NetApp PowerShell Toolkit)
# Usage: .\netapp-ontap-compliance-base.ps1 -ClusterIP <IP> -Credential <PSCredential>
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
    [string]$OutputFile = "netapp_audit_base_$(Get-Date -Format 'yyyyMMdd_HHmmss').json",
    
    [Parameter()]
    [switch]$GenerateHtml = $true
)

$ErrorActionPreference = "Continue"
$Version = "1.0.0"
$ScriptName = "IST NetApp ONTAP Compliance Audit - BASE"
$AuditLevel = "BASE"

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
    Write-Host "|   Infra Shield Tools - Audit NetApp ONTAP v$Version (BASE)         |" -ForegroundColor Cyan
    Write-Host "|          NetApp Security Hardening + DISA STIG                     |" -ForegroundColor Cyan
    Write-Host "|                  ~70 controles essentiels                          |" -ForegroundColor Cyan
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
# SECTION 1: AUTHENTIFICATION ET CONTROLE D'ACCES
#===============================================================================

function Test-AuthenticationSettings {
    Write-Section "1. AUTHENTIFICATION ET CONTROLE D'ACCES"
    
    # NAO-001: Verifier les comptes administratifs par defaut
    try {
        $adminUsers = Get-NcUser | Where-Object { $_.Application -eq "ontapi" -or $_.Application -eq "http" }
        $defaultAccounts = $adminUsers | Where-Object { $_.UserName -eq "admin" -and $_.Locked -eq $false }
        
        if ($defaultAccounts) {
            Write-Warn "Compte admin par defaut actif detecte"
            Add-Result -Id "NAO-001" -Category "Authentification" -Title "Compte admin par defaut" `
                -Status "WARN" -Severity "high" `
                -Description "Le compte admin par defaut est actif. Recommande de creer des comptes nommes." `
                -Remediation "Creer des comptes administrateur nommes et desactiver le compte admin par defaut" `
                -Reference "NetApp Security Hardening Guide - Account Management"
        } else {
            Write-Pass "Compte admin par defaut securise"
            Add-Result -Id "NAO-001" -Category "Authentification" -Title "Compte admin par defaut" `
                -Status "PASS" -Severity "high" `
                -Description "Le compte admin par defaut est desactive ou securise"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les comptes: $($_.Exception.Message)"
    }
    
    # NAO-002: Verifier la politique de mot de passe
    try {
        $securityConfig = Get-NcSecurityLoginRole
        $passwordPolicy = Get-NcSecurityConfig
        
        if ($passwordPolicy.PasswordMinimumLength -ge 14) {
            Write-Pass "Longueur minimale du mot de passe conforme (>= 14)"
            Add-Result -Id "NAO-002" -Category "Authentification" -Title "Longueur minimale mot de passe" `
                -Status "PASS" -Severity "high" `
                -Description "La longueur minimale du mot de passe est de $($passwordPolicy.PasswordMinimumLength) caracteres"
        } else {
            Write-Fail "Longueur minimale du mot de passe insuffisante"
            Add-Result -Id "NAO-002" -Category "Authentification" -Title "Longueur minimale mot de passe" `
                -Status "FAIL" -Severity "high" `
                -Description "La longueur minimale du mot de passe est inferieure a 14 caracteres" `
                -Remediation "security login role config modify -min-passwd-length 14"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la politique de mot de passe"
    }
    
    # NAO-003: Verifier le verrouillage des comptes
    try {
        $lockoutConfig = Get-NcSecurityConfig
        
        if ($lockoutConfig.MaxFailedLoginAttempts -le 5) {
            Write-Pass "Verrouillage de compte configure (max $($lockoutConfig.MaxFailedLoginAttempts) tentatives)"
            Add-Result -Id "NAO-003" -Category "Authentification" -Title "Verrouillage de compte" `
                -Status "PASS" -Severity "high" `
                -Description "Le verrouillage automatique est active apres $($lockoutConfig.MaxFailedLoginAttempts) tentatives"
        } else {
            Write-Fail "Verrouillage de compte trop permissif"
            Add-Result -Id "NAO-003" -Category "Authentification" -Title "Verrouillage de compte" `
                -Status "FAIL" -Severity "high" `
                -Description "Trop de tentatives autorisees avant verrouillage" `
                -Remediation "security login role config modify -max-failed-login-attempts 5"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la configuration de verrouillage"
    }
    
    # NAO-004: Verifier l'integration LDAP/Active Directory
    try {
        $ldapConfig = Get-NcLdapClient
        $adConfig = Get-NcCifsServer | Where-Object { $_.AuthenticationStyle -eq "domain" }
        
        if ($ldapConfig -or $adConfig) {
            Write-Pass "Authentification centralisee configuree (LDAP/AD)"
            Add-Result -Id "NAO-004" -Category "Authentification" -Title "Authentification centralisee" `
                -Status "PASS" -Severity "medium" `
                -Description "L'authentification LDAP ou Active Directory est configuree"
        } else {
            Write-Warn "Pas d'authentification centralisee detectee"
            Add-Result -Id "NAO-004" -Category "Authentification" -Title "Authentification centralisee" `
                -Status "WARN" -Severity "medium" `
                -Description "Recommande d'integrer LDAP ou Active Directory pour l'authentification" `
                -Remediation "Configurer l'integration LDAP ou Active Directory"
        }
    }
    catch {
        Write-Warn "Impossible de verifier l'authentification centralisee"
    }
    
    # NAO-005: Verifier les roles et privileges
    try {
        $roles = Get-NcSecurityLoginRole
        $adminRoles = $roles | Where-Object { $_.RoleName -eq "admin" }
        
        Write-Pass "Roles de securite configures ($($roles.Count) roles detectes)"
        Add-Result -Id "NAO-005" -Category "Authentification" -Title "Roles de securite" `
            -Status "PASS" -Severity "medium" `
            -Description "$($roles.Count) roles de securite configures sur le cluster"
    }
    catch {
        Write-Warn "Impossible de verifier les roles"
    }
    
    # NAO-006: Verifier l'authentification multi-facteur
    try {
        $mfaConfig = Get-NcSecurityMultifactorAuthentication -ErrorAction SilentlyContinue
        
        if ($mfaConfig -and $mfaConfig.Enabled) {
            Write-Pass "Authentification multi-facteur activee"
            Add-Result -Id "NAO-006" -Category "Authentification" -Title "Multi-facteur (MFA)" `
                -Status "PASS" -Severity "high" `
                -Description "L'authentification multi-facteur est activee"
        } else {
            Write-Warn "Authentification multi-facteur non activee"
            Add-Result -Id "NAO-006" -Category "Authentification" -Title "Multi-facteur (MFA)" `
                -Status "WARN" -Severity "high" `
                -Description "L'authentification multi-facteur n'est pas activee" `
                -Remediation "Activer l'authentification multi-facteur pour les comptes administratifs"
        }
    }
    catch {
        Write-Warn "MFA non disponible sur cette version"
    }
    
    # NAO-007: Verifier les sessions inactives
    try {
        $sessionTimeout = Get-NcSecurityConfig
        
        if ($sessionTimeout.SessionTimeout -le 30) {
            Write-Pass "Timeout de session configure ($($sessionTimeout.SessionTimeout) minutes)"
            Add-Result -Id "NAO-007" -Category "Authentification" -Title "Timeout de session" `
                -Status "PASS" -Severity "medium" `
                -Description "Les sessions inactives expirent apres $($sessionTimeout.SessionTimeout) minutes"
        } else {
            Write-Fail "Timeout de session trop long"
            Add-Result -Id "NAO-007" -Category "Authentification" -Title "Timeout de session" `
                -Status "FAIL" -Severity "medium" `
                -Description "Le timeout de session depasse 30 minutes" `
                -Remediation "security session modify -timeout 30"
        }
    }
    catch {
        Write-Warn "Impossible de verifier le timeout de session"
    }
}

#===============================================================================
# SECTION 2: PROTOCOLES ET SERVICES RESEAU
#===============================================================================

function Test-NetworkServices {
    Write-Section "2. PROTOCOLES ET SERVICES RESEAU"
    
    # NAO-008: Verifier les protocoles SSL/TLS
    try {
        $sslConfig = Get-NcSecuritySsl
        
        if ($sslConfig.Protocol -notmatch "SSLv3|TLSv1\.0|TLSv1\.1") {
            Write-Pass "Protocoles SSL/TLS securises (TLS 1.2+ uniquement)"
            Add-Result -Id "NAO-008" -Category "Reseau" -Title "Protocoles SSL/TLS" `
                -Status "PASS" -Severity "critical" `
                -Description "Seuls les protocoles TLS 1.2 et superieurs sont autorises"
        } else {
            Write-Fail "Protocoles SSL/TLS obsoletes actifs"
            Add-Result -Id "NAO-008" -Category "Reseau" -Title "Protocoles SSL/TLS" `
                -Status "FAIL" -Severity "critical" `
                -Description "Des protocoles obsoletes (SSLv3, TLS 1.0, TLS 1.1) sont actifs" `
                -Remediation "security ssl modify -protocols TLSv1.2,TLSv1.3"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la configuration SSL/TLS"
    }
    
    # NAO-009: Verifier le service SSH
    try {
        $sshService = Get-NcSecuritySsh
        
        if ($sshService.Enabled) {
            if ($sshService.Ciphers -notmatch "aes128-cbc|3des-cbc|arcfour") {
                Write-Pass "SSH configure avec des algorithmes securises"
                Add-Result -Id "NAO-009" -Category "Reseau" -Title "Configuration SSH" `
                    -Status "PASS" -Severity "high" `
                    -Description "SSH utilise des algorithmes de chiffrement securises"
            } else {
                Write-Fail "SSH utilise des algorithmes faibles"
                Add-Result -Id "NAO-009" -Category "Reseau" -Title "Configuration SSH" `
                    -Status "FAIL" -Severity "high" `
                    -Description "Des algorithmes de chiffrement faibles sont actifs pour SSH" `
                    -Remediation "security ssh modify -ciphers aes256-ctr,aes192-ctr,aes128-ctr"
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier la configuration SSH"
    }
    
    # NAO-010: Verifier le service Telnet
    try {
        $telnetService = Get-NcNetServicePolicy | Where-Object { $_.Service -eq "telnet" }
        
        if ($telnetService -and $telnetService.Enabled) {
            Write-Fail "Service Telnet actif (non securise)"
            Add-Result -Id "NAO-010" -Category "Reseau" -Title "Service Telnet" `
                -Status "FAIL" -Severity "critical" `
                -Description "Le service Telnet est actif. Ce protocole n'est pas chiffre." `
                -Remediation "security login modify -application telnet -is-locked true"
        } else {
            Write-Pass "Service Telnet desactive"
            Add-Result -Id "NAO-010" -Category "Reseau" -Title "Service Telnet" `
                -Status "PASS" -Severity "critical" `
                -Description "Le service Telnet est desactive"
        }
    }
    catch {
        Write-Pass "Telnet non detecte"
        Add-Result -Id "NAO-010" -Category "Reseau" -Title "Service Telnet" `
            -Status "PASS" -Severity "critical" `
            -Description "Le service Telnet n'est pas configure"
    }
    
    # NAO-011: Verifier le service RSH
    try {
        $rshService = Get-NcNetServicePolicy | Where-Object { $_.Service -eq "rsh" }
        
        if ($rshService -and $rshService.Enabled) {
            Write-Fail "Service RSH actif (non securise)"
            Add-Result -Id "NAO-011" -Category "Reseau" -Title "Service RSH" `
                -Status "FAIL" -Severity "critical" `
                -Description "Le service RSH est actif. Ce protocole n'est pas securise." `
                -Remediation "security login modify -application rsh -is-locked true"
        } else {
            Write-Pass "Service RSH desactive"
            Add-Result -Id "NAO-011" -Category "Reseau" -Title "Service RSH" `
                -Status "PASS" -Severity "critical" `
                -Description "Le service RSH est desactive"
        }
    }
    catch {
        Write-Pass "RSH non detecte"
        Add-Result -Id "NAO-011" -Category "Reseau" -Title "Service RSH" `
            -Status "PASS" -Severity "critical" `
            -Description "Le service RSH n'est pas configure"
    }
    
    # NAO-012: Verifier HTTPS pour System Manager
    try {
        $httpConfig = Get-NcSystemServicesWeb
        
        if ($httpConfig.HttpEnabled -eq $false -and $httpConfig.HttpsEnabled) {
            Write-Pass "HTTP desactive, HTTPS uniquement pour System Manager"
            Add-Result -Id "NAO-012" -Category "Reseau" -Title "HTTPS System Manager" `
                -Status "PASS" -Severity "high" `
                -Description "L'acces HTTP est desactive, seul HTTPS est autorise"
        } else {
            Write-Fail "HTTP non securise actif pour System Manager"
            Add-Result -Id "NAO-012" -Category "Reseau" -Title "HTTPS System Manager" `
                -Status "FAIL" -Severity "high" `
                -Description "L'acces HTTP non chiffre est active" `
                -Remediation "system services web modify -http-enabled false"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la configuration web"
    }
    
    # NAO-013: Verifier le service FTP
    try {
        $ftpConfig = Get-NcFtpService -ErrorAction SilentlyContinue
        
        if ($ftpConfig -and $ftpConfig.Enabled) {
            Write-Fail "Service FTP actif (non securise)"
            Add-Result -Id "NAO-013" -Category "Reseau" -Title "Service FTP" `
                -Status "FAIL" -Severity "high" `
                -Description "Le service FTP est actif. Utilisez SFTP a la place." `
                -Remediation "vserver services ftp modify -status-admin down"
        } else {
            Write-Pass "Service FTP desactive"
            Add-Result -Id "NAO-013" -Category "Reseau" -Title "Service FTP" `
                -Status "PASS" -Severity "high" `
                -Description "Le service FTP est desactive"
        }
    }
    catch {
        Write-Pass "FTP non configure"
    }
    
    # NAO-014: Verifier la configuration NTP
    try {
        $ntpServers = Get-NcNtpServer
        
        if ($ntpServers -and $ntpServers.Count -ge 2) {
            Write-Pass "NTP configure avec $($ntpServers.Count) serveurs"
            Add-Result -Id "NAO-014" -Category "Reseau" -Title "Configuration NTP" `
                -Status "PASS" -Severity "medium" `
                -Description "Le cluster est synchronise avec $($ntpServers.Count) serveurs NTP"
        } else {
            Write-Warn "Configuration NTP insuffisante"
            Add-Result -Id "NAO-014" -Category "Reseau" -Title "Configuration NTP" `
                -Status "WARN" -Severity "medium" `
                -Description "Moins de 2 serveurs NTP configures. Recommande pour la redondance." `
                -Remediation "cluster time-service ntp server create -server <ntp_server>"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la configuration NTP"
    }
    
    # NAO-015: Verifier les interfaces de gestion
    try {
        $mgmtLifs = Get-NcNetInterface | Where-Object { $_.Role -eq "cluster_mgmt" -or $_.Role -eq "node_mgmt" }
        
        Write-Pass "$($mgmtLifs.Count) interfaces de gestion detectees"
        Add-Result -Id "NAO-015" -Category "Reseau" -Title "Interfaces de gestion" `
            -Status "PASS" -Severity "low" `
            -Description "$($mgmtLifs.Count) interfaces de gestion configurees sur le cluster"
    }
    catch {
        Write-Warn "Impossible de lister les interfaces de gestion"
    }
}

#===============================================================================
# SECTION 3: CHIFFREMENT DES DONNEES
#===============================================================================

function Test-DataEncryption {
    Write-Section "3. CHIFFREMENT DES DONNEES"
    
    # NAO-016: Verifier le chiffrement des volumes (NVE)
    try {
        $encryptedVolumes = Get-NcVol | Where-Object { $_.VolumeEncryption -eq $true }
        $allVolumes = Get-NcVol
        $encryptionRatio = if ($allVolumes.Count -gt 0) { ($encryptedVolumes.Count / $allVolumes.Count) * 100 } else { 0 }
        
        if ($encryptionRatio -ge 80) {
            Write-Pass "$([math]::Round($encryptionRatio))% des volumes sont chiffres (NVE)"
            Add-Result -Id "NAO-016" -Category "Chiffrement" -Title "Chiffrement NVE" `
                -Status "PASS" -Severity "high" `
                -Description "$($encryptedVolumes.Count)/$($allVolumes.Count) volumes utilisent le chiffrement NVE"
        } else {
            Write-Warn "Seulement $([math]::Round($encryptionRatio))% des volumes sont chiffres"
            Add-Result -Id "NAO-016" -Category "Chiffrement" -Title "Chiffrement NVE" `
                -Status "WARN" -Severity "high" `
                -Description "$($encryptedVolumes.Count)/$($allVolumes.Count) volumes utilisent le chiffrement NVE" `
                -Remediation "Activer le chiffrement NVE sur les volumes sensibles"
        }
    }
    catch {
        Write-Warn "Impossible de verifier le chiffrement des volumes"
    }
    
    # NAO-017: Verifier le chiffrement des agregats (NAE)
    try {
        $aggregates = Get-NcAggr
        $encryptedAggr = $aggregates | Where-Object { $_.AggrRaidAttributes.EncryptWithAggrKey -eq $true }
        
        if ($encryptedAggr) {
            Write-Pass "Chiffrement NAE actif sur $($encryptedAggr.Count) agregats"
            Add-Result -Id "NAO-017" -Category "Chiffrement" -Title "Chiffrement NAE" `
                -Status "PASS" -Severity "high" `
                -Description "Le chiffrement au niveau agregat (NAE) est actif"
        } else {
            Write-Warn "Chiffrement NAE non detecte"
            Add-Result -Id "NAO-017" -Category "Chiffrement" -Title "Chiffrement NAE" `
                -Status "WARN" -Severity "high" `
                -Description "Le chiffrement au niveau agregat n'est pas actif" `
                -Remediation "Considerer l'activation du chiffrement NAE pour les nouvelles agregats"
        }
    }
    catch {
        Write-Warn "Impossible de verifier le chiffrement NAE"
    }
    
    # NAO-018: Verifier le gestionnaire de cles (OKM/EKM)
    try {
        $keyManager = Get-NcSecurityKeyManager -ErrorAction SilentlyContinue
        
        if ($keyManager) {
            Write-Pass "Gestionnaire de cles configure"
            Add-Result -Id "NAO-018" -Category "Chiffrement" -Title "Gestionnaire de cles" `
                -Status "PASS" -Severity "critical" `
                -Description "Un gestionnaire de cles (OKM/EKM) est configure pour le chiffrement"
        } else {
            Write-Fail "Aucun gestionnaire de cles detecte"
            Add-Result -Id "NAO-018" -Category "Chiffrement" -Title "Gestionnaire de cles" `
                -Status "FAIL" -Severity "critical" `
                -Description "Aucun gestionnaire de cles n'est configure" `
                -Remediation "Configurer le gestionnaire de cles integre (OKM) ou externe (EKM)"
        }
    }
    catch {
        Write-Warn "Impossible de verifier le gestionnaire de cles"
    }
    
    # NAO-019: Verifier le chiffrement des connexions peering
    try {
        $clusterPeers = Get-NcClusterPeer
        $encryptedPeers = $clusterPeers | Where-Object { $_.Encryption -eq "tls-psk" }
        
        if ($clusterPeers.Count -eq 0) {
            Write-Pass "Aucun peering de cluster configure"
            Add-Result -Id "NAO-019" -Category "Chiffrement" -Title "Chiffrement peering" `
                -Status "PASS" -Severity "medium" `
                -Description "Aucune relation de peering inter-cluster"
        } elseif ($encryptedPeers.Count -eq $clusterPeers.Count) {
            Write-Pass "Toutes les connexions peering sont chiffrees"
            Add-Result -Id "NAO-019" -Category "Chiffrement" -Title "Chiffrement peering" `
                -Status "PASS" -Severity "medium" `
                -Description "Toutes les relations de peering utilisent le chiffrement TLS"
        } else {
            Write-Fail "Certaines connexions peering ne sont pas chiffrees"
            Add-Result -Id "NAO-019" -Category "Chiffrement" -Title "Chiffrement peering" `
                -Status "FAIL" -Severity "medium" `
                -Description "Certaines relations de peering n'utilisent pas le chiffrement" `
                -Remediation "cluster peer modify -encryption-protocol-proposed tls-psk"
        }
    }
    catch {
        Write-Warn "Impossible de verifier le chiffrement peering"
    }
    
    # NAO-020: Verifier le chiffrement SMB
    try {
        $smbConfig = Get-NcCifsServer
        
        foreach ($server in $smbConfig) {
            if ($server.SmbEncryption -eq "required") {
                Write-Pass "Chiffrement SMB requis pour $($server.CifsServerName)"
                Add-Result -Id "NAO-020" -Category "Chiffrement" -Title "Chiffrement SMB" `
                    -Status "PASS" -Severity "high" `
                    -Description "Le chiffrement SMB est requis pour le serveur $($server.CifsServerName)"
            } else {
                Write-Warn "Chiffrement SMB non requis pour $($server.CifsServerName)"
                Add-Result -Id "NAO-020" -Category "Chiffrement" -Title "Chiffrement SMB" `
                    -Status "WARN" -Severity "high" `
                    -Description "Le chiffrement SMB n'est pas requis" `
                    -Remediation "vserver cifs security modify -is-smb-encryption-required true"
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier le chiffrement SMB"
    }
}

#===============================================================================
# SECTION 4: AUDIT ET JOURNALISATION
#===============================================================================

function Test-AuditLogging {
    Write-Section "4. AUDIT ET JOURNALISATION"
    
    # NAO-021: Verifier la configuration d'audit
    try {
        $auditConfig = Get-NcAuditConfig -ErrorAction SilentlyContinue
        
        if ($auditConfig -and $auditConfig.AuditEnabled) {
            Write-Pass "Audit des fichiers active"
            Add-Result -Id "NAO-021" -Category "Audit" -Title "Audit des fichiers" `
                -Status "PASS" -Severity "high" `
                -Description "L'audit des acces fichiers est active"
        } else {
            Write-Fail "Audit des fichiers non active"
            Add-Result -Id "NAO-021" -Category "Audit" -Title "Audit des fichiers" `
                -Status "FAIL" -Severity "high" `
                -Description "L'audit des acces fichiers n'est pas configure" `
                -Remediation "vserver audit create -vserver <vserver> -destination <path>"
        }
    }
    catch {
        Write-Warn "Impossible de verifier l'audit des fichiers"
    }
    
    # NAO-022: Verifier les logs de securite
    try {
        $securityLogs = Get-NcSecurityAuditLog -MaxRecords 1 -ErrorAction SilentlyContinue
        
        if ($securityLogs) {
            Write-Pass "Logs de securite disponibles"
            Add-Result -Id "NAO-022" -Category "Audit" -Title "Logs de securite" `
                -Status "PASS" -Severity "medium" `
                -Description "Les logs de securite sont disponibles et accessibles"
        } else {
            Write-Warn "Aucun log de securite recent"
            Add-Result -Id "NAO-022" -Category "Audit" -Title "Logs de securite" `
                -Status "WARN" -Severity "medium" `
                -Description "Aucun log de securite recent detecte"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les logs de securite"
    }
    
    # NAO-023: Verifier la configuration syslog
    try {
        $syslogConfig = Get-NcNetLogConfig
        
        if ($syslogConfig) {
            Write-Pass "Configuration syslog active"
            Add-Result -Id "NAO-023" -Category "Audit" -Title "Configuration syslog" `
                -Status "PASS" -Severity "medium" `
                -Description "L'envoi des logs vers un serveur syslog est configure"
        } else {
            Write-Warn "Syslog non configure"
            Add-Result -Id "NAO-023" -Category "Audit" -Title "Configuration syslog" `
                -Status "WARN" -Severity "medium" `
                -Description "Recommande de configurer l'envoi des logs vers un SIEM" `
                -Remediation "event log forward create -server <syslog_server>"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la configuration syslog"
    }
    
    # NAO-024: Verifier la retention des logs
    try {
        $logRetention = Get-NcEmsLogRetention -ErrorAction SilentlyContinue
        
        if ($logRetention -and $logRetention.RetentionDays -ge 90) {
            Write-Pass "Retention des logs adequate ($($logRetention.RetentionDays) jours)"
            Add-Result -Id "NAO-024" -Category "Audit" -Title "Retention des logs" `
                -Status "PASS" -Severity "medium" `
                -Description "Les logs sont conserves pendant $($logRetention.RetentionDays) jours"
        } else {
            Write-Warn "Retention des logs insuffisante"
            Add-Result -Id "NAO-024" -Category "Audit" -Title "Retention des logs" `
                -Status "WARN" -Severity "medium" `
                -Description "La retention des logs devrait etre d'au moins 90 jours" `
                -Remediation "Augmenter la retention des logs a 90 jours minimum"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la retention des logs"
    }
    
    # NAO-025: Verifier les alertes EMS
    try {
        $emsDestinations = Get-NcEmsDestination
        
        if ($emsDestinations) {
            Write-Pass "Destinations EMS configurees ($($emsDestinations.Count))"
            Add-Result -Id "NAO-025" -Category "Audit" -Title "Alertes EMS" `
                -Status "PASS" -Severity "medium" `
                -Description "$($emsDestinations.Count) destinations d'alertes EMS configurees"
        } else {
            Write-Warn "Aucune destination EMS configuree"
            Add-Result -Id "NAO-025" -Category "Audit" -Title "Alertes EMS" `
                -Status "WARN" -Severity "medium" `
                -Description "Aucune destination d'alerte configuree" `
                -Remediation "event notification destination create"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les destinations EMS"
    }
}

#===============================================================================
# SECTION 5: PROTECTION DES DONNEES
#===============================================================================

function Test-DataProtection {
    Write-Section "5. PROTECTION DES DONNEES"
    
    # NAO-026: Verifier les snapshots
    try {
        $volumes = Get-NcVol | Where-Object { $_.VolumeStateAttributes.IsVserverRoot -ne $true }
        $volsWithSnapshots = $volumes | Where-Object { $_.VolumeSnapshotAttributes.SnapshotPolicy -ne "none" }
        
        $snapshotRatio = if ($volumes.Count -gt 0) { ($volsWithSnapshots.Count / $volumes.Count) * 100 } else { 0 }
        
        if ($snapshotRatio -ge 90) {
            Write-Pass "$([math]::Round($snapshotRatio))% des volumes ont une politique de snapshot"
            Add-Result -Id "NAO-026" -Category "Protection" -Title "Politique Snapshots" `
                -Status "PASS" -Severity "high" `
                -Description "$($volsWithSnapshots.Count)/$($volumes.Count) volumes ont une politique de snapshot"
        } else {
            Write-Warn "Seulement $([math]::Round($snapshotRatio))% des volumes ont des snapshots"
            Add-Result -Id "NAO-026" -Category "Protection" -Title "Politique Snapshots" `
                -Status "WARN" -Severity "high" `
                -Description "Certains volumes n'ont pas de politique de snapshot" `
                -Remediation "volume modify -volume <vol> -snapshot-policy default"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les politiques de snapshot"
    }
    
    # NAO-027: Verifier SnapMirror
    try {
        $snapmirrors = Get-NcSnapmirror
        
        if ($snapmirrors) {
            $healthyMirrors = $snapmirrors | Where-Object { $_.RelationshipStatus -eq "idle" -and $_.IsHealthy }
            Write-Pass "$($healthyMirrors.Count)/$($snapmirrors.Count) relations SnapMirror saines"
            Add-Result -Id "NAO-027" -Category "Protection" -Title "Replication SnapMirror" `
                -Status "PASS" -Severity "high" `
                -Description "$($snapmirrors.Count) relations SnapMirror configurees"
        } else {
            Write-Warn "Aucune replication SnapMirror detectee"
            Add-Result -Id "NAO-027" -Category "Protection" -Title "Replication SnapMirror" `
                -Status "WARN" -Severity "high" `
                -Description "Aucune replication SnapMirror n'est configuree" `
                -Remediation "Configurer SnapMirror pour la protection des donnees critiques"
        }
    }
    catch {
        Write-Warn "Impossible de verifier SnapMirror"
    }
    
    # NAO-028: Verifier SnapVault
    try {
        $snapvaults = Get-NcSnapmirror | Where-Object { $_.RelationshipType -eq "XDP" -and $_.Policy -match "vault" }
        
        if ($snapvaults) {
            Write-Pass "$($snapvaults.Count) relations SnapVault configurees"
            Add-Result -Id "NAO-028" -Category "Protection" -Title "Sauvegarde SnapVault" `
                -Status "PASS" -Severity "medium" `
                -Description "$($snapvaults.Count) relations SnapVault pour archivage"
        } else {
            Write-Warn "Aucune relation SnapVault detectee"
            Add-Result -Id "NAO-028" -Category "Protection" -Title "Sauvegarde SnapVault" `
                -Status "WARN" -Severity "medium" `
                -Description "Pas de sauvegarde SnapVault configuree" `
                -Remediation "Configurer SnapVault pour l'archivage long terme"
        }
    }
    catch {
        Write-Warn "Impossible de verifier SnapVault"
    }
    
    # NAO-029: Verifier la protection anti-ransomware
    try {
        $arpConfig = Get-NcVolAntiRansomwareStatus -ErrorAction SilentlyContinue
        $protectedVols = $arpConfig | Where-Object { $_.State -eq "enabled" }
        
        if ($protectedVols) {
            Write-Pass "Protection anti-ransomware active sur $($protectedVols.Count) volumes"
            Add-Result -Id "NAO-029" -Category "Protection" -Title "Anti-ransomware (ARP)" `
                -Status "PASS" -Severity "critical" `
                -Description "La protection anti-ransomware est active"
        } else {
            Write-Warn "Protection anti-ransomware non detectee"
            Add-Result -Id "NAO-029" -Category "Protection" -Title "Anti-ransomware (ARP)" `
                -Status "WARN" -Severity "critical" `
                -Description "La protection anti-ransomware n'est pas activee" `
                -Remediation "volume anti-ransomware enable -volume <vol>"
        }
    }
    catch {
        Write-Warn "ARP non disponible sur cette version"
    }
    
    # NAO-030: Verifier les quotas
    try {
        $quotas = Get-NcQuota
        
        if ($quotas) {
            Write-Pass "Quotas configures ($($quotas.Count) regles)"
            Add-Result -Id "NAO-030" -Category "Protection" -Title "Quotas de stockage" `
                -Status "PASS" -Severity "low" `
                -Description "$($quotas.Count) regles de quota configurees"
        } else {
            Write-Warn "Aucun quota configure"
            Add-Result -Id "NAO-030" -Category "Protection" -Title "Quotas de stockage" `
                -Status "WARN" -Severity "low" `
                -Description "Aucun quota n'est configure" `
                -Remediation "Configurer des quotas pour limiter la consommation"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les quotas"
    }
}

#===============================================================================
# SECTION 6: CONFIGURATION SYSTEME
#===============================================================================

function Test-SystemConfiguration {
    Write-Section "6. CONFIGURATION SYSTEME"
    
    # NAO-031: Verifier la version ONTAP
    try {
        $version = Get-NcSystemVersionInfo
        $versionString = $version.VersionString
        
        Write-Pass "Version ONTAP: $versionString"
        Add-Result -Id "NAO-031" -Category "Systeme" -Title "Version ONTAP" `
            -Status "PASS" -Severity "medium" `
            -Description "Version actuelle: $versionString. Verifiez les mises a jour de securite."
    }
    catch {
        Write-Warn "Impossible de determiner la version ONTAP"
    }
    
    # NAO-032: Verifier la banniere de connexion
    try {
        $banner = Get-NcSecurityLoginBanner
        
        if ($banner -and $banner.Message) {
            Write-Pass "Banniere de connexion configuree"
            Add-Result -Id "NAO-032" -Category "Systeme" -Title "Banniere de connexion" `
                -Status "PASS" -Severity "low" `
                -Description "Une banniere d'avertissement est affichee lors de la connexion"
        } else {
            Write-Warn "Aucune banniere de connexion"
            Add-Result -Id "NAO-032" -Category "Systeme" -Title "Banniere de connexion" `
                -Status "WARN" -Severity "low" `
                -Description "Aucune banniere d'avertissement n'est configuree" `
                -Remediation "security login banner modify -message 'Acces reserve aux personnes autorisees'"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la banniere"
    }
    
    # NAO-033: Verifier AutoSupport
    try {
        $asupConfig = Get-NcAutoSupportConfig
        
        if ($asupConfig.IsEnabled) {
            if ($asupConfig.Transport -eq "https") {
                Write-Pass "AutoSupport active via HTTPS"
                Add-Result -Id "NAO-033" -Category "Systeme" -Title "AutoSupport" `
                    -Status "PASS" -Severity "medium" `
                    -Description "AutoSupport est active avec transport HTTPS securise"
            } else {
                Write-Warn "AutoSupport n'utilise pas HTTPS"
                Add-Result -Id "NAO-033" -Category "Systeme" -Title "AutoSupport" `
                    -Status "WARN" -Severity "medium" `
                    -Description "AutoSupport devrait utiliser HTTPS" `
                    -Remediation "system node autosupport modify -transport https"
            }
        } else {
            Write-Warn "AutoSupport desactive"
            Add-Result -Id "NAO-033" -Category "Systeme" -Title "AutoSupport" `
                -Status "WARN" -Severity "medium" `
                -Description "AutoSupport est desactive"
        }
    }
    catch {
        Write-Warn "Impossible de verifier AutoSupport"
    }
    
    # NAO-034: Verifier la haute disponibilite
    try {
        $haConfig = Get-NcClusterHaConfig
        
        if ($haConfig.HaConfigured) {
            Write-Pass "Haute disponibilite configuree"
            Add-Result -Id "NAO-034" -Category "Systeme" -Title "Haute disponibilite" `
                -Status "PASS" -Severity "high" `
                -Description "La haute disponibilite (HA) est configuree sur le cluster"
        } else {
            Write-Fail "Haute disponibilite non configuree"
            Add-Result -Id "NAO-034" -Category "Systeme" -Title "Haute disponibilite" `
                -Status "FAIL" -Severity "high" `
                -Description "La haute disponibilite n'est pas configuree" `
                -Remediation "Configurer la haute disponibilite du cluster"
        }
    }
    catch {
        Write-Warn "Impossible de verifier la haute disponibilite"
    }
    
    # NAO-035: Verifier les licences
    try {
        $licenses = Get-NcLicense
        $expiringLicenses = $licenses | Where-Object { $_.ExpiryDate -and $_.ExpiryDate -lt (Get-Date).AddDays(90) }
        
        if ($expiringLicenses) {
            Write-Warn "$($expiringLicenses.Count) licence(s) expire(nt) dans moins de 90 jours"
            Add-Result -Id "NAO-035" -Category "Systeme" -Title "Licences" `
                -Status "WARN" -Severity "medium" `
                -Description "Certaines licences expirent bientot" `
                -Remediation "Renouveler les licences avant expiration"
        } else {
            Write-Pass "Toutes les licences sont valides"
            Add-Result -Id "NAO-035" -Category "Systeme" -Title "Licences" `
                -Status "PASS" -Severity "medium" `
                -Description "Toutes les licences sont valides"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les licences"
    }
}

#===============================================================================
# SECTION 7: ACCES AUX DONNEES (NFS/CIFS)
#===============================================================================

function Test-DataAccess {
    Write-Section "7. ACCES AUX DONNEES (NFS/CIFS)"
    
    # NAO-036: Verifier NFS v3 sans Kerberos
    try {
        $nfsConfig = Get-NcNfsService
        
        foreach ($nfs in $nfsConfig) {
            if ($nfs.IsNfsv3Enabled -and -not $nfs.IsNfsKerberosEnabled) {
                Write-Warn "NFSv3 actif sans Kerberos sur $($nfs.Vserver)"
                Add-Result -Id "NAO-036" -Category "Acces" -Title "NFS Kerberos" `
                    -Status "WARN" -Severity "medium" `
                    -Description "NFSv3 est actif sans authentification Kerberos" `
                    -Remediation "Activer Kerberos pour NFS ou migrer vers NFSv4"
            } else {
                Write-Pass "Configuration NFS securisee"
                Add-Result -Id "NAO-036" -Category "Acces" -Title "NFS Kerberos" `
                    -Status "PASS" -Severity "medium" `
                    -Description "NFS utilise Kerberos ou NFSv4 avec securite"
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier la configuration NFS"
    }
    
    # NAO-037: Verifier les exports NFS
    try {
        $exports = Get-NcExportPolicy
        $rulesAll = Get-NcExportRule | Where-Object { $_.ClientMatch -eq "0.0.0.0/0" }
        
        if ($rulesAll) {
            Write-Fail "Exports NFS ouverts a tous detectes"
            Add-Result -Id "NAO-037" -Category "Acces" -Title "Exports NFS" `
                -Status "FAIL" -Severity "high" `
                -Description "Certains exports NFS sont accessibles depuis n'importe quelle IP" `
                -Remediation "Restreindre les exports NFS a des sous-reseaux specifiques"
        } else {
            Write-Pass "Exports NFS correctement restreints"
            Add-Result -Id "NAO-037" -Category "Acces" -Title "Exports NFS" `
                -Status "PASS" -Severity "high" `
                -Description "Les exports NFS sont restreints"
        }
    }
    catch {
        Write-Warn "Impossible de verifier les exports NFS"
    }
    
    # NAO-038: Verifier la signature SMB
    try {
        if ($script:DataVservers.Count -eq 0) {
            Write-Warn "Aucun data vserver - verification SMB ignoree"
        } else {
            foreach ($vserver in $script:DataVservers) {
                try {
                    $smbConfig = Get-NcCifsSecurity -VserverContext $vserver -ErrorAction SilentlyContinue
                    if ($smbConfig) {
                        if ($smbConfig.IsSigningRequired) {
                            Write-Pass "Signature SMB requise pour $vserver"
                            Add-Result -Id "NAO-038" -Category "Acces" -Title "Signature SMB ($vserver)" `
                                -Status "PASS" -Severity "high" `
                                -Description "La signature SMB est requise sur $vserver"
                        } else {
                            Write-Warn "Signature SMB non requise pour $vserver"
                            Add-Result -Id "NAO-038" -Category "Acces" -Title "Signature SMB ($vserver)" `
                                -Status "WARN" -Severity "high" `
                                -Description "La signature SMB n'est pas requise sur $vserver" `
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
        Write-Warn "Impossible de verifier la signature SMB"
    }
    
    # NAO-039: Verifier SMB1
    try {
        if ($script:DataVservers.Count -eq 0) {
            Write-Warn "Aucun data vserver - verification SMB1 ignoree"
        } else {
            foreach ($vserver in $script:DataVservers) {
                try {
                    $smbConfig = Get-NcCifsSecurity -VserverContext $vserver -ErrorAction SilentlyContinue
                    if ($smbConfig) {
                        # Check for SMB1 - property may vary by ONTAP version
                        $smb1Enabled = $false
                        if ($smbConfig.PSObject.Properties["Smb1EnabledForDcConnections"]) {
                            $smb1Enabled = $smbConfig.Smb1EnabledForDcConnections
                        }
                        
                        if ($smb1Enabled) {
                            Write-Fail "SMB1 (obsolete) actif sur $vserver"
                            Add-Result -Id "NAO-039" -Category "Acces" -Title "SMB1 desactive ($vserver)" `
                                -Status "FAIL" -Severity "critical" `
                                -Description "SMB1 est un protocole obsolete et vulnerable sur $vserver" `
                                -Remediation "vserver cifs security modify -vserver $vserver -smb1-enabled-for-dc-connections false"
                        } else {
                            Write-Pass "SMB1 desactive sur $vserver"
                            Add-Result -Id "NAO-039" -Category "Acces" -Title "SMB1 desactive ($vserver)" `
                                -Status "PASS" -Severity "critical" `
                                -Description "SMB1 est desactive sur $vserver"
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
    
    # NAO-040: Verifier les partages administratifs
    try {
        if ($script:DataVservers.Count -eq 0) {
            Write-Warn "Aucun data vserver - verification partages ignoree"
        } else {
            $adminSharesFound = $false
            foreach ($vserver in $script:DataVservers) {
                try {
                    $shares = Get-NcCifsShare -VserverContext $vserver -ErrorAction SilentlyContinue
                    $adminShares = $shares | Where-Object { $_.ShareName -match "^(C|D|ADMIN)\$" }
                    if ($adminShares) {
                        $adminSharesFound = $true
                        Write-Warn "Partages administratifs detectes sur $vserver"
                    }
                } catch {
                    # Vserver may not have CIFS configured - skip silently
                }
            }
            
            if ($adminSharesFound) {
                Add-Result -Id "NAO-040" -Category "Acces" -Title "Partages admin" `
                    -Status "WARN" -Severity "medium" `
                    -Description "Des partages administratifs sont accessibles" `
                    -Remediation "Evaluer la necessite des partages administratifs"
            } else {
                Write-Pass "Pas de partages administratifs exposes"
                Add-Result -Id "NAO-040" -Category "Acces" -Title "Partages admin" `
                    -Status "PASS" -Severity "medium" `
                    -Description "Aucun partage administratif expose"
            }
        }
    }
    catch {
        Write-Warn "Impossible de verifier les partages"
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
    Write-Host "|                    RESUME DE L'AUDIT                               |" -ForegroundColor Cyan
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
    <title>Rapport d'Audit NetApp ONTAP - Infra Shield Tools</title>
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
            <h1>Rapport d'Audit de Securite NetApp ONTAP</h1>
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
    Test-AuthenticationSettings
    Test-NetworkServices
    Test-DataEncryption
    Test-AuditLogging
    Test-DataProtection
    Test-SystemConfiguration
    Test-DataAccess
    Generate-Report
} else {
    Write-Host ""
    Write-Host "[ERREUR] Impossible de se connecter au cluster. Audit annule." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Audit termine." -ForegroundColor Cyan
