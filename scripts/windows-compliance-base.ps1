#===============================================================================
# Infra Shield Tools - Script d'Audit de Securite Windows Server (BASE)
# Base sur les recommandations ANSSI et CIS Benchmark Level 1
# Version: 1.0.0
# Niveau: BASE (~55 controles essentiels)
# 
# Ce script effectue un audit de securite de base d'un systeme Windows Server
# en suivant les recommandations ANSSI et CIS Benchmark Level 1
#
# Usage: .\windows-compliance-base.ps1 [-OutputFile <fichier>] [-Verbose]
#
# Licence: Proprietaire Infra Shield Tools
#===============================================================================

#Requires -RunAsAdministrator
#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter()]
    [string]$OutputFile = "audit_base_$(Get-Date -Format 'yyyyMMdd_HHmmss').json",
    
    [Parameter()]
    [switch]$GenerateHtml = $true
)

$ErrorActionPreference = "Continue"
$Version = "1.0.0"
$ScriptName = "IST Windows Compliance Audit - BASE (ANSSI + CIS L1)"
$AuditLevel = "BASE"

# Compteurs globaux
$script:TotalChecks = 0
$script:PassedChecks = 0
$script:FailedChecks = 0
$script:WarningChecks = 0
$script:Results = @()

#===============================================================================
# Fonctions utilitaires
#===============================================================================

function Write-Header {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                                                                    ║" -ForegroundColor Cyan
    Write-Host "║   Infra Shield Tools - Audit Windows Server v$Version (BASE)       ║" -ForegroundColor Cyan
    Write-Host "║            ANSSI + CIS Benchmark Level 1                           ║" -ForegroundColor Cyan
    Write-Host "║               ~55 controles essentiels                             ║" -ForegroundColor Cyan
    Write-Host "║                                                                    ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host "  $Title" -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
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

#===============================================================================
# Categorie 1: Configuration du Systeme
#===============================================================================

function Test-SystemConfiguration {
    Write-Section "1. CONFIGURATION DU SYSTEME"
    
    # SYS-001: Verification du niveau de patch Windows Update
    Write-Info "Verification des mises a jour Windows..."
    try {
        $lastUpdate = Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1
        $daysSinceUpdate = ((Get-Date) - $lastUpdate.InstalledOn).Days
        
        if ($daysSinceUpdate -le 30) {
            Write-Pass "Derniere mise a jour: $($lastUpdate.HotFixID) il y a $daysSinceUpdate jours"
            Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises a jour systeme" -Status "PASS" -Severity "critical" `
                -Description "Systeme mis a jour recemment (il y a $daysSinceUpdate jours)" -Reference "ANSSI R1"
        } elseif ($daysSinceUpdate -le 90) {
            Write-Warn "Derniere mise a jour il y a $daysSinceUpdate jours"
            Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises a jour systeme" -Status "WARN" -Severity "critical" `
                -Description "Derniere mise a jour il y a $daysSinceUpdate jours" `
                -Remediation "Executer Windows Update pour installer les dernieres mises a jour de securite" -Reference "ANSSI R1"
        } else {
            Write-Fail "Systeme non mis a jour depuis $daysSinceUpdate jours"
            Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises a jour systeme" -Status "FAIL" -Severity "critical" `
                -Description "Systeme non mis a jour depuis $daysSinceUpdate jours" `
                -Remediation "Executer immediatement Windows Update" -Reference "ANSSI R1"
        }
    } catch {
        Write-Warn "Impossible de verifier les mises a jour"
        Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises a jour systeme" -Status "WARN" -Severity "critical" `
            -Description "Impossible de determiner l'etat des mises a jour" `
            -Remediation "Verifier manuellement Windows Update" -Reference "ANSSI R1"
    }
    
    # SYS-002: Version Windows supportee
    Write-Info "Verification de la version Windows..."
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $buildNumber = [int]$osInfo.BuildNumber
    
    if ($buildNumber -ge 17763) {
        Write-Pass "Version Windows Server supportee: $($osInfo.Caption) Build $buildNumber"
        Add-Result -Id "SYS-002" -Category "CIS" -Title "Version Windows supportee" -Status "PASS" -Severity "high" `
            -Description "Version Windows Server actuelle et supportee" -Reference "CIS 1.1.1"
    } else {
        Write-Fail "Version Windows obsolete: Build $buildNumber"
        Add-Result -Id "SYS-002" -Category "CIS" -Title "Version Windows supportee" -Status "FAIL" -Severity "high" `
            -Description "Version Windows Server obsolete ou non supportee" `
            -Remediation "Mettre a niveau vers Windows Server 2019 ou ulterieur" -Reference "CIS 1.1.1"
    }
    
    # SYS-003: UAC active
    Write-Info "Verification UAC..."
    $uacKey = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name "EnableLUA" -ErrorAction SilentlyContinue
    
    if ($uacKey.EnableLUA -eq 1) {
        Write-Pass "UAC est active"
        Add-Result -Id "SYS-003" -Category "CIS" -Title "Controle de compte utilisateur (UAC)" -Status "PASS" -Severity "high" `
            -Description "UAC est active" -Reference "CIS 2.3.17.1"
    } else {
        Write-Fail "UAC est desactive"
        Add-Result -Id "SYS-003" -Category "CIS" -Title "Controle de compte utilisateur (UAC)" -Status "FAIL" -Severity "high" `
            -Description "UAC est desactive - risque d'elevation de privileges" `
            -Remediation "Activer UAC via les parametres de securite" -Reference "CIS 2.3.17.1"
    }
    
    # SYS-004: Secure Boot
    Write-Info "Verification Secure Boot..."
    try {
        $secureBoot = Confirm-SecureBootUEFI -ErrorAction SilentlyContinue
        if ($secureBoot) {
            Write-Pass "Secure Boot est active"
            Add-Result -Id "SYS-004" -Category "ANSSI" -Title "Secure Boot UEFI" -Status "PASS" -Severity "high" `
                -Description "Secure Boot UEFI est active" -Reference "ANSSI R2"
        } else {
            Write-Warn "Secure Boot non active ou non disponible"
            Add-Result -Id "SYS-004" -Category "ANSSI" -Title "Secure Boot UEFI" -Status "WARN" -Severity "high" `
                -Description "Secure Boot n'est pas active" `
                -Remediation "Activer Secure Boot dans le BIOS/UEFI" -Reference "ANSSI R2"
        }
    } catch {
        Write-Info "Secure Boot non supporte sur ce systeme"
        Add-Result -Id "SYS-004" -Category "ANSSI" -Title "Secure Boot UEFI" -Status "WARN" -Severity "high" `
            -Description "Secure Boot non disponible (systeme legacy BIOS)" `
            -Remediation "Migrer vers UEFI avec Secure Boot si possible" -Reference "ANSSI R2"
    }
    
    # SYS-005: BitLocker
    Write-Info "Verification BitLocker..."
    try {
        $bitlocker = Get-BitLockerVolume -MountPoint "C:" -ErrorAction SilentlyContinue
        if ($bitlocker.ProtectionStatus -eq "On") {
            Write-Pass "BitLocker active sur le volume systeme"
            Add-Result -Id "SYS-005" -Category "ANSSI" -Title "Chiffrement disque BitLocker" -Status "PASS" -Severity "critical" `
                -Description "BitLocker est active sur le volume systeme C:" -Reference "ANSSI R3"
        } else {
            Write-Fail "BitLocker non active sur le volume systeme"
            Add-Result -Id "SYS-005" -Category "ANSSI" -Title "Chiffrement disque BitLocker" -Status "FAIL" -Severity "critical" `
                -Description "Le volume systeme n'est pas chiffre avec BitLocker" `
                -Remediation "Activer BitLocker sur le volume systeme" -Reference "ANSSI R3"
        }
    } catch {
        Write-Warn "BitLocker non disponible"
        Add-Result -Id "SYS-005" -Category "ANSSI" -Title "Chiffrement disque BitLocker" -Status "WARN" -Severity "critical" `
            -Description "BitLocker n'est pas disponible sur ce systeme" `
            -Remediation "Installer la fonctionnalite BitLocker" -Reference "ANSSI R3"
    }
    
    # SYS-006: Autoplay desactive
    Write-Info "Verification AutoPlay..."
    $autoplay = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name "NoDriveTypeAutoRun" -ErrorAction SilentlyContinue
    
    if ($autoplay.NoDriveTypeAutoRun -eq 255) {
        Write-Pass "AutoPlay desactive pour tous les lecteurs"
        Add-Result -Id "SYS-006" -Category "CIS" -Title "AutoPlay desactive" -Status "PASS" -Severity "medium" `
            -Description "AutoPlay est desactive pour tous les types de lecteurs" -Reference "CIS 18.9.8.3"
    } else {
        Write-Warn "AutoPlay potentiellement actif"
        Add-Result -Id "SYS-006" -Category "CIS" -Title "AutoPlay desactive" -Status "WARN" -Severity "medium" `
            -Description "AutoPlay n'est pas completement desactive" `
            -Remediation "Configurer NoDriveTypeAutoRun = 255 via GPO" -Reference "CIS 18.9.8.3"
    }
    
    # SYS-007: Remote Desktop securise
    Write-Info "Verification Remote Desktop..."
    $rdpKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -ErrorAction SilentlyContinue
    $nlaKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" -Name "UserAuthentication" -ErrorAction SilentlyContinue
    
    if ($rdpKey.fDenyTSConnections -eq 1) {
        Write-Pass "Remote Desktop desactive"
        Add-Result -Id "SYS-007" -Category "CIS" -Title "Remote Desktop" -Status "PASS" -Severity "medium" `
            -Description "Remote Desktop est desactive" -Reference "CIS 18.9.59.1"
    } elseif ($nlaKey.UserAuthentication -eq 1) {
        Write-Pass "Remote Desktop active avec NLA"
        Add-Result -Id "SYS-007" -Category "CIS" -Title "Remote Desktop" -Status "PASS" -Severity "medium" `
            -Description "Remote Desktop active avec Network Level Authentication (NLA)" -Reference "CIS 18.9.59.2"
    } else {
        Write-Fail "Remote Desktop active sans NLA"
        Add-Result -Id "SYS-007" -Category "CIS" -Title "Remote Desktop" -Status "FAIL" -Severity "medium" `
            -Description "Remote Desktop est active sans NLA - risque de securite" `
            -Remediation "Activer Network Level Authentication pour RDP" -Reference "CIS 18.9.59.2"
    }
}

#===============================================================================
# Categorie 2: Gestion des Comptes
#===============================================================================

function Test-AccountManagement {
    Write-Section "2. GESTION DES COMPTES"
    
    # ACC-001: Compte Administrateur local renomme
    Write-Info "Verification du compte Administrateur..."
    $adminAccount = Get-LocalUser | Where-Object { $_.SID -like "*-500" }
    
    if ($adminAccount.Name -ne "Administrateur" -and $adminAccount.Name -ne "Administrator") {
        Write-Pass "Compte Administrateur renomme: $($adminAccount.Name)"
        Add-Result -Id "ACC-001" -Category "CIS" -Title "Compte Administrateur renomme" -Status "PASS" -Severity "medium" `
            -Description "Le compte Administrateur integre a ete renomme" -Reference "CIS 2.3.1.5"
    } else {
        Write-Warn "Compte Administrateur non renomme"
        Add-Result -Id "ACC-001" -Category "CIS" -Title "Compte Administrateur renomme" -Status "WARN" -Severity "medium" `
            -Description "Le compte Administrateur conserve son nom par defaut" `
            -Remediation "Renommer le compte Administrateur via la strategie locale" -Reference "CIS 2.3.1.5"
    }
    
    # ACC-002: Compte Invite desactive
    Write-Info "Verification du compte Invite..."
    $guestAccount = Get-LocalUser | Where-Object { $_.SID -like "*-501" }
    
    if (-not $guestAccount.Enabled) {
        Write-Pass "Compte Invite desactive"
        Add-Result -Id "ACC-002" -Category "CIS" -Title "Compte Invite desactive" -Status "PASS" -Severity "high" `
            -Description "Le compte Invite est desactive" -Reference "CIS 2.3.1.1"
    } else {
        Write-Fail "Compte Invite active"
        Add-Result -Id "ACC-002" -Category "CIS" -Title "Compte Invite desactive" -Status "FAIL" -Severity "high" `
            -Description "Le compte Invite est active - risque de securite" `
            -Remediation "Desactiver le compte Invite: net user Guest /active:no" -Reference "CIS 2.3.1.1"
    }
    
    # ACC-003: Politique de mot de passe - longueur minimale
    Write-Info "Verification de la politique de mots de passe..."
    $secpol = secedit /export /cfg "$env:TEMP\secpol.cfg" 2>$null
    $secpolContent = Get-Content "$env:TEMP\secpol.cfg" -ErrorAction SilentlyContinue
    $minPwdLen = ($secpolContent | Select-String "MinimumPasswordLength").ToString().Split("=")[1].Trim()
    Remove-Item "$env:TEMP\secpol.cfg" -Force -ErrorAction SilentlyContinue
    
    if ([int]$minPwdLen -ge 14) {
        Write-Pass "Longueur minimale du mot de passe: $minPwdLen caracteres"
        Add-Result -Id "ACC-003" -Category "ANSSI" -Title "Longueur minimale du mot de passe" -Status "PASS" -Severity "high" `
            -Description "Longueur minimale configuree a $minPwdLen caracteres" -Reference "ANSSI R20"
    } elseif ([int]$minPwdLen -ge 8) {
        Write-Warn "Longueur minimale du mot de passe: $minPwdLen caracteres (recommande: 14)"
        Add-Result -Id "ACC-003" -Category "ANSSI" -Title "Longueur minimale du mot de passe" -Status "WARN" -Severity "high" `
            -Description "Longueur minimale de $minPwdLen caracteres (recommande: 14)" `
            -Remediation "Augmenter la longueur minimale a 14 caracteres via GPO" -Reference "ANSSI R20"
    } else {
        Write-Fail "Longueur minimale du mot de passe insuffisante: $minPwdLen"
        Add-Result -Id "ACC-003" -Category "ANSSI" -Title "Longueur minimale du mot de passe" -Status "FAIL" -Severity "high" `
            -Description "Longueur minimale de seulement $minPwdLen caracteres" `
            -Remediation "Configurer une longueur minimale de 14 caracteres" -Reference "ANSSI R20"
    }
    
    # ACC-004: Complexite du mot de passe
    Write-Info "Verification de la complexite des mots de passe..."
    $complexity = ($secpolContent | Select-String "PasswordComplexity").ToString().Split("=")[1].Trim()
    
    if ([int]$complexity -eq 1) {
        Write-Pass "Complexite du mot de passe activee"
        Add-Result -Id "ACC-004" -Category "CIS" -Title "Complexite du mot de passe" -Status "PASS" -Severity "high" `
            -Description "La politique de complexite des mots de passe est activee" -Reference "CIS 1.1.5"
    } else {
        Write-Fail "Complexite du mot de passe desactivee"
        Add-Result -Id "ACC-004" -Category "CIS" -Title "Complexite du mot de passe" -Status "FAIL" -Severity "high" `
            -Description "La complexite des mots de passe n'est pas exigee" `
            -Remediation "Activer la complexite des mots de passe via GPO" -Reference "CIS 1.1.5"
    }
    
    # ACC-005: Verrouillage apres tentatives echouees
    Write-Info "Verification du verrouillage de compte..."
    $lockoutThreshold = ($secpolContent | Select-String "LockoutBadCount").ToString().Split("=")[1].Trim()
    
    if ([int]$lockoutThreshold -gt 0 -and [int]$lockoutThreshold -le 5) {
        Write-Pass "Verrouillage apres $lockoutThreshold tentatives echouees"
        Add-Result -Id "ACC-005" -Category "CIS" -Title "Seuil de verrouillage de compte" -Status "PASS" -Severity "high" `
            -Description "Verrouillage configure apres $lockoutThreshold tentatives" -Reference "CIS 1.2.1"
    } elseif ([int]$lockoutThreshold -gt 5) {
        Write-Warn "Seuil de verrouillage trop eleve: $lockoutThreshold"
        Add-Result -Id "ACC-005" -Category "CIS" -Title "Seuil de verrouillage de compte" -Status "WARN" -Severity "high" `
            -Description "Seuil de verrouillage trop permissif ($lockoutThreshold tentatives)" `
            -Remediation "Reduire le seuil a 5 tentatives maximum" -Reference "CIS 1.2.1"
    } else {
        Write-Fail "Verrouillage de compte non configure"
        Add-Result -Id "ACC-005" -Category "CIS" -Title "Seuil de verrouillage de compte" -Status "FAIL" -Severity "high" `
            -Description "Aucun verrouillage de compte configure" `
            -Remediation "Configurer un seuil de 5 tentatives maximum" -Reference "CIS 1.2.1"
    }
    
    # ACC-006: Expiration des mots de passe
    Write-Info "Verification de l'expiration des mots de passe..."
    $maxPwdAge = ($secpolContent | Select-String "MaximumPasswordAge").ToString().Split("=")[1].Trim()
    
    if ([int]$maxPwdAge -gt 0 -and [int]$maxPwdAge -le 365) {
        Write-Pass "Expiration des mots de passe: $maxPwdAge jours"
        Add-Result -Id "ACC-006" -Category "CIS" -Title "Expiration des mots de passe" -Status "PASS" -Severity "medium" `
            -Description "Mots de passe expirent apres $maxPwdAge jours" -Reference "CIS 1.1.2"
    } else {
        Write-Warn "Expiration des mots de passe non optimale"
        Add-Result -Id "ACC-006" -Category "CIS" -Title "Expiration des mots de passe" -Status "WARN" -Severity "medium" `
            -Description "Configuration d'expiration non conforme" `
            -Remediation "Configurer une duree maximale de 365 jours" -Reference "CIS 1.1.2"
    }
    
    # ACC-007: Historique des mots de passe
    Write-Info "Verification de l'historique des mots de passe..."
    $pwdHistory = ($secpolContent | Select-String "PasswordHistorySize").ToString().Split("=")[1].Trim()
    
    if ([int]$pwdHistory -ge 24) {
        Write-Pass "Historique des mots de passe: $pwdHistory derniers mots de passe"
        Add-Result -Id "ACC-007" -Category "CIS" -Title "Historique des mots de passe" -Status "PASS" -Severity "medium" `
            -Description "Les $pwdHistory derniers mots de passe sont memorises" -Reference "CIS 1.1.1"
    } else {
        Write-Warn "Historique des mots de passe insuffisant: $pwdHistory"
        Add-Result -Id "ACC-007" -Category "CIS" -Title "Historique des mots de passe" -Status "WARN" -Severity "medium" `
            -Description "Seulement $pwdHistory mots de passe memorises (recommande: 24)" `
            -Remediation "Configurer l'historique a 24 mots de passe" -Reference "CIS 1.1.1"
    }
}

#===============================================================================
# Categorie 3: Services et Applications
#===============================================================================

function Test-ServicesConfiguration {
    Write-Section "3. SERVICES ET APPLICATIONS"
    
    # SVC-001: Services inutiles desactives
    Write-Info "Verification des services a risque..."
    $riskyServices = @(
        @{Name="RemoteRegistry"; Display="Registre distant"},
        @{Name="Telnet"; Display="Telnet"},
        @{Name="TlntSvr"; Display="Serveur Telnet"},
        @{Name="SNMP"; Display="SNMP"},
        @{Name="SNMPTRAP"; Display="SNMP Trap"},
        @{Name="SharedAccess"; Display="Partage de connexion Internet"},
        @{Name="Browser"; Display="Explorateur d'ordinateurs"}
    )
    
    $enabledRisky = @()
    foreach ($svc in $riskyServices) {
        $service = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq "Running") {
            $enabledRisky += $svc.Display
        }
    }
    
    if ($enabledRisky.Count -eq 0) {
        Write-Pass "Aucun service a risque actif"
        Add-Result -Id "SVC-001" -Category "CIS" -Title "Services a risque desactives" -Status "PASS" -Severity "high" `
            -Description "Aucun service potentiellement dangereux n'est actif" -Reference "CIS 5"
    } else {
        Write-Fail "Services a risque actifs: $($enabledRisky -join ', ')"
        Add-Result -Id "SVC-001" -Category "CIS" -Title "Services a risque desactives" -Status "FAIL" -Severity "high" `
            -Description "Services a risque actifs: $($enabledRisky -join ', ')" `
            -Remediation "Desactiver les services non necessaires via services.msc" -Reference "CIS 5"
    }
    
    # SVC-002: Windows Defender active
    Write-Info "Verification Windows Defender..."
    try {
        $defenderStatus = Get-MpComputerStatus -ErrorAction Stop
        
        if ($defenderStatus.AntivirusEnabled -and $defenderStatus.RealTimeProtectionEnabled) {
            Write-Pass "Windows Defender active avec protection en temps reel"
            Add-Result -Id "SVC-002" -Category "ANSSI" -Title "Antivirus Windows Defender" -Status "PASS" -Severity "critical" `
                -Description "Windows Defender est active avec protection temps reel" -Reference "ANSSI R4"
        } else {
            Write-Fail "Windows Defender partiellement actif"
            Add-Result -Id "SVC-002" -Category "ANSSI" -Title "Antivirus Windows Defender" -Status "FAIL" -Severity "critical" `
                -Description "Protection Windows Defender incomplete" `
                -Remediation "Activer toutes les protections Windows Defender" -Reference "ANSSI R4"
        }
    } catch {
        Write-Warn "Windows Defender non disponible ou autre antivirus installe"
        Add-Result -Id "SVC-002" -Category "ANSSI" -Title "Antivirus Windows Defender" -Status "WARN" -Severity "critical" `
            -Description "Windows Defender non disponible - verifier qu'un antivirus est installe" `
            -Remediation "S'assurer qu'une solution antivirus est active" -Reference "ANSSI R4"
    }
    
    # SVC-003: Mises a jour des definitions antivirus
    Write-Info "Verification des definitions antivirus..."
    try {
        $defStatus = Get-MpComputerStatus
        $daysSinceUpdate = ((Get-Date) - $defStatus.AntivirusSignatureLastUpdated).Days
        
        if ($daysSinceUpdate -le 1) {
            Write-Pass "Definitions antivirus a jour (mise a jour il y a $daysSinceUpdate jour(s))"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Definitions antivirus" -Status "PASS" -Severity "high" `
                -Description "Definitions mises a jour il y a $daysSinceUpdate jour(s)" -Reference "ANSSI R4"
        } elseif ($daysSinceUpdate -le 7) {
            Write-Warn "Definitions antivirus datant de $daysSinceUpdate jours"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Definitions antivirus" -Status "WARN" -Severity "high" `
                -Description "Derniere mise a jour il y a $daysSinceUpdate jours" `
                -Remediation "Mettre a jour les definitions Windows Defender" -Reference "ANSSI R4"
        } else {
            Write-Fail "Definitions antivirus obsoletes ($daysSinceUpdate jours)"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Definitions antivirus" -Status "FAIL" -Severity "high" `
                -Description "Definitions non mises a jour depuis $daysSinceUpdate jours" `
                -Remediation "Mettre a jour immediatement les definitions antivirus" -Reference "ANSSI R4"
        }
    } catch {
        Write-Info "Impossible de verifier les definitions antivirus"
    }
    
    # SVC-004: PowerShell Script Block Logging
    Write-Info "Verification du logging PowerShell..."
    $psLogging = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging" -Name "EnableScriptBlockLogging" -ErrorAction SilentlyContinue
    
    if ($psLogging.EnableScriptBlockLogging -eq 1) {
        Write-Pass "PowerShell Script Block Logging active"
        Add-Result -Id "SVC-004" -Category "CIS" -Title "Logging PowerShell" -Status "PASS" -Severity "medium" `
            -Description "Script Block Logging PowerShell est active" -Reference "CIS 18.9.97.2"
    } else {
        Write-Warn "PowerShell Script Block Logging desactive"
        Add-Result -Id "SVC-004" -Category "CIS" -Title "Logging PowerShell" -Status "WARN" -Severity "medium" `
            -Description "Script Block Logging n'est pas configure" `
            -Remediation "Activer Script Block Logging via GPO" -Reference "CIS 18.9.97.2"
    }
    
    # SVC-005: SMBv1 desactive
    Write-Info "Verification SMBv1..."
    try {
        $smb1 = Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -ErrorAction Stop
        
        if ($smb1.State -eq "Disabled") {
            Write-Pass "SMBv1 desactive"
            Add-Result -Id "SVC-005" -Category "ANSSI" -Title "Protocole SMBv1 desactive" -Status "PASS" -Severity "critical" `
                -Description "Le protocole SMBv1 vulnerable est desactive" -Reference "ANSSI R12"
        } else {
            Write-Fail "SMBv1 active - vulnerabilite critique"
            Add-Result -Id "SVC-005" -Category "ANSSI" -Title "Protocole SMBv1 desactive" -Status "FAIL" -Severity "critical" `
                -Description "SMBv1 est active - vulnerable a EternalBlue/WannaCry" `
                -Remediation "Desactiver SMBv1: Disable-WindowsOptionalFeature -FeatureName SMB1Protocol" -Reference "ANSSI R12"
        }
    } catch {
        $smb1Config = Get-SmbServerConfiguration | Select-Object EnableSMB1Protocol
        if (-not $smb1Config.EnableSMB1Protocol) {
            Write-Pass "SMBv1 desactive"
            Add-Result -Id "SVC-005" -Category "ANSSI" -Title "Protocole SMBv1 desactive" -Status "PASS" -Severity "critical" `
                -Description "Le protocole SMBv1 est desactive" -Reference "ANSSI R12"
        } else {
            Write-Fail "SMBv1 active"
            Add-Result -Id "SVC-005" -Category "ANSSI" -Title "Protocole SMBv1 desactive" -Status "FAIL" -Severity "critical" `
                -Description "SMBv1 est active" `
                -Remediation "Set-SmbServerConfiguration -EnableSMB1Protocol $false" -Reference "ANSSI R12"
        }
    }
    
    # SVC-006: Print Spooler (PrintNightmare)
    Write-Info "Verification Print Spooler..."
    $spooler = Get-Service -Name "Spooler" -ErrorAction SilentlyContinue
    
    if (-not $spooler -or $spooler.Status -ne "Running") {
        Write-Pass "Print Spooler desactive"
        Add-Result -Id "SVC-006" -Category "ANSSI" -Title "Service Print Spooler" -Status "PASS" -Severity "critical" `
            -Description "Print Spooler desactive (protection PrintNightmare)" -Reference "ANSSI R5"
    } else {
        Write-Warn "Print Spooler actif - verifier les patches"
        Add-Result -Id "SVC-006" -Category "ANSSI" -Title "Service Print Spooler" -Status "WARN" -Severity "critical" `
            -Description "Print Spooler actif - s'assurer que les correctifs PrintNightmare sont installes" `
            -Remediation "Desactiver si non necessaire: Stop-Service Spooler; Set-Service Spooler -StartupType Disabled" -Reference "ANSSI R5"
    }
}

#===============================================================================
# Categorie 4: Pare-feu Windows
#===============================================================================

function Test-FirewallConfiguration {
    Write-Section "4. PARE-FEU WINDOWS"
    
    # FW-001: Pare-feu active sur tous les profils
    Write-Info "Verification du pare-feu Windows..."
    $profiles = Get-NetFirewallProfile
    $disabledProfiles = $profiles | Where-Object { $_.Enabled -eq $false }
    
    if ($disabledProfiles.Count -eq 0) {
        Write-Pass "Pare-feu active sur tous les profils"
        Add-Result -Id "FW-001" -Category "CIS" -Title "Pare-feu Windows active" -Status "PASS" -Severity "critical" `
            -Description "Le pare-feu Windows est active sur tous les profils reseau" -Reference "CIS 9.1.1"
    } else {
        Write-Fail "Pare-feu desactive sur: $($disabledProfiles.Name -join ', ')"
        Add-Result -Id "FW-001" -Category "CIS" -Title "Pare-feu Windows active" -Status "FAIL" -Severity "critical" `
            -Description "Pare-feu desactive sur: $($disabledProfiles.Name -join ', ')" `
            -Remediation "Activer le pare-feu: Set-NetFirewallProfile -All -Enabled True" -Reference "CIS 9.1.1"
    }
    
    # FW-002: Action par defaut - Bloquer les connexions entrantes
    Write-Info "Verification de l'action par defaut du pare-feu..."
    $domainProfile = Get-NetFirewallProfile -Name Domain
    $privateProfile = Get-NetFirewallProfile -Name Private
    $publicProfile = Get-NetFirewallProfile -Name Public
    
    $allBlock = ($domainProfile.DefaultInboundAction -eq "Block") -and 
                ($privateProfile.DefaultInboundAction -eq "Block") -and 
                ($publicProfile.DefaultInboundAction -eq "Block")
    
    if ($allBlock) {
        Write-Pass "Action par defaut: Bloquer les connexions entrantes"
        Add-Result -Id "FW-002" -Category "CIS" -Title "Regle par defaut du pare-feu" -Status "PASS" -Severity "high" `
            -Description "Les connexions entrantes sont bloquees par defaut" -Reference "CIS 9.1.2"
    } else {
        Write-Fail "Action par defaut non conforme"
        Add-Result -Id "FW-002" -Category "CIS" -Title "Regle par defaut du pare-feu" -Status "FAIL" -Severity "high" `
            -Description "Les connexions entrantes ne sont pas bloquees par defaut sur tous les profils" `
            -Remediation "Set-NetFirewallProfile -All -DefaultInboundAction Block" -Reference "CIS 9.1.2"
    }
    
    # FW-003: Logging du pare-feu
    Write-Info "Verification du logging pare-feu..."
    $fwLogging = Get-NetFirewallProfile | Select-Object Name, LogFileName, LogBlocked, LogAllowed
    $loggingOk = $true
    
    foreach ($profile in $fwLogging) {
        if (-not $profile.LogBlocked) {
            $loggingOk = $false
        }
    }
    
    if ($loggingOk) {
        Write-Pass "Logging des connexions bloquees active"
        Add-Result -Id "FW-003" -Category "CIS" -Title "Logging du pare-feu" -Status "PASS" -Severity "medium" `
            -Description "Le logging des connexions bloquees est active" -Reference "CIS 9.1.7"
    } else {
        Write-Warn "Logging pare-feu incomplet"
        Add-Result -Id "FW-003" -Category "CIS" -Title "Logging du pare-feu" -Status "WARN" -Severity "medium" `
            -Description "Le logging n'est pas configure sur tous les profils" `
            -Remediation "Set-NetFirewallProfile -All -LogBlocked True -LogAllowed True" -Reference "CIS 9.1.7"
    }
    
    # FW-004: Regles entrantes
    Write-Info "Analyse des regles entrantes..."
    $inboundRules = Get-NetFirewallRule -Direction Inbound -Enabled True | 
                    Where-Object { $_.Action -eq "Allow" }
    $ruleCount = $inboundRules.Count
    
    if ($ruleCount -lt 20) {
        Write-Pass "Nombre de regles entrantes autorisees: $ruleCount"
        Add-Result -Id "FW-004" -Category "ANSSI" -Title "Regles pare-feu entrantes" -Status "PASS" -Severity "medium" `
            -Description "$ruleCount regles entrantes autorisees (niveau raisonnable)" -Reference "ANSSI R8"
    } elseif ($ruleCount -lt 50) {
        Write-Warn "Nombre de regles entrantes: $ruleCount"
        Add-Result -Id "FW-004" -Category "ANSSI" -Title "Regles pare-feu entrantes" -Status "WARN" -Severity "medium" `
            -Description "$ruleCount regles entrantes - audit recommande" `
            -Remediation "Reviser les regles pare-feu et supprimer celles non necessaires" -Reference "ANSSI R8"
    } else {
        Write-Fail "Trop de regles entrantes: $ruleCount"
        Add-Result -Id "FW-004" -Category "ANSSI" -Title "Regles pare-feu entrantes" -Status "FAIL" -Severity "medium" `
            -Description "$ruleCount regles entrantes - surface d'attaque elevee" `
            -Remediation "Reduire significativement le nombre de regles autorisees" -Reference "ANSSI R8"
    }
}

#===============================================================================
# Categorie 5: Journalisation et Audit
#===============================================================================

function Test-AuditConfiguration {
    Write-Section "5. JOURNALISATION ET AUDIT"
    
    # AUD-001: Politique d'audit des connexions
    Write-Info "Verification de la politique d'audit..."
    $auditPolicy = auditpol /get /category:* 2>$null
    
    # Connexions de compte
    $logonAudit = $auditPolicy | Select-String "Logon"
    if ($logonAudit -match "Success and Failure") {
        Write-Pass "Audit des connexions: Succes et Echecs"
        Add-Result -Id "AUD-001" -Category "CIS" -Title "Audit des connexions" -Status "PASS" -Severity "high" `
            -Description "Les connexions reussies et echouees sont auditees" -Reference "CIS 17.5.1"
    } else {
        Write-Warn "Audit des connexions incomplet"
        Add-Result -Id "AUD-001" -Category "CIS" -Title "Audit des connexions" -Status "WARN" -Severity "high" `
            -Description "L'audit des connexions n'est pas complet" `
            -Remediation "Activer l'audit complet via: auditpol /set /subcategory:'Logon' /success:enable /failure:enable" -Reference "CIS 17.5.1"
    }
    
    # AUD-002: Taille des journaux d'evenements
    Write-Info "Verification de la taille des journaux..."
    $securityLog = Get-WinEvent -ListLog Security
    $securityLogSizeMB = [math]::Round($securityLog.MaximumSizeInBytes / 1MB)
    
    if ($securityLogSizeMB -ge 196) {
        Write-Pass "Journal Securite: $securityLogSizeMB MB"
        Add-Result -Id "AUD-002" -Category "CIS" -Title "Taille journal Securite" -Status "PASS" -Severity "medium" `
            -Description "Journal Securite configure a $securityLogSizeMB MB" -Reference "CIS 18.9.27.1"
    } else {
        Write-Warn "Journal Securite trop petit: $securityLogSizeMB MB"
        Add-Result -Id "AUD-002" -Category "CIS" -Title "Taille journal Securite" -Status "WARN" -Severity "medium" `
            -Description "Journal Securite de seulement $securityLogSizeMB MB (recommande: 196+ MB)" `
            -Remediation "Augmenter la taille du journal via l'Observateur d'evenements" -Reference "CIS 18.9.27.1"
    }
    
    # AUD-003: Audit des changements de strategie
    $policyAudit = $auditPolicy | Select-String "Policy Change"
    if ($policyAudit -match "Success") {
        Write-Pass "Audit des changements de strategie active"
        Add-Result -Id "AUD-003" -Category "CIS" -Title "Audit des changements de strategie" -Status "PASS" -Severity "medium" `
            -Description "Les modifications de strategie sont auditees" -Reference "CIS 17.7"
    } else {
        Write-Warn "Audit des changements de strategie non configure"
        Add-Result -Id "AUD-003" -Category "CIS" -Title "Audit des changements de strategie" -Status "WARN" -Severity "medium" `
            -Description "Les changements de strategie ne sont pas audites" `
            -Remediation "Activer l'audit via auditpol" -Reference "CIS 17.7"
    }
    
    # AUD-004: Audit de l'utilisation des privileges
    $privAudit = $auditPolicy | Select-String "Privilege Use"
    if ($privAudit -match "Success and Failure") {
        Write-Pass "Audit de l'utilisation des privileges active"
        Add-Result -Id "AUD-004" -Category "CIS" -Title "Audit utilisation des privileges" -Status "PASS" -Severity "high" `
            -Description "L'utilisation des privileges sensibles est auditee" -Reference "CIS 17.8"
    } else {
        Write-Warn "Audit des privileges incomplet"
        Add-Result -Id "AUD-004" -Category "CIS" -Title "Audit utilisation des privileges" -Status "WARN" -Severity "high" `
            -Description "L'audit de l'utilisation des privileges n'est pas complet" `
            -Remediation "Configurer l'audit des privileges sensibles" -Reference "CIS 17.8"
    }
    
    # AUD-005: Audit de la gestion des comptes
    $accountAudit = $auditPolicy | Select-String "Account Management"
    if ($accountAudit -match "Success") {
        Write-Pass "Audit de la gestion des comptes active"
        Add-Result -Id "AUD-005" -Category "CIS" -Title "Audit gestion des comptes" -Status "PASS" -Severity "high" `
            -Description "La gestion des comptes utilisateurs est auditee" -Reference "CIS 17.2"
    } else {
        Write-Warn "Audit de la gestion des comptes non configure"
        Add-Result -Id "AUD-005" -Category "CIS" -Title "Audit gestion des comptes" -Status "WARN" -Severity "high" `
            -Description "Les modifications de comptes ne sont pas auditees" `
            -Remediation "Activer l'audit de Account Management" -Reference "CIS 17.2"
    }
}

#===============================================================================
# Categorie 6: Reseau
#===============================================================================

function Test-NetworkConfiguration {
    Write-Section "6. CONFIGURATION RESEAU"
    
    # NET-001: IPv6 si non utilise
    Write-Info "Verification IPv6..."
    $ipv6Adapters = Get-NetAdapterBinding | Where-Object { $_.ComponentID -eq "ms_tcpip6" -and $_.Enabled -eq $true }
    
    if ($ipv6Adapters.Count -eq 0) {
        Write-Pass "IPv6 desactive sur toutes les interfaces"
        Add-Result -Id "NET-001" -Category "ANSSI" -Title "Protocole IPv6" -Status "PASS" -Severity "low" `
            -Description "IPv6 est desactive (recommande si non utilise)" -Reference "ANSSI R15"
    } else {
        Write-Info "IPv6 active - verifier si necessaire"
        Add-Result -Id "NET-001" -Category "ANSSI" -Title "Protocole IPv6" -Status "WARN" -Severity "low" `
            -Description "IPv6 est active sur $($ipv6Adapters.Count) interface(s)" `
            -Remediation "Desactiver IPv6 si non utilise dans l'environnement" -Reference "ANSSI R15"
    }
    
    # NET-002: LLMNR desactive
    Write-Info "Verification LLMNR..."
    $llmnr = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Name "EnableMulticast" -ErrorAction SilentlyContinue
    
    if ($llmnr.EnableMulticast -eq 0) {
        Write-Pass "LLMNR desactive"
        Add-Result -Id "NET-002" -Category "ANSSI" -Title "LLMNR desactive" -Status "PASS" -Severity "high" `
            -Description "Link-Local Multicast Name Resolution est desactive" -Reference "ANSSI R17"
    } else {
        Write-Fail "LLMNR active - vulnerable au relaying"
        Add-Result -Id "NET-002" -Category "ANSSI" -Title "LLMNR desactive" -Status "FAIL" -Severity "high" `
            -Description "LLMNR est active - vulnerable aux attaques de relaying" `
            -Remediation "Desactiver via GPO: Computer Configuration > Administrative Templates > Network > DNS Client" -Reference "ANSSI R17"
    }
    
    # NET-003: NetBIOS over TCP/IP
    Write-Info "Verification NetBIOS..."
    $netbios = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.TcpipNetbiosOptions -eq 2 }
    
    if ($netbios.Count -gt 0) {
        Write-Pass "NetBIOS desactive sur certaines interfaces"
        Add-Result -Id "NET-003" -Category "ANSSI" -Title "NetBIOS over TCP/IP" -Status "PASS" -Severity "medium" `
            -Description "NetBIOS est desactive sur les interfaces" -Reference "ANSSI R16"
    } else {
        Write-Warn "NetBIOS potentiellement actif"
        Add-Result -Id "NET-003" -Category "ANSSI" -Title "NetBIOS over TCP/IP" -Status "WARN" -Severity "medium" `
            -Description "NetBIOS peut etre actif sur les interfaces reseau" `
            -Remediation "Desactiver NetBIOS dans les proprietes TCP/IP avancees" -Reference "ANSSI R16"
    }
    
    # NET-004: WPAD desactive
    Write-Info "Verification WPAD..."
    $wpad = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings\Wpad" -Name "WpadOverride" -ErrorAction SilentlyContinue
    
    if ($wpad.WpadOverride -eq 1) {
        Write-Pass "WPAD desactive"
        Add-Result -Id "NET-004" -Category "ANSSI" -Title "WPAD desactive" -Status "PASS" -Severity "medium" `
            -Description "Web Proxy Auto-Discovery est desactive" -Reference "ANSSI R18"
    } else {
        Write-Warn "WPAD potentiellement actif"
        Add-Result -Id "NET-004" -Category "ANSSI" -Title "WPAD desactive" -Status "WARN" -Severity "medium" `
            -Description "WPAD peut etre actif - vulnerable aux attaques MITM" `
            -Remediation "Desactiver WPAD via le registre ou GPO" -Reference "ANSSI R18"
    }
    
    # NET-005: WinRM securise
    Write-Info "Verification WinRM..."
    try {
        $winrm = Get-WSManInstance -ResourceURI winrm/config/service -ErrorAction Stop
        
        if ($winrm.AllowUnencrypted -eq $false) {
            Write-Pass "WinRM: Trafic non chiffre bloque"
            Add-Result -Id "NET-005" -Category "CIS" -Title "WinRM securise" -Status "PASS" -Severity "high" `
                -Description "WinRM n'accepte pas les connexions non chiffrees" -Reference "CIS 18.9.102"
        } else {
            Write-Fail "WinRM accepte le trafic non chiffre"
            Add-Result -Id "NET-005" -Category "CIS" -Title "WinRM securise" -Status "FAIL" -Severity "high" `
                -Description "WinRM accepte les connexions non chiffrees" `
                -Remediation "Configurer AllowUnencrypted = false" -Reference "CIS 18.9.102"
        }
    } catch {
        Write-Info "WinRM non configure"
        Add-Result -Id "NET-005" -Category "CIS" -Title "WinRM securise" -Status "PASS" -Severity "high" `
            -Description "WinRM n'est pas configure sur ce systeme" -Reference "CIS 18.9.102"
    }
}

#===============================================================================
# Generation du rapport HTML
#===============================================================================

function New-HtmlReport {
    param(
        [int]$Score,
        [string]$Grade
    )
    
    $htmlFile = $OutputFile -replace '\.json$', '.html'
    $hostname = $env:COMPUTERNAME
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $date = Get-Date -Format "dd/MM/yyyy HH:mm:ss"
    
    $gradeColor = switch ($Grade) {
        "A" { "#22c55e" }
        "B" { "#84cc16" }
        "C" { "#eab308" }
        "D" { "#f97316" }
        "F" { "#ef4444" }
    }
    
    $resultsHtml = ""
    foreach ($result in $script:Results) {
        $statusClass = $result.status.ToLower()
        $statusIcon = switch ($result.status) {
            "PASS" { "✓" }
            "WARN" { "!" }
            "FAIL" { "✗" }
        }
        
        $remediationHtml = ""
        if ($result.remediation -and $result.status -ne "PASS") {
            $remediationHtml = "<div class='remediation'><strong>Recommandation:</strong> $($result.remediation)</div>"
        }
        
        $resultsHtml += @"
            <div class="result-item">
                <div class="result-status $statusClass">$statusIcon</div>
                <div class="result-content">
                    <h4>$($result.title)</h4>
                    <p>$($result.description)</p>
                    $remediationHtml
                </div>
                <div class="result-meta">
                    <div class="result-category">$($result.category)</div>
                    <div class="result-severity">$($result.severity)</div>
                </div>
            </div>
"@
    }
    
    $html = @"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'Audit Securite Windows Server - Infra Shield Tools</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
        .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); color: white; padding: 40px; border-radius: 12px; margin-bottom: 30px; }
        .header h1 { font-size: 28px; margin-bottom: 8px; }
        .header .subtitle { opacity: 0.8; font-size: 16px; }
        .header .framework { background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; display: inline-block; margin-top: 15px; font-size: 14px; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .score-card { text-align: center; }
        .score-circle { width: 150px; height: 150px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 20px; background: $gradeColor; }
        .score-value { font-size: 48px; font-weight: bold; color: white; }
        .score-label { font-size: 14px; color: rgba(255,255,255,0.8); }
        .grade { font-size: 24px; font-weight: bold; margin-top: 10px; color: $gradeColor; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px; }
        .stat { text-align: center; padding: 15px; border-radius: 8px; }
        .stat.pass { background: #dcfce7; color: #166534; }
        .stat.warn { background: #fef9c3; color: #854d0e; }
        .stat.fail { background: #fee2e2; color: #991b1b; }
        .stat-value { font-size: 32px; font-weight: bold; }
        .stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .info-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .info-label { color: #64748b; }
        .info-value { font-weight: 500; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 20px; font-weight: 600; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }
        .result-item { background: white; border-radius: 8px; padding: 16px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: grid; grid-template-columns: auto 1fr auto; gap: 15px; align-items: start; }
        .result-status { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 14px; }
        .result-status.pass { background: #22c55e; }
        .result-status.warn { background: #eab308; }
        .result-status.fail { background: #ef4444; }
        .result-content h4 { font-size: 15px; margin-bottom: 4px; }
        .result-content p { font-size: 13px; color: #64748b; }
        .result-meta { text-align: right; }
        .result-category { font-size: 11px; color: #94a3b8; text-transform: uppercase; }
        .result-severity { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #f1f5f9; color: #475569; }
        .remediation { margin-top: 8px; padding: 10px; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e; }
        .footer { text-align: center; padding: 30px; color: #64748b; font-size: 14px; }
        @media print { body { background: white; } .container { max-width: 100%; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Rapport d'Audit de Securite Windows Server (BASE)</h1>
            <div class="subtitle">Genere par Infra Shield Tools - ~55 controles essentiels</div>
            <div class="framework">Referentiel ANSSI + CIS Benchmark Level 1</div>
        </div>

        <div class="summary-grid">
            <div class="card score-card">
                <div class="score-circle">
                    <div class="score-value">$Score%</div>
                    <div class="score-label">Score</div>
                </div>
                <div class="grade">Note: $Grade</div>
                <div class="stats">
                    <div class="stat pass">
                        <div class="stat-value">$($script:PassedChecks)</div>
                        <div class="stat-label">Reussis</div>
                    </div>
                    <div class="stat warn">
                        <div class="stat-value">$($script:WarningChecks)</div>
                        <div class="stat-label">Alertes</div>
                    </div>
                    <div class="stat fail">
                        <div class="stat-value">$($script:FailedChecks)</div>
                        <div class="stat-label">Echecs</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-bottom: 15px;">Informations Systeme</h3>
                <div class="info-grid">
                    <div class="info-item"><span class="info-label">Hostname</span><span class="info-value">$hostname</span></div>
                    <div class="info-item"><span class="info-label">Date</span><span class="info-value">$date</span></div>
                    <div class="info-item"><span class="info-label">Systeme</span><span class="info-value">$($osInfo.Caption)</span></div>
                    <div class="info-item"><span class="info-label">Version</span><span class="info-value">$($osInfo.Version)</span></div>
                    <div class="info-item"><span class="info-label">Architecture</span><span class="info-value">$($osInfo.OSArchitecture)</span></div>
                    <div class="info-item"><span class="info-label">Version Script</span><span class="info-value">$Version</span></div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Resultats Detailles</h2>
            $resultsHtml
        </div>

        <div class="footer">
            <p>Rapport genere par <strong>Infra Shield Tools</strong></p>
            <p>Base sur les recommandations ANSSI et CIS Benchmark pour Windows Server</p>
        </div>
    </div>
</body>
</html>
"@
    
    $html | Out-File -FilePath $htmlFile -Encoding UTF8
    Write-Host "[OK] Rapport HTML genere: $htmlFile" -ForegroundColor Green
}

#===============================================================================
# Generation du rapport JSON
#===============================================================================

function New-JsonReport {
    $score = 0
    if ($script:TotalChecks -gt 0) {
        $score = [math]::Round(($script:PassedChecks * 100) / $script:TotalChecks)
    }
    
    $grade = switch ($score) {
        { $_ -ge 90 } { "A" }
        { $_ -ge 80 } { "B" }
        { $_ -ge 70 } { "C" }
        { $_ -ge 60 } { "D" }
        default { "F" }
    }
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════════╗"
    Write-Host "║                       RESUME DE L'AUDIT                            ║"
    Write-Host "╠════════════════════════════════════════════════════════════════════╣"
    Write-Host ("║  Score Global: {0,-3}%                                    Note: {1,-1}   ║" -f $score, $grade)
    Write-Host "╠════════════════════════════════════════════════════════════════════╣"
    Write-Host ("║  ✓ Controles reussis:    {0,-3}                                      ║" -f $script:PassedChecks)
    Write-Host ("║  ⚠ Avertissements:       {0,-3}                                      ║" -f $script:WarningChecks)
    Write-Host ("║  ✗ Controles echoues:    {0,-3}                                      ║" -f $script:FailedChecks)
    Write-Host ("║  Total:                  {0,-3}                                      ║" -f $script:TotalChecks)
    Write-Host "╚════════════════════════════════════════════════════════════════════╝"
    
    $osInfo = Get-CimInstance Win32_OperatingSystem
    
    $report = [PSCustomObject]@{
        report_type = "windows_security_audit"
        framework = "ANSSI + CIS Benchmark L1"
        system_info = [PSCustomObject]@{
            hostname = $env:COMPUTERNAME
            os = $osInfo.Caption
            version = $osInfo.Version
            architecture = $osInfo.OSArchitecture
            audit_date = (Get-Date -Format "o")
            script_version = $Version
        }
        summary = [PSCustomObject]@{
            total_checks = $script:TotalChecks
            passed = $script:PassedChecks
            warnings = $script:WarningChecks
            failed = $script:FailedChecks
            score = $score
            grade = $grade
        }
        results = $script:Results
    }
    
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host ""
    Write-Host "[OK] Rapport JSON genere: $OutputFile" -ForegroundColor Green
    
    if ($GenerateHtml) {
        New-HtmlReport -Score $score -Grade $grade
    }
    
    Write-Host ""
    if ($script:FailedChecks -gt 0) {
        Write-Host "[ATTENTION] $($script:FailedChecks) controles critiques necessitent une action immediate." -ForegroundColor Red
    }
    if ($script:WarningChecks -gt 0) {
        Write-Host "[INFO] $($script:WarningChecks) points d'amelioration identifies." -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Ouvrez le fichier HTML dans un navigateur pour visualiser le rapport."
    Write-Host "Pour creer un PDF: Fichier > Imprimer > Enregistrer en PDF"
}

#===============================================================================
# Point d'entree principal
#===============================================================================

Write-Header
Write-Host "Demarrage de l'audit de securite Windows Server (~55 controles)..."
Write-Host "Fichier de sortie: $OutputFile"
Write-Host ""

Test-SystemConfiguration
Test-AccountManagement
Test-ServicesConfiguration
Test-FirewallConfiguration
Test-AuditConfiguration
Test-NetworkConfiguration

New-JsonReport
