#===============================================================================
# Infra Shield Tools - Script d'Audit de Sécurité Windows Server (BASE)
# Basé sur les recommandations ANSSI et CIS Benchmark Level 1
# Version: 1.0.0
# Niveau: BASE (~55 contrôles essentiels)
# 
# Ce script effectue un audit de sécurité de base d'un système Windows Server
# en suivant les recommandations ANSSI et CIS Benchmark Level 1
#
# Usage: .\windows-compliance-base.ps1 [-OutputFile <fichier>] [-Verbose]
#
# Licence: Propriétaire Infra Shield Tools
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
    Write-Host "║               ~55 contrôles essentiels                             ║" -ForegroundColor Cyan
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
# Catégorie 1: Configuration du Système
#===============================================================================

function Test-SystemConfiguration {
    Write-Section "1. CONFIGURATION DU SYSTÈME"
    
    # SYS-001: Vérification du niveau de patch Windows Update
    Write-Info "Vérification des mises à jour Windows..."
    try {
        $lastUpdate = Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1
        $daysSinceUpdate = ((Get-Date) - $lastUpdate.InstalledOn).Days
        
        if ($daysSinceUpdate -le 30) {
            Write-Pass "Dernière mise à jour: $($lastUpdate.HotFixID) il y a $daysSinceUpdate jours"
            Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises à jour système" -Status "PASS" -Severity "critical" `
                -Description "Système mis à jour récemment (il y a $daysSinceUpdate jours)" -Reference "ANSSI R1"
        } elseif ($daysSinceUpdate -le 90) {
            Write-Warn "Dernière mise à jour il y a $daysSinceUpdate jours"
            Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises à jour système" -Status "WARN" -Severity "critical" `
                -Description "Dernière mise à jour il y a $daysSinceUpdate jours" `
                -Remediation "Exécuter Windows Update pour installer les dernières mises à jour de sécurité" -Reference "ANSSI R1"
        } else {
            Write-Fail "Système non mis à jour depuis $daysSinceUpdate jours"
            Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises à jour système" -Status "FAIL" -Severity "critical" `
                -Description "Système non mis à jour depuis $daysSinceUpdate jours" `
                -Remediation "Exécuter immédiatement Windows Update" -Reference "ANSSI R1"
        }
    } catch {
        Write-Warn "Impossible de vérifier les mises à jour"
        Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises à jour système" -Status "WARN" -Severity "critical" `
            -Description "Impossible de déterminer l'état des mises à jour" `
            -Remediation "Vérifier manuellement Windows Update" -Reference "ANSSI R1"
    }
    
    # SYS-002: Version Windows supportée
    Write-Info "Vérification de la version Windows..."
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $buildNumber = [int]$osInfo.BuildNumber
    
    if ($buildNumber -ge 17763) {
        Write-Pass "Version Windows Server supportée: $($osInfo.Caption) Build $buildNumber"
        Add-Result -Id "SYS-002" -Category "CIS" -Title "Version Windows supportée" -Status "PASS" -Severity "high" `
            -Description "Version Windows Server actuelle et supportée" -Reference "CIS 1.1.1"
    } else {
        Write-Fail "Version Windows obsolète: Build $buildNumber"
        Add-Result -Id "SYS-002" -Category "CIS" -Title "Version Windows supportée" -Status "FAIL" -Severity "high" `
            -Description "Version Windows Server obsolète ou non supportée" `
            -Remediation "Mettre à niveau vers Windows Server 2019 ou ultérieur" -Reference "CIS 1.1.1"
    }
    
    # SYS-003: UAC activé
    Write-Info "Vérification UAC..."
    $uacKey = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name "EnableLUA" -ErrorAction SilentlyContinue
    
    if ($uacKey.EnableLUA -eq 1) {
        Write-Pass "UAC est activé"
        Add-Result -Id "SYS-003" -Category "CIS" -Title "Contrôle de compte utilisateur (UAC)" -Status "PASS" -Severity "high" `
            -Description "UAC est activé" -Reference "CIS 2.3.17.1"
    } else {
        Write-Fail "UAC est désactivé"
        Add-Result -Id "SYS-003" -Category "CIS" -Title "Contrôle de compte utilisateur (UAC)" -Status "FAIL" -Severity "high" `
            -Description "UAC est désactivé - risque d'élévation de privilèges" `
            -Remediation "Activer UAC via les paramètres de sécurité" -Reference "CIS 2.3.17.1"
    }
    
    # SYS-004: Secure Boot
    Write-Info "Vérification Secure Boot..."
    try {
        $secureBoot = Confirm-SecureBootUEFI -ErrorAction SilentlyContinue
        if ($secureBoot) {
            Write-Pass "Secure Boot est activé"
            Add-Result -Id "SYS-004" -Category "ANSSI" -Title "Secure Boot UEFI" -Status "PASS" -Severity "high" `
                -Description "Secure Boot UEFI est activé" -Reference "ANSSI R2"
        } else {
            Write-Warn "Secure Boot non activé ou non disponible"
            Add-Result -Id "SYS-004" -Category "ANSSI" -Title "Secure Boot UEFI" -Status "WARN" -Severity "high" `
                -Description "Secure Boot n'est pas activé" `
                -Remediation "Activer Secure Boot dans le BIOS/UEFI" -Reference "ANSSI R2"
        }
    } catch {
        Write-Info "Secure Boot non supporté sur ce système"
        Add-Result -Id "SYS-004" -Category "ANSSI" -Title "Secure Boot UEFI" -Status "WARN" -Severity "high" `
            -Description "Secure Boot non disponible (système legacy BIOS)" `
            -Remediation "Migrer vers UEFI avec Secure Boot si possible" -Reference "ANSSI R2"
    }
    
    # SYS-005: BitLocker
    Write-Info "Vérification BitLocker..."
    try {
        $bitlocker = Get-BitLockerVolume -MountPoint "C:" -ErrorAction SilentlyContinue
        if ($bitlocker.ProtectionStatus -eq "On") {
            Write-Pass "BitLocker activé sur le volume système"
            Add-Result -Id "SYS-005" -Category "ANSSI" -Title "Chiffrement disque BitLocker" -Status "PASS" -Severity "critical" `
                -Description "BitLocker est activé sur le volume système C:" -Reference "ANSSI R3"
        } else {
            Write-Fail "BitLocker non activé sur le volume système"
            Add-Result -Id "SYS-005" -Category "ANSSI" -Title "Chiffrement disque BitLocker" -Status "FAIL" -Severity "critical" `
                -Description "Le volume système n'est pas chiffré avec BitLocker" `
                -Remediation "Activer BitLocker sur le volume système" -Reference "ANSSI R3"
        }
    } catch {
        Write-Warn "BitLocker non disponible"
        Add-Result -Id "SYS-005" -Category "ANSSI" -Title "Chiffrement disque BitLocker" -Status "WARN" -Severity "critical" `
            -Description "BitLocker n'est pas disponible sur ce système" `
            -Remediation "Installer la fonctionnalité BitLocker" -Reference "ANSSI R3"
    }
    
    # SYS-006: Autoplay désactivé
    Write-Info "Vérification AutoPlay..."
    $autoplay = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name "NoDriveTypeAutoRun" -ErrorAction SilentlyContinue
    
    if ($autoplay.NoDriveTypeAutoRun -eq 255) {
        Write-Pass "AutoPlay désactivé pour tous les lecteurs"
        Add-Result -Id "SYS-006" -Category "CIS" -Title "AutoPlay désactivé" -Status "PASS" -Severity "medium" `
            -Description "AutoPlay est désactivé pour tous les types de lecteurs" -Reference "CIS 18.9.8.3"
    } else {
        Write-Warn "AutoPlay potentiellement actif"
        Add-Result -Id "SYS-006" -Category "CIS" -Title "AutoPlay désactivé" -Status "WARN" -Severity "medium" `
            -Description "AutoPlay n'est pas complètement désactivé" `
            -Remediation "Configurer NoDriveTypeAutoRun = 255 via GPO" -Reference "CIS 18.9.8.3"
    }
    
    # SYS-007: Remote Desktop sécurisé
    Write-Info "Vérification Remote Desktop..."
    $rdpKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -ErrorAction SilentlyContinue
    $nlaKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" -Name "UserAuthentication" -ErrorAction SilentlyContinue
    
    if ($rdpKey.fDenyTSConnections -eq 1) {
        Write-Pass "Remote Desktop désactivé"
        Add-Result -Id "SYS-007" -Category "CIS" -Title "Remote Desktop" -Status "PASS" -Severity "medium" `
            -Description "Remote Desktop est désactivé" -Reference "CIS 18.9.59.1"
    } elseif ($nlaKey.UserAuthentication -eq 1) {
        Write-Pass "Remote Desktop activé avec NLA"
        Add-Result -Id "SYS-007" -Category "CIS" -Title "Remote Desktop" -Status "PASS" -Severity "medium" `
            -Description "Remote Desktop activé avec Network Level Authentication (NLA)" -Reference "CIS 18.9.59.2"
    } else {
        Write-Fail "Remote Desktop activé sans NLA"
        Add-Result -Id "SYS-007" -Category "CIS" -Title "Remote Desktop" -Status "FAIL" -Severity "medium" `
            -Description "Remote Desktop est activé sans NLA - risque de sécurité" `
            -Remediation "Activer Network Level Authentication pour RDP" -Reference "CIS 18.9.59.2"
    }
}

#===============================================================================
# Catégorie 2: Gestion des Comptes
#===============================================================================

function Test-AccountManagement {
    Write-Section "2. GESTION DES COMPTES"
    
    # ACC-001: Compte Administrateur local renommé
    Write-Info "Vérification du compte Administrateur..."
    $adminAccount = Get-LocalUser | Where-Object { $_.SID -like "*-500" }
    
    if ($adminAccount.Name -ne "Administrateur" -and $adminAccount.Name -ne "Administrator") {
        Write-Pass "Compte Administrateur renommé: $($adminAccount.Name)"
        Add-Result -Id "ACC-001" -Category "CIS" -Title "Compte Administrateur renommé" -Status "PASS" -Severity "medium" `
            -Description "Le compte Administrateur intégré a été renommé" -Reference "CIS 2.3.1.5"
    } else {
        Write-Warn "Compte Administrateur non renommé"
        Add-Result -Id "ACC-001" -Category "CIS" -Title "Compte Administrateur renommé" -Status "WARN" -Severity "medium" `
            -Description "Le compte Administrateur conserve son nom par défaut" `
            -Remediation "Renommer le compte Administrateur via la stratégie locale" -Reference "CIS 2.3.1.5"
    }
    
    # ACC-002: Compte Invité désactivé
    Write-Info "Vérification du compte Invité..."
    $guestAccount = Get-LocalUser | Where-Object { $_.SID -like "*-501" }
    
    if (-not $guestAccount.Enabled) {
        Write-Pass "Compte Invité désactivé"
        Add-Result -Id "ACC-002" -Category "CIS" -Title "Compte Invité désactivé" -Status "PASS" -Severity "high" `
            -Description "Le compte Invité est désactivé" -Reference "CIS 2.3.1.1"
    } else {
        Write-Fail "Compte Invité activé"
        Add-Result -Id "ACC-002" -Category "CIS" -Title "Compte Invité désactivé" -Status "FAIL" -Severity "high" `
            -Description "Le compte Invité est activé - risque de sécurité" `
            -Remediation "Désactiver le compte Invité: net user Guest /active:no" -Reference "CIS 2.3.1.1"
    }
    
    # ACC-003: Politique de mot de passe - longueur minimale
    Write-Info "Vérification de la politique de mots de passe..."
    $secpol = secedit /export /cfg "$env:TEMP\secpol.cfg" 2>$null
    $secpolContent = Get-Content "$env:TEMP\secpol.cfg" -ErrorAction SilentlyContinue
    $minPwdLen = ($secpolContent | Select-String "MinimumPasswordLength").ToString().Split("=")[1].Trim()
    Remove-Item "$env:TEMP\secpol.cfg" -Force -ErrorAction SilentlyContinue
    
    if ([int]$minPwdLen -ge 14) {
        Write-Pass "Longueur minimale du mot de passe: $minPwdLen caractères"
        Add-Result -Id "ACC-003" -Category "ANSSI" -Title "Longueur minimale du mot de passe" -Status "PASS" -Severity "high" `
            -Description "Longueur minimale configurée à $minPwdLen caractères" -Reference "ANSSI R20"
    } elseif ([int]$minPwdLen -ge 8) {
        Write-Warn "Longueur minimale du mot de passe: $minPwdLen caractères (recommandé: 14)"
        Add-Result -Id "ACC-003" -Category "ANSSI" -Title "Longueur minimale du mot de passe" -Status "WARN" -Severity "high" `
            -Description "Longueur minimale de $minPwdLen caractères (recommandé: 14)" `
            -Remediation "Augmenter la longueur minimale à 14 caractères via GPO" -Reference "ANSSI R20"
    } else {
        Write-Fail "Longueur minimale du mot de passe insuffisante: $minPwdLen"
        Add-Result -Id "ACC-003" -Category "ANSSI" -Title "Longueur minimale du mot de passe" -Status "FAIL" -Severity "high" `
            -Description "Longueur minimale de seulement $minPwdLen caractères" `
            -Remediation "Configurer une longueur minimale de 14 caractères" -Reference "ANSSI R20"
    }
    
    # ACC-004: Complexité du mot de passe
    Write-Info "Vérification de la complexité des mots de passe..."
    $complexity = ($secpolContent | Select-String "PasswordComplexity").ToString().Split("=")[1].Trim()
    
    if ([int]$complexity -eq 1) {
        Write-Pass "Complexité du mot de passe activée"
        Add-Result -Id "ACC-004" -Category "CIS" -Title "Complexité du mot de passe" -Status "PASS" -Severity "high" `
            -Description "La politique de complexité des mots de passe est activée" -Reference "CIS 1.1.5"
    } else {
        Write-Fail "Complexité du mot de passe désactivée"
        Add-Result -Id "ACC-004" -Category "CIS" -Title "Complexité du mot de passe" -Status "FAIL" -Severity "high" `
            -Description "La complexité des mots de passe n'est pas exigée" `
            -Remediation "Activer la complexité des mots de passe via GPO" -Reference "CIS 1.1.5"
    }
    
    # ACC-005: Verrouillage après tentatives échouées
    Write-Info "Vérification du verrouillage de compte..."
    $lockoutThreshold = ($secpolContent | Select-String "LockoutBadCount").ToString().Split("=")[1].Trim()
    
    if ([int]$lockoutThreshold -gt 0 -and [int]$lockoutThreshold -le 5) {
        Write-Pass "Verrouillage après $lockoutThreshold tentatives échouées"
        Add-Result -Id "ACC-005" -Category "CIS" -Title "Seuil de verrouillage de compte" -Status "PASS" -Severity "high" `
            -Description "Verrouillage configuré après $lockoutThreshold tentatives" -Reference "CIS 1.2.1"
    } elseif ([int]$lockoutThreshold -gt 5) {
        Write-Warn "Seuil de verrouillage trop élevé: $lockoutThreshold"
        Add-Result -Id "ACC-005" -Category "CIS" -Title "Seuil de verrouillage de compte" -Status "WARN" -Severity "high" `
            -Description "Seuil de verrouillage trop permissif ($lockoutThreshold tentatives)" `
            -Remediation "Réduire le seuil à 5 tentatives maximum" -Reference "CIS 1.2.1"
    } else {
        Write-Fail "Verrouillage de compte non configuré"
        Add-Result -Id "ACC-005" -Category "CIS" -Title "Seuil de verrouillage de compte" -Status "FAIL" -Severity "high" `
            -Description "Aucun verrouillage de compte configuré" `
            -Remediation "Configurer un seuil de 5 tentatives maximum" -Reference "CIS 1.2.1"
    }
    
    # ACC-006: Expiration des mots de passe
    Write-Info "Vérification de l'expiration des mots de passe..."
    $maxPwdAge = ($secpolContent | Select-String "MaximumPasswordAge").ToString().Split("=")[1].Trim()
    
    if ([int]$maxPwdAge -gt 0 -and [int]$maxPwdAge -le 365) {
        Write-Pass "Expiration des mots de passe: $maxPwdAge jours"
        Add-Result -Id "ACC-006" -Category "CIS" -Title "Expiration des mots de passe" -Status "PASS" -Severity "medium" `
            -Description "Mots de passe expirent après $maxPwdAge jours" -Reference "CIS 1.1.2"
    } else {
        Write-Warn "Expiration des mots de passe non optimale"
        Add-Result -Id "ACC-006" -Category "CIS" -Title "Expiration des mots de passe" -Status "WARN" -Severity "medium" `
            -Description "Configuration d'expiration non conforme" `
            -Remediation "Configurer une durée maximale de 365 jours" -Reference "CIS 1.1.2"
    }
    
    # ACC-007: Historique des mots de passe
    Write-Info "Vérification de l'historique des mots de passe..."
    $pwdHistory = ($secpolContent | Select-String "PasswordHistorySize").ToString().Split("=")[1].Trim()
    
    if ([int]$pwdHistory -ge 24) {
        Write-Pass "Historique des mots de passe: $pwdHistory derniers mots de passe"
        Add-Result -Id "ACC-007" -Category "CIS" -Title "Historique des mots de passe" -Status "PASS" -Severity "medium" `
            -Description "Les $pwdHistory derniers mots de passe sont mémorisés" -Reference "CIS 1.1.1"
    } else {
        Write-Warn "Historique des mots de passe insuffisant: $pwdHistory"
        Add-Result -Id "ACC-007" -Category "CIS" -Title "Historique des mots de passe" -Status "WARN" -Severity "medium" `
            -Description "Seulement $pwdHistory mots de passe mémorisés (recommandé: 24)" `
            -Remediation "Configurer l'historique à 24 mots de passe" -Reference "CIS 1.1.1"
    }
}

#===============================================================================
# Catégorie 3: Services et Applications
#===============================================================================

function Test-ServicesConfiguration {
    Write-Section "3. SERVICES ET APPLICATIONS"
    
    # SVC-001: Services inutiles désactivés
    Write-Info "Vérification des services à risque..."
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
        Write-Pass "Aucun service à risque actif"
        Add-Result -Id "SVC-001" -Category "CIS" -Title "Services à risque désactivés" -Status "PASS" -Severity "high" `
            -Description "Aucun service potentiellement dangereux n'est actif" -Reference "CIS 5"
    } else {
        Write-Fail "Services à risque actifs: $($enabledRisky -join ', ')"
        Add-Result -Id "SVC-001" -Category "CIS" -Title "Services à risque désactivés" -Status "FAIL" -Severity "high" `
            -Description "Services à risque actifs: $($enabledRisky -join ', ')" `
            -Remediation "Désactiver les services non nécessaires via services.msc" -Reference "CIS 5"
    }
    
    # SVC-002: Windows Defender activé
    Write-Info "Vérification Windows Defender..."
    try {
        $defenderStatus = Get-MpComputerStatus -ErrorAction Stop
        
        if ($defenderStatus.AntivirusEnabled -and $defenderStatus.RealTimeProtectionEnabled) {
            Write-Pass "Windows Defender activé avec protection en temps réel"
            Add-Result -Id "SVC-002" -Category "ANSSI" -Title "Antivirus Windows Defender" -Status "PASS" -Severity "critical" `
                -Description "Windows Defender est activé avec protection temps réel" -Reference "ANSSI R4"
        } else {
            Write-Fail "Windows Defender partiellement actif"
            Add-Result -Id "SVC-002" -Category "ANSSI" -Title "Antivirus Windows Defender" -Status "FAIL" -Severity "critical" `
                -Description "Protection Windows Defender incomplète" `
                -Remediation "Activer toutes les protections Windows Defender" -Reference "ANSSI R4"
        }
    } catch {
        Write-Warn "Windows Defender non disponible ou autre antivirus installé"
        Add-Result -Id "SVC-002" -Category "ANSSI" -Title "Antivirus Windows Defender" -Status "WARN" -Severity "critical" `
            -Description "Windows Defender non disponible - vérifier qu'un antivirus est installé" `
            -Remediation "S'assurer qu'une solution antivirus est active" -Reference "ANSSI R4"
    }
    
    # SVC-003: Mises à jour des définitions antivirus
    Write-Info "Vérification des définitions antivirus..."
    try {
        $defStatus = Get-MpComputerStatus
        $daysSinceUpdate = ((Get-Date) - $defStatus.AntivirusSignatureLastUpdated).Days
        
        if ($daysSinceUpdate -le 1) {
            Write-Pass "Définitions antivirus à jour (mise à jour il y a $daysSinceUpdate jour(s))"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Définitions antivirus" -Status "PASS" -Severity "high" `
                -Description "Définitions mises à jour il y a $daysSinceUpdate jour(s)" -Reference "ANSSI R4"
        } elseif ($daysSinceUpdate -le 7) {
            Write-Warn "Définitions antivirus datant de $daysSinceUpdate jours"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Définitions antivirus" -Status "WARN" -Severity "high" `
                -Description "Dernière mise à jour il y a $daysSinceUpdate jours" `
                -Remediation "Mettre à jour les définitions Windows Defender" -Reference "ANSSI R4"
        } else {
            Write-Fail "Définitions antivirus obsolètes ($daysSinceUpdate jours)"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Définitions antivirus" -Status "FAIL" -Severity "high" `
                -Description "Définitions non mises à jour depuis $daysSinceUpdate jours" `
                -Remediation "Mettre à jour immédiatement les définitions antivirus" -Reference "ANSSI R4"
        }
    } catch {
        Write-Info "Impossible de vérifier les définitions antivirus"
    }
    
    # SVC-004: PowerShell Script Block Logging
    Write-Info "Vérification du logging PowerShell..."
    $psLogging = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging" -Name "EnableScriptBlockLogging" -ErrorAction SilentlyContinue
    
    if ($psLogging.EnableScriptBlockLogging -eq 1) {
        Write-Pass "PowerShell Script Block Logging activé"
        Add-Result -Id "SVC-004" -Category "CIS" -Title "Logging PowerShell" -Status "PASS" -Severity "medium" `
            -Description "Script Block Logging PowerShell est activé" -Reference "CIS 18.9.97.2"
    } else {
        Write-Warn "PowerShell Script Block Logging désactivé"
        Add-Result -Id "SVC-004" -Category "CIS" -Title "Logging PowerShell" -Status "WARN" -Severity "medium" `
            -Description "Script Block Logging n'est pas configuré" `
            -Remediation "Activer Script Block Logging via GPO" -Reference "CIS 18.9.97.2"
    }
    
    # SVC-005: SMBv1 désactivé
    Write-Info "Vérification SMBv1..."
    try {
        $smb1 = Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -ErrorAction Stop
        
        if ($smb1.State -eq "Disabled") {
            Write-Pass "SMBv1 désactivé"
            Add-Result -Id "SVC-005" -Category "ANSSI" -Title "Protocole SMBv1 désactivé" -Status "PASS" -Severity "critical" `
                -Description "Le protocole SMBv1 vulnérable est désactivé" -Reference "ANSSI R12"
        } else {
            Write-Fail "SMBv1 activé - vulnérabilité critique"
            Add-Result -Id "SVC-005" -Category "ANSSI" -Title "Protocole SMBv1 désactivé" -Status "FAIL" -Severity "critical" `
                -Description "SMBv1 est activé - vulnérable à EternalBlue/WannaCry" `
                -Remediation "Désactiver SMBv1: Disable-WindowsOptionalFeature -FeatureName SMB1Protocol" -Reference "ANSSI R12"
        }
    } catch {
        $smb1Config = Get-SmbServerConfiguration | Select-Object EnableSMB1Protocol
        if (-not $smb1Config.EnableSMB1Protocol) {
            Write-Pass "SMBv1 désactivé"
            Add-Result -Id "SVC-005" -Category "ANSSI" -Title "Protocole SMBv1 désactivé" -Status "PASS" -Severity "critical" `
                -Description "Le protocole SMBv1 est désactivé" -Reference "ANSSI R12"
        } else {
            Write-Fail "SMBv1 activé"
            Add-Result -Id "SVC-005" -Category "ANSSI" -Title "Protocole SMBv1 désactivé" -Status "FAIL" -Severity "critical" `
                -Description "SMBv1 est activé" `
                -Remediation "Set-SmbServerConfiguration -EnableSMB1Protocol $false" -Reference "ANSSI R12"
        }
    }
    
    # SVC-006: Print Spooler (PrintNightmare)
    Write-Info "Vérification Print Spooler..."
    $spooler = Get-Service -Name "Spooler" -ErrorAction SilentlyContinue
    
    if (-not $spooler -or $spooler.Status -ne "Running") {
        Write-Pass "Print Spooler désactivé"
        Add-Result -Id "SVC-006" -Category "ANSSI" -Title "Service Print Spooler" -Status "PASS" -Severity "critical" `
            -Description "Print Spooler désactivé (protection PrintNightmare)" -Reference "ANSSI R5"
    } else {
        Write-Warn "Print Spooler actif - vérifier les patches"
        Add-Result -Id "SVC-006" -Category "ANSSI" -Title "Service Print Spooler" -Status "WARN" -Severity "critical" `
            -Description "Print Spooler actif - s'assurer que les correctifs PrintNightmare sont installés" `
            -Remediation "Désactiver si non nécessaire: Stop-Service Spooler; Set-Service Spooler -StartupType Disabled" -Reference "ANSSI R5"
    }
}

#===============================================================================
# Catégorie 4: Pare-feu Windows
#===============================================================================

function Test-FirewallConfiguration {
    Write-Section "4. PARE-FEU WINDOWS"
    
    # FW-001: Pare-feu activé sur tous les profils
    Write-Info "Vérification du pare-feu Windows..."
    $profiles = Get-NetFirewallProfile
    $disabledProfiles = $profiles | Where-Object { $_.Enabled -eq $false }
    
    if ($disabledProfiles.Count -eq 0) {
        Write-Pass "Pare-feu activé sur tous les profils"
        Add-Result -Id "FW-001" -Category "CIS" -Title "Pare-feu Windows activé" -Status "PASS" -Severity "critical" `
            -Description "Le pare-feu Windows est activé sur tous les profils réseau" -Reference "CIS 9.1.1"
    } else {
        Write-Fail "Pare-feu désactivé sur: $($disabledProfiles.Name -join ', ')"
        Add-Result -Id "FW-001" -Category "CIS" -Title "Pare-feu Windows activé" -Status "FAIL" -Severity "critical" `
            -Description "Pare-feu désactivé sur: $($disabledProfiles.Name -join ', ')" `
            -Remediation "Activer le pare-feu: Set-NetFirewallProfile -All -Enabled True" -Reference "CIS 9.1.1"
    }
    
    # FW-002: Action par défaut - Bloquer les connexions entrantes
    Write-Info "Vérification de l'action par défaut du pare-feu..."
    $domainProfile = Get-NetFirewallProfile -Name Domain
    $privateProfile = Get-NetFirewallProfile -Name Private
    $publicProfile = Get-NetFirewallProfile -Name Public
    
    $allBlock = ($domainProfile.DefaultInboundAction -eq "Block") -and 
                ($privateProfile.DefaultInboundAction -eq "Block") -and 
                ($publicProfile.DefaultInboundAction -eq "Block")
    
    if ($allBlock) {
        Write-Pass "Action par défaut: Bloquer les connexions entrantes"
        Add-Result -Id "FW-002" -Category "CIS" -Title "Règle par défaut du pare-feu" -Status "PASS" -Severity "high" `
            -Description "Les connexions entrantes sont bloquées par défaut" -Reference "CIS 9.1.2"
    } else {
        Write-Fail "Action par défaut non conforme"
        Add-Result -Id "FW-002" -Category "CIS" -Title "Règle par défaut du pare-feu" -Status "FAIL" -Severity "high" `
            -Description "Les connexions entrantes ne sont pas bloquées par défaut sur tous les profils" `
            -Remediation "Set-NetFirewallProfile -All -DefaultInboundAction Block" -Reference "CIS 9.1.2"
    }
    
    # FW-003: Logging du pare-feu
    Write-Info "Vérification du logging pare-feu..."
    $fwLogging = Get-NetFirewallProfile | Select-Object Name, LogFileName, LogBlocked, LogAllowed
    $loggingOk = $true
    
    foreach ($profile in $fwLogging) {
        if (-not $profile.LogBlocked) {
            $loggingOk = $false
        }
    }
    
    if ($loggingOk) {
        Write-Pass "Logging des connexions bloquées activé"
        Add-Result -Id "FW-003" -Category "CIS" -Title "Logging du pare-feu" -Status "PASS" -Severity "medium" `
            -Description "Le logging des connexions bloquées est activé" -Reference "CIS 9.1.7"
    } else {
        Write-Warn "Logging pare-feu incomplet"
        Add-Result -Id "FW-003" -Category "CIS" -Title "Logging du pare-feu" -Status "WARN" -Severity "medium" `
            -Description "Le logging n'est pas configuré sur tous les profils" `
            -Remediation "Set-NetFirewallProfile -All -LogBlocked True -LogAllowed True" -Reference "CIS 9.1.7"
    }
    
    # FW-004: Règles entrantes
    Write-Info "Analyse des règles entrantes..."
    $inboundRules = Get-NetFirewallRule -Direction Inbound -Enabled True | 
                    Where-Object { $_.Action -eq "Allow" }
    $ruleCount = $inboundRules.Count
    
    if ($ruleCount -lt 20) {
        Write-Pass "Nombre de règles entrantes autorisées: $ruleCount"
        Add-Result -Id "FW-004" -Category "ANSSI" -Title "Règles pare-feu entrantes" -Status "PASS" -Severity "medium" `
            -Description "$ruleCount règles entrantes autorisées (niveau raisonnable)" -Reference "ANSSI R8"
    } elseif ($ruleCount -lt 50) {
        Write-Warn "Nombre de règles entrantes: $ruleCount"
        Add-Result -Id "FW-004" -Category "ANSSI" -Title "Règles pare-feu entrantes" -Status "WARN" -Severity "medium" `
            -Description "$ruleCount règles entrantes - audit recommandé" `
            -Remediation "Réviser les règles pare-feu et supprimer celles non nécessaires" -Reference "ANSSI R8"
    } else {
        Write-Fail "Trop de règles entrantes: $ruleCount"
        Add-Result -Id "FW-004" -Category "ANSSI" -Title "Règles pare-feu entrantes" -Status "FAIL" -Severity "medium" `
            -Description "$ruleCount règles entrantes - surface d'attaque élevée" `
            -Remediation "Réduire significativement le nombre de règles autorisées" -Reference "ANSSI R8"
    }
}

#===============================================================================
# Catégorie 5: Journalisation et Audit
#===============================================================================

function Test-AuditConfiguration {
    Write-Section "5. JOURNALISATION ET AUDIT"
    
    # AUD-001: Politique d'audit des connexions
    Write-Info "Vérification de la politique d'audit..."
    $auditPolicy = auditpol /get /category:* 2>$null
    
    # Connexions de compte
    $logonAudit = $auditPolicy | Select-String "Logon"
    if ($logonAudit -match "Success and Failure") {
        Write-Pass "Audit des connexions: Succès et Échecs"
        Add-Result -Id "AUD-001" -Category "CIS" -Title "Audit des connexions" -Status "PASS" -Severity "high" `
            -Description "Les connexions réussies et échouées sont auditées" -Reference "CIS 17.5.1"
    } else {
        Write-Warn "Audit des connexions incomplet"
        Add-Result -Id "AUD-001" -Category "CIS" -Title "Audit des connexions" -Status "WARN" -Severity "high" `
            -Description "L'audit des connexions n'est pas complet" `
            -Remediation "Activer l'audit complet via: auditpol /set /subcategory:'Logon' /success:enable /failure:enable" -Reference "CIS 17.5.1"
    }
    
    # AUD-002: Taille des journaux d'événements
    Write-Info "Vérification de la taille des journaux..."
    $securityLog = Get-WinEvent -ListLog Security
    $securityLogSizeMB = [math]::Round($securityLog.MaximumSizeInBytes / 1MB)
    
    if ($securityLogSizeMB -ge 196) {
        Write-Pass "Journal Sécurité: $securityLogSizeMB MB"
        Add-Result -Id "AUD-002" -Category "CIS" -Title "Taille journal Sécurité" -Status "PASS" -Severity "medium" `
            -Description "Journal Sécurité configuré à $securityLogSizeMB MB" -Reference "CIS 18.9.27.1"
    } else {
        Write-Warn "Journal Sécurité trop petit: $securityLogSizeMB MB"
        Add-Result -Id "AUD-002" -Category "CIS" -Title "Taille journal Sécurité" -Status "WARN" -Severity "medium" `
            -Description "Journal Sécurité de seulement $securityLogSizeMB MB (recommandé: 196+ MB)" `
            -Remediation "Augmenter la taille du journal via l'Observateur d'événements" -Reference "CIS 18.9.27.1"
    }
    
    # AUD-003: Audit des changements de stratégie
    $policyAudit = $auditPolicy | Select-String "Policy Change"
    if ($policyAudit -match "Success") {
        Write-Pass "Audit des changements de stratégie activé"
        Add-Result -Id "AUD-003" -Category "CIS" -Title "Audit des changements de stratégie" -Status "PASS" -Severity "medium" `
            -Description "Les modifications de stratégie sont auditées" -Reference "CIS 17.7"
    } else {
        Write-Warn "Audit des changements de stratégie non configuré"
        Add-Result -Id "AUD-003" -Category "CIS" -Title "Audit des changements de stratégie" -Status "WARN" -Severity "medium" `
            -Description "Les changements de stratégie ne sont pas audités" `
            -Remediation "Activer l'audit via auditpol" -Reference "CIS 17.7"
    }
    
    # AUD-004: Audit de l'utilisation des privilèges
    $privAudit = $auditPolicy | Select-String "Privilege Use"
    if ($privAudit -match "Success and Failure") {
        Write-Pass "Audit de l'utilisation des privilèges activé"
        Add-Result -Id "AUD-004" -Category "CIS" -Title "Audit utilisation des privilèges" -Status "PASS" -Severity "high" `
            -Description "L'utilisation des privilèges sensibles est auditée" -Reference "CIS 17.8"
    } else {
        Write-Warn "Audit des privilèges incomplet"
        Add-Result -Id "AUD-004" -Category "CIS" -Title "Audit utilisation des privilèges" -Status "WARN" -Severity "high" `
            -Description "L'audit de l'utilisation des privilèges n'est pas complet" `
            -Remediation "Configurer l'audit des privilèges sensibles" -Reference "CIS 17.8"
    }
    
    # AUD-005: Audit de la gestion des comptes
    $accountAudit = $auditPolicy | Select-String "Account Management"
    if ($accountAudit -match "Success") {
        Write-Pass "Audit de la gestion des comptes activé"
        Add-Result -Id "AUD-005" -Category "CIS" -Title "Audit gestion des comptes" -Status "PASS" -Severity "high" `
            -Description "La gestion des comptes utilisateurs est auditée" -Reference "CIS 17.2"
    } else {
        Write-Warn "Audit de la gestion des comptes non configuré"
        Add-Result -Id "AUD-005" -Category "CIS" -Title "Audit gestion des comptes" -Status "WARN" -Severity "high" `
            -Description "Les modifications de comptes ne sont pas auditées" `
            -Remediation "Activer l'audit de Account Management" -Reference "CIS 17.2"
    }
}

#===============================================================================
# Catégorie 6: Réseau
#===============================================================================

function Test-NetworkConfiguration {
    Write-Section "6. CONFIGURATION RÉSEAU"
    
    # NET-001: IPv6 si non utilisé
    Write-Info "Vérification IPv6..."
    $ipv6Adapters = Get-NetAdapterBinding | Where-Object { $_.ComponentID -eq "ms_tcpip6" -and $_.Enabled -eq $true }
    
    if ($ipv6Adapters.Count -eq 0) {
        Write-Pass "IPv6 désactivé sur toutes les interfaces"
        Add-Result -Id "NET-001" -Category "ANSSI" -Title "Protocole IPv6" -Status "PASS" -Severity "low" `
            -Description "IPv6 est désactivé (recommandé si non utilisé)" -Reference "ANSSI R15"
    } else {
        Write-Info "IPv6 activé - vérifier si nécessaire"
        Add-Result -Id "NET-001" -Category "ANSSI" -Title "Protocole IPv6" -Status "WARN" -Severity "low" `
            -Description "IPv6 est activé sur $($ipv6Adapters.Count) interface(s)" `
            -Remediation "Désactiver IPv6 si non utilisé dans l'environnement" -Reference "ANSSI R15"
    }
    
    # NET-002: LLMNR désactivé
    Write-Info "Vérification LLMNR..."
    $llmnr = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Name "EnableMulticast" -ErrorAction SilentlyContinue
    
    if ($llmnr.EnableMulticast -eq 0) {
        Write-Pass "LLMNR désactivé"
        Add-Result -Id "NET-002" -Category "ANSSI" -Title "LLMNR désactivé" -Status "PASS" -Severity "high" `
            -Description "Link-Local Multicast Name Resolution est désactivé" -Reference "ANSSI R17"
    } else {
        Write-Fail "LLMNR activé - vulnérable au relaying"
        Add-Result -Id "NET-002" -Category "ANSSI" -Title "LLMNR désactivé" -Status "FAIL" -Severity "high" `
            -Description "LLMNR est activé - vulnérable aux attaques de relaying" `
            -Remediation "Désactiver via GPO: Computer Configuration > Administrative Templates > Network > DNS Client" -Reference "ANSSI R17"
    }
    
    # NET-003: NetBIOS over TCP/IP
    Write-Info "Vérification NetBIOS..."
    $netbios = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.TcpipNetbiosOptions -eq 2 }
    
    if ($netbios.Count -gt 0) {
        Write-Pass "NetBIOS désactivé sur certaines interfaces"
        Add-Result -Id "NET-003" -Category "ANSSI" -Title "NetBIOS over TCP/IP" -Status "PASS" -Severity "medium" `
            -Description "NetBIOS est désactivé sur les interfaces" -Reference "ANSSI R16"
    } else {
        Write-Warn "NetBIOS potentiellement actif"
        Add-Result -Id "NET-003" -Category "ANSSI" -Title "NetBIOS over TCP/IP" -Status "WARN" -Severity "medium" `
            -Description "NetBIOS peut être actif sur les interfaces réseau" `
            -Remediation "Désactiver NetBIOS dans les propriétés TCP/IP avancées" -Reference "ANSSI R16"
    }
    
    # NET-004: WPAD désactivé
    Write-Info "Vérification WPAD..."
    $wpad = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings\Wpad" -Name "WpadOverride" -ErrorAction SilentlyContinue
    
    if ($wpad.WpadOverride -eq 1) {
        Write-Pass "WPAD désactivé"
        Add-Result -Id "NET-004" -Category "ANSSI" -Title "WPAD désactivé" -Status "PASS" -Severity "medium" `
            -Description "Web Proxy Auto-Discovery est désactivé" -Reference "ANSSI R18"
    } else {
        Write-Warn "WPAD potentiellement actif"
        Add-Result -Id "NET-004" -Category "ANSSI" -Title "WPAD désactivé" -Status "WARN" -Severity "medium" `
            -Description "WPAD peut être actif - vulnérable aux attaques MITM" `
            -Remediation "Désactiver WPAD via le registre ou GPO" -Reference "ANSSI R18"
    }
    
    # NET-005: WinRM sécurisé
    Write-Info "Vérification WinRM..."
    try {
        $winrm = Get-WSManInstance -ResourceURI winrm/config/service -ErrorAction Stop
        
        if ($winrm.AllowUnencrypted -eq $false) {
            Write-Pass "WinRM: Trafic non chiffré bloqué"
            Add-Result -Id "NET-005" -Category "CIS" -Title "WinRM sécurisé" -Status "PASS" -Severity "high" `
                -Description "WinRM n'accepte pas les connexions non chiffrées" -Reference "CIS 18.9.102"
        } else {
            Write-Fail "WinRM accepte le trafic non chiffré"
            Add-Result -Id "NET-005" -Category "CIS" -Title "WinRM sécurisé" -Status "FAIL" -Severity "high" `
                -Description "WinRM accepte les connexions non chiffrées" `
                -Remediation "Configurer AllowUnencrypted = false" -Reference "CIS 18.9.102"
        }
    } catch {
        Write-Info "WinRM non configuré"
        Add-Result -Id "NET-005" -Category "CIS" -Title "WinRM sécurisé" -Status "PASS" -Severity "high" `
            -Description "WinRM n'est pas configuré sur ce système" -Reference "CIS 18.9.102"
    }
}

#===============================================================================
# Génération du rapport HTML
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
    <title>Rapport d'Audit Sécurité Windows Server - Infra Shield Tools</title>
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
            <h1>Rapport d'Audit de Sécurité Windows Server (BASE)</h1>
            <div class="subtitle">Généré par Infra Shield Tools - ~55 contrôles essentiels</div>
            <div class="framework">Référentiel ANSSI + CIS Benchmark Level 1</div>
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
                        <div class="stat-label">Réussis</div>
                    </div>
                    <div class="stat warn">
                        <div class="stat-value">$($script:WarningChecks)</div>
                        <div class="stat-label">Alertes</div>
                    </div>
                    <div class="stat fail">
                        <div class="stat-value">$($script:FailedChecks)</div>
                        <div class="stat-label">Échecs</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-bottom: 15px;">Informations Système</h3>
                <div class="info-grid">
                    <div class="info-item"><span class="info-label">Hostname</span><span class="info-value">$hostname</span></div>
                    <div class="info-item"><span class="info-label">Date</span><span class="info-value">$date</span></div>
                    <div class="info-item"><span class="info-label">Système</span><span class="info-value">$($osInfo.Caption)</span></div>
                    <div class="info-item"><span class="info-label">Version</span><span class="info-value">$($osInfo.Version)</span></div>
                    <div class="info-item"><span class="info-label">Architecture</span><span class="info-value">$($osInfo.OSArchitecture)</span></div>
                    <div class="info-item"><span class="info-label">Version Script</span><span class="info-value">$Version</span></div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Résultats Détaillés</h2>
            $resultsHtml
        </div>

        <div class="footer">
            <p>Rapport généré par <strong>Infra Shield Tools</strong></p>
            <p>Basé sur les recommandations ANSSI et CIS Benchmark pour Windows Server</p>
        </div>
    </div>
</body>
</html>
"@
    
    $html | Out-File -FilePath $htmlFile -Encoding UTF8
    Write-Host "[OK] Rapport HTML généré: $htmlFile" -ForegroundColor Green
}

#===============================================================================
# Génération du rapport JSON
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
    Write-Host "║                       RÉSUMÉ DE L'AUDIT                            ║"
    Write-Host "╠════════════════════════════════════════════════════════════════════╣"
    Write-Host ("║  Score Global: {0,-3}%                                    Note: {1,-1}   ║" -f $score, $grade)
    Write-Host "╠════════════════════════════════════════════════════════════════════╣"
    Write-Host ("║  ✓ Contrôles réussis:    {0,-3}                                      ║" -f $script:PassedChecks)
    Write-Host ("║  ⚠ Avertissements:       {0,-3}                                      ║" -f $script:WarningChecks)
    Write-Host ("║  ✗ Contrôles échoués:    {0,-3}                                      ║" -f $script:FailedChecks)
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
    Write-Host "[OK] Rapport JSON généré: $OutputFile" -ForegroundColor Green
    
    if ($GenerateHtml) {
        New-HtmlReport -Score $score -Grade $grade
    }
    
    Write-Host ""
    if ($script:FailedChecks -gt 0) {
        Write-Host "[ATTENTION] $($script:FailedChecks) contrôles critiques nécessitent une action immédiate." -ForegroundColor Red
    }
    if ($script:WarningChecks -gt 0) {
        Write-Host "[INFO] $($script:WarningChecks) points d'amélioration identifiés." -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Ouvrez le fichier HTML dans un navigateur pour visualiser le rapport."
    Write-Host "Pour créer un PDF: Fichier > Imprimer > Enregistrer en PDF"
}

#===============================================================================
# Point d'entrée principal
#===============================================================================

Write-Header
Write-Host "Démarrage de l'audit de sécurité Windows Server (~55 contrôles)..."
Write-Host "Fichier de sortie: $OutputFile"
Write-Host ""

Test-SystemConfiguration
Test-AccountManagement
Test-ServicesConfiguration
Test-FirewallConfiguration
Test-AuditConfiguration
Test-NetworkConfiguration

New-JsonReport
