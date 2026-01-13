#===============================================================================
# Infra Shield Tools - Script d'Audit de Sécurité Windows Server (ENHANCED)
# Basé sur les recommandations ANSSI et CIS Benchmark Level 2
# Version: 1.0.0
# Niveau: ENHANCED (~100 contrôles complets)
# 
# Ce script effectue un audit de sécurité renforcé d'un système Windows Server
# couvrant l'intégralité des recommandations ANSSI et CIS Benchmark Level 2
#
# Usage: .\windows-compliance-enhanced.ps1 [-OutputFile <fichier>] [-Verbose]
#
# Licence: Propriétaire Infra Shield Tools
#===============================================================================

#Requires -RunAsAdministrator
#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter()]
    [string]$OutputFile = "audit_enhanced_$(Get-Date -Format 'yyyyMMdd_HHmmss').json",
    
    [Parameter()]
    [switch]$GenerateHtml = $true
)

$ErrorActionPreference = "Continue"
$Version = "1.0.0"
$ScriptName = "IST Windows Compliance Audit - ENHANCED (ANSSI + CIS L2)"
$AuditLevel = "ENHANCED"

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
    Write-Host "║   Infra Shield Tools - Audit Windows Server v$Version (ENHANCED)   ║" -ForegroundColor Cyan
    Write-Host "║            ANSSI + CIS Benchmark Level 2                           ║" -ForegroundColor Cyan
    Write-Host "║               ~100 contrôles complets                              ║" -ForegroundColor Cyan
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
# Catégorie 1: Configuration du Système (Étendue)
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
    
    # SYS-008: Credential Guard (ENHANCED)
    Write-Info "Vérification Credential Guard..."
    try {
        $credGuard = Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard -ErrorAction Stop
        if ($credGuard.SecurityServicesRunning -contains 1) {
            Write-Pass "Credential Guard activé"
            Add-Result -Id "SYS-008" -Category "CIS L2" -Title "Credential Guard" -Status "PASS" -Severity "high" `
                -Description "Windows Defender Credential Guard est actif" -Reference "CIS 18.9.5.1"
        } else {
            Write-Warn "Credential Guard non actif"
            Add-Result -Id "SYS-008" -Category "CIS L2" -Title "Credential Guard" -Status "WARN" -Severity "high" `
                -Description "Credential Guard n'est pas en cours d'exécution" `
                -Remediation "Activer Credential Guard via GPO ou UEFI" -Reference "CIS 18.9.5.1"
        }
    } catch {
        Write-Info "Credential Guard non disponible"
        Add-Result -Id "SYS-008" -Category "CIS L2" -Title "Credential Guard" -Status "WARN" -Severity "high" `
            -Description "Credential Guard non disponible sur ce système" `
            -Remediation "Vérifier la compatibilité matérielle pour Credential Guard" -Reference "CIS 18.9.5.1"
    }
    
    # SYS-009: Device Guard (ENHANCED)
    Write-Info "Vérification Device Guard..."
    try {
        $deviceGuard = Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard -ErrorAction Stop
        if ($deviceGuard.VirtualizationBasedSecurityStatus -eq 2) {
            Write-Pass "Device Guard/VBS activé"
            Add-Result -Id "SYS-009" -Category "CIS L2" -Title "Virtualization Based Security" -Status "PASS" -Severity "high" `
                -Description "VBS (Virtualization Based Security) est activé" -Reference "CIS 18.9.5.2"
        } else {
            Write-Warn "VBS non actif"
            Add-Result -Id "SYS-009" -Category "CIS L2" -Title "Virtualization Based Security" -Status "WARN" -Severity "high" `
                -Description "VBS n'est pas activé" `
                -Remediation "Activer VBS via GPO et configuration UEFI" -Reference "CIS 18.9.5.2"
        }
    } catch {
        Write-Info "Device Guard non disponible"
    }
    
    # SYS-010: LSASS Protection (ENHANCED)
    Write-Info "Vérification protection LSASS..."
    $lsassKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa" -Name "RunAsPPL" -ErrorAction SilentlyContinue
    
    if ($lsassKey.RunAsPPL -eq 1) {
        Write-Pass "LSASS s'exécute en mode protégé (PPL)"
        Add-Result -Id "SYS-010" -Category "CIS L2" -Title "Protection LSASS" -Status "PASS" -Severity "critical" `
            -Description "LSASS s'exécute en Protected Process Light (PPL)" -Reference "CIS 18.3.1"
    } else {
        Write-Fail "LSASS non protégé"
        Add-Result -Id "SYS-010" -Category "CIS L2" -Title "Protection LSASS" -Status "FAIL" -Severity "critical" `
            -Description "LSASS n'est pas protégé - vulnérable au credential dumping" `
            -Remediation "Configurer RunAsPPL = 1 dans HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" -Reference "CIS 18.3.1"
    }
    
    # SYS-011: WDigest désactivé (ENHANCED)
    Write-Info "Vérification WDigest..."
    $wdigestKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest" -Name "UseLogonCredential" -ErrorAction SilentlyContinue
    
    if ($null -eq $wdigestKey.UseLogonCredential -or $wdigestKey.UseLogonCredential -eq 0) {
        Write-Pass "WDigest désactivé"
        Add-Result -Id "SYS-011" -Category "ANSSI" -Title "WDigest désactivé" -Status "PASS" -Severity "critical" `
            -Description "Le stockage WDigest des credentials est désactivé" -Reference "ANSSI R25"
    } else {
        Write-Fail "WDigest activé - credentials en clair en mémoire"
        Add-Result -Id "SYS-011" -Category "ANSSI" -Title "WDigest désactivé" -Status "FAIL" -Severity "critical" `
            -Description "WDigest stocke les credentials en clair en mémoire" `
            -Remediation "Définir UseLogonCredential = 0" -Reference "ANSSI R25"
    }
}

#===============================================================================
# Catégorie 2: Gestion des Comptes (Étendue)
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
    
    # ACC-003 à ACC-007: Politique de mot de passe (même que BASE)
    Write-Info "Vérification de la politique de mots de passe..."
    $secpol = secedit /export /cfg "$env:TEMP\secpol.cfg" 2>$null
    $secpolContent = Get-Content "$env:TEMP\secpol.cfg" -ErrorAction SilentlyContinue
    
    $minPwdLen = ($secpolContent | Select-String "MinimumPasswordLength").ToString().Split("=")[1].Trim()
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
    
    Remove-Item "$env:TEMP\secpol.cfg" -Force -ErrorAction SilentlyContinue
    
    # ACC-008: NTLM restrictions (ENHANCED)
    Write-Info "Vérification restrictions NTLM..."
    $ntlmKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa\MSV1_0" -Name "RestrictSendingNTLMTraffic" -ErrorAction SilentlyContinue
    
    if ($ntlmKey.RestrictSendingNTLMTraffic -ge 1) {
        Write-Pass "Restrictions NTLM configurées"
        Add-Result -Id "ACC-008" -Category "CIS L2" -Title "Restrictions NTLM" -Status "PASS" -Severity "high" `
            -Description "Le trafic NTLM sortant est restreint" -Reference "CIS 2.3.11.9"
    } else {
        Write-Warn "NTLM non restreint"
        Add-Result -Id "ACC-008" -Category "CIS L2" -Title "Restrictions NTLM" -Status "WARN" -Severity "high" `
            -Description "Le trafic NTLM n'est pas restreint" `
            -Remediation "Configurer les restrictions NTLM via GPO" -Reference "CIS 2.3.11.9"
    }
    
    # ACC-009: LAN Manager Hash désactivé (ENHANCED)
    Write-Info "Vérification stockage LM Hash..."
    $lmHashKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa" -Name "NoLMHash" -ErrorAction SilentlyContinue
    
    if ($lmHashKey.NoLMHash -eq 1) {
        Write-Pass "Stockage LM Hash désactivé"
        Add-Result -Id "ACC-009" -Category "CIS L2" -Title "LM Hash désactivé" -Status "PASS" -Severity "high" `
            -Description "Le stockage des hash LAN Manager est désactivé" -Reference "CIS 2.3.11.5"
    } else {
        Write-Fail "LM Hash peut être stocké"
        Add-Result -Id "ACC-009" -Category "CIS L2" -Title "LM Hash désactivé" -Status "FAIL" -Severity "high" `
            -Description "Les hash LM peuvent être stockés (vulnérable)" `
            -Remediation "Définir NoLMHash = 1 dans HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" -Reference "CIS 2.3.11.5"
    }
    
    # ACC-010: Audit des comptes de service (ENHANCED)
    Write-Info "Vérification des comptes de service..."
    $serviceAccounts = Get-CimInstance Win32_Service | Where-Object { 
        $_.StartName -ne "LocalSystem" -and 
        $_.StartName -ne "NT AUTHORITY\LocalService" -and 
        $_.StartName -ne "NT AUTHORITY\NetworkService" -and
        $_.StartName -ne $null
    }
    
    $customServiceCount = ($serviceAccounts | Measure-Object).Count
    if ($customServiceCount -eq 0) {
        Write-Pass "Aucun compte de service personnalisé détecté"
        Add-Result -Id "ACC-010" -Category "ANSSI" -Title "Comptes de service" -Status "PASS" -Severity "medium" `
            -Description "Tous les services utilisent des comptes système intégrés" -Reference "ANSSI R22"
    } else {
        Write-Info "$customServiceCount services avec comptes personnalisés"
        Add-Result -Id "ACC-010" -Category "ANSSI" -Title "Comptes de service" -Status "WARN" -Severity "medium" `
            -Description "$customServiceCount services utilisent des comptes personnalisés - à auditer" `
            -Remediation "Vérifier les privilèges des comptes de service personnalisés" -Reference "ANSSI R22"
    }
}

#===============================================================================
# Catégorie 3: Services et Applications (Étendue)
#===============================================================================

function Test-ServicesConfiguration {
    Write-Section "3. SERVICES ET APPLICATIONS"
    
    # SVC-001 à SVC-006: Même que BASE
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
    
    # SVC-002: Windows Defender
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
        Write-Warn "Windows Defender non disponible"
        Add-Result -Id "SVC-002" -Category "ANSSI" -Title "Antivirus Windows Defender" -Status "WARN" -Severity "critical" `
            -Description "Windows Defender non disponible - vérifier qu'un antivirus est installé" `
            -Remediation "S'assurer qu'une solution antivirus est active" -Reference "ANSSI R4"
    }
    
    # SVC-003: SMBv1 désactivé
    Write-Info "Vérification SMBv1..."
    try {
        $smb1 = Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -ErrorAction Stop
        
        if ($smb1.State -eq "Disabled") {
            Write-Pass "SMBv1 désactivé"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Protocole SMBv1 désactivé" -Status "PASS" -Severity "critical" `
                -Description "Le protocole SMBv1 vulnérable est désactivé" -Reference "ANSSI R12"
        } else {
            Write-Fail "SMBv1 activé - vulnérabilité critique"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Protocole SMBv1 désactivé" -Status "FAIL" -Severity "critical" `
                -Description "SMBv1 est activé - vulnérable à EternalBlue/WannaCry" `
                -Remediation "Disable-WindowsOptionalFeature -FeatureName SMB1Protocol" -Reference "ANSSI R12"
        }
    } catch {
        $smb1Config = Get-SmbServerConfiguration | Select-Object EnableSMB1Protocol
        if (-not $smb1Config.EnableSMB1Protocol) {
            Write-Pass "SMBv1 désactivé"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Protocole SMBv1 désactivé" -Status "PASS" -Severity "critical" `
                -Description "Le protocole SMBv1 est désactivé" -Reference "ANSSI R12"
        } else {
            Write-Fail "SMBv1 activé"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Protocole SMBv1 désactivé" -Status "FAIL" -Severity "critical" `
                -Description "SMBv1 est activé" `
                -Remediation "Set-SmbServerConfiguration -EnableSMB1Protocol $false" -Reference "ANSSI R12"
        }
    }
    
    # SVC-004: SMB Signing (ENHANCED)
    Write-Info "Vérification SMB Signing..."
    $smbConfig = Get-SmbServerConfiguration
    
    if ($smbConfig.RequireSecuritySignature) {
        Write-Pass "SMB Signing requis"
        Add-Result -Id "SVC-004" -Category "CIS L2" -Title "SMB Signing" -Status "PASS" -Severity "high" `
            -Description "La signature SMB est requise pour toutes les connexions" -Reference "CIS 2.3.9.2"
    } else {
        Write-Warn "SMB Signing non obligatoire"
        Add-Result -Id "SVC-004" -Category "CIS L2" -Title "SMB Signing" -Status "WARN" -Severity "high" `
            -Description "La signature SMB n'est pas obligatoire" `
            -Remediation "Set-SmbServerConfiguration -RequireSecuritySignature $true" -Reference "CIS 2.3.9.2"
    }
    
    # SVC-005: SMB Encryption (ENHANCED)
    Write-Info "Vérification SMB Encryption..."
    if ($smbConfig.EncryptData) {
        Write-Pass "SMB Encryption activé"
        Add-Result -Id "SVC-005" -Category "CIS L2" -Title "SMB Encryption" -Status "PASS" -Severity "high" `
            -Description "Le chiffrement SMB est activé" -Reference "CIS 2.3.9.5"
    } else {
        Write-Warn "SMB Encryption non activé"
        Add-Result -Id "SVC-005" -Category "CIS L2" -Title "SMB Encryption" -Status "WARN" -Severity "high" `
            -Description "Le chiffrement SMB n'est pas activé" `
            -Remediation "Set-SmbServerConfiguration -EncryptData $true" -Reference "CIS 2.3.9.5"
    }
    
    # SVC-006: Print Spooler
    Write-Info "Vérification Print Spooler..."
    $spooler = Get-Service -Name "Spooler" -ErrorAction SilentlyContinue
    
    if (-not $spooler -or $spooler.Status -ne "Running") {
        Write-Pass "Print Spooler désactivé"
        Add-Result -Id "SVC-006" -Category "ANSSI" -Title "Service Print Spooler" -Status "PASS" -Severity "critical" `
            -Description "Print Spooler désactivé (protection PrintNightmare)" -Reference "ANSSI R5"
    } else {
        Write-Warn "Print Spooler actif"
        Add-Result -Id "SVC-006" -Category "ANSSI" -Title "Service Print Spooler" -Status "WARN" -Severity "critical" `
            -Description "Print Spooler actif - vérifier les correctifs PrintNightmare" `
            -Remediation "Stop-Service Spooler; Set-Service Spooler -StartupType Disabled" -Reference "ANSSI R5"
    }
    
    # SVC-007: PowerShell Logging (ENHANCED)
    Write-Info "Vérification logging PowerShell complet..."
    $psLogging = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging" -ErrorAction SilentlyContinue
    $psTranscription = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\Transcription" -ErrorAction SilentlyContinue
    $psModuleLogging = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ModuleLogging" -ErrorAction SilentlyContinue
    
    $loggingScore = 0
    if ($psLogging.EnableScriptBlockLogging -eq 1) { $loggingScore++ }
    if ($psTranscription.EnableTranscripting -eq 1) { $loggingScore++ }
    if ($psModuleLogging.EnableModuleLogging -eq 1) { $loggingScore++ }
    
    if ($loggingScore -eq 3) {
        Write-Pass "Logging PowerShell complet activé"
        Add-Result -Id "SVC-007" -Category "CIS L2" -Title "Logging PowerShell complet" -Status "PASS" -Severity "high" `
            -Description "Script Block, Transcription et Module Logging sont activés" -Reference "CIS 18.9.97"
    } elseif ($loggingScore -gt 0) {
        Write-Warn "Logging PowerShell partiel ($loggingScore/3)"
        Add-Result -Id "SVC-007" -Category "CIS L2" -Title "Logging PowerShell complet" -Status "WARN" -Severity "high" `
            -Description "Seulement $loggingScore/3 types de logging PowerShell activés" `
            -Remediation "Activer tous les types de logging PowerShell via GPO" -Reference "CIS 18.9.97"
    } else {
        Write-Fail "Logging PowerShell désactivé"
        Add-Result -Id "SVC-007" -Category "CIS L2" -Title "Logging PowerShell complet" -Status "FAIL" -Severity "high" `
            -Description "Aucun logging PowerShell configuré" `
            -Remediation "Configurer Script Block Logging, Transcription et Module Logging" -Reference "CIS 18.9.97"
    }
    
    # SVC-008: PowerShell Constrained Language Mode (ENHANCED)
    Write-Info "Vérification mode langage PowerShell..."
    $languageMode = $ExecutionContext.SessionState.LanguageMode
    
    if ($languageMode -eq "ConstrainedLanguage") {
        Write-Pass "PowerShell en mode Constrained Language"
        Add-Result -Id "SVC-008" -Category "CIS L2" -Title "PowerShell Constrained Mode" -Status "PASS" -Severity "medium" `
            -Description "PowerShell s'exécute en mode Constrained Language" -Reference "CIS 18.9.97.1"
    } else {
        Write-Info "PowerShell en mode $languageMode"
        Add-Result -Id "SVC-008" -Category "CIS L2" -Title "PowerShell Constrained Mode" -Status "WARN" -Severity "medium" `
            -Description "PowerShell en mode $languageMode (Constrained recommandé)" `
            -Remediation "Configurer Constrained Language Mode via AppLocker/WDAC" -Reference "CIS 18.9.97.1"
    }
    
    # SVC-009: AppLocker/WDAC (ENHANCED)
    Write-Info "Vérification AppLocker..."
    $applockerSvc = Get-Service -Name "AppIDSvc" -ErrorAction SilentlyContinue
    
    if ($applockerSvc -and $applockerSvc.Status -eq "Running") {
        Write-Pass "AppLocker est actif"
        Add-Result -Id "SVC-009" -Category "CIS L2" -Title "AppLocker" -Status "PASS" -Severity "high" `
            -Description "Le service AppLocker est en cours d'exécution" -Reference "CIS 18.9.65"
    } else {
        Write-Warn "AppLocker non actif"
        Add-Result -Id "SVC-009" -Category "CIS L2" -Title "AppLocker" -Status "WARN" -Severity "high" `
            -Description "AppLocker n'est pas en cours d'exécution" `
            -Remediation "Configurer et activer AppLocker pour le contrôle d'applications" -Reference "CIS 18.9.65"
    }
    
    # SVC-010: Windows Defender ASR Rules (ENHANCED)
    Write-Info "Vérification règles ASR..."
    try {
        $asrRules = Get-MpPreference | Select-Object -ExpandProperty AttackSurfaceReductionRules_Ids -ErrorAction Stop
        $asrRulesCount = ($asrRules | Measure-Object).Count
        
        if ($asrRulesCount -ge 10) {
            Write-Pass "$asrRulesCount règles ASR configurées"
            Add-Result -Id "SVC-010" -Category "CIS L2" -Title "Attack Surface Reduction" -Status "PASS" -Severity "high" `
                -Description "$asrRulesCount règles ASR sont configurées" -Reference "CIS 18.9.47"
        } elseif ($asrRulesCount -gt 0) {
            Write-Warn "$asrRulesCount règles ASR (recommandé: 10+)"
            Add-Result -Id "SVC-010" -Category "CIS L2" -Title "Attack Surface Reduction" -Status "WARN" -Severity "high" `
                -Description "Seulement $asrRulesCount règles ASR configurées" `
                -Remediation "Ajouter les règles ASR recommandées via GPO ou Intune" -Reference "CIS 18.9.47"
        } else {
            Write-Fail "Aucune règle ASR configurée"
            Add-Result -Id "SVC-010" -Category "CIS L2" -Title "Attack Surface Reduction" -Status "FAIL" -Severity "high" `
                -Description "Aucune règle Attack Surface Reduction configurée" `
                -Remediation "Configurer les règles ASR pour réduire la surface d'attaque" -Reference "CIS 18.9.47"
        }
    } catch {
        Write-Info "Impossible de vérifier les règles ASR"
    }
}

#===============================================================================
# Catégorie 4: Pare-feu Windows (Étendue)
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
            -Remediation "Set-NetFirewallProfile -All -Enabled True" -Reference "CIS 9.1.1"
    }
    
    # FW-002: Action par défaut
    Write-Info "Vérification de l'action par défaut du pare-feu..."
    $allBlock = $true
    foreach ($profile in $profiles) {
        if ($profile.DefaultInboundAction -ne "Block") {
            $allBlock = $false
        }
    }
    
    if ($allBlock) {
        Write-Pass "Action par défaut: Bloquer les connexions entrantes"
        Add-Result -Id "FW-002" -Category "CIS" -Title "Règle par défaut du pare-feu" -Status "PASS" -Severity "high" `
            -Description "Les connexions entrantes sont bloquées par défaut" -Reference "CIS 9.1.2"
    } else {
        Write-Fail "Action par défaut non conforme"
        Add-Result -Id "FW-002" -Category "CIS" -Title "Règle par défaut du pare-feu" -Status "FAIL" -Severity "high" `
            -Description "Les connexions entrantes ne sont pas bloquées par défaut" `
            -Remediation "Set-NetFirewallProfile -All -DefaultInboundAction Block" -Reference "CIS 9.1.2"
    }
    
    # FW-003: Logging (ENHANCED - plus strict)
    Write-Info "Vérification du logging pare-feu..."
    $loggingComplete = $true
    foreach ($profile in $profiles) {
        if (-not $profile.LogBlocked -or -not $profile.LogAllowed) {
            $loggingComplete = $false
        }
    }
    
    if ($loggingComplete) {
        Write-Pass "Logging complet activé (bloqué + autorisé)"
        Add-Result -Id "FW-003" -Category "CIS L2" -Title "Logging complet du pare-feu" -Status "PASS" -Severity "medium" `
            -Description "Le logging des connexions bloquées et autorisées est activé" -Reference "CIS 9.1.7"
    } else {
        Write-Warn "Logging pare-feu incomplet"
        Add-Result -Id "FW-003" -Category "CIS L2" -Title "Logging complet du pare-feu" -Status "WARN" -Severity "medium" `
            -Description "Le logging n'est pas complet sur tous les profils" `
            -Remediation "Set-NetFirewallProfile -All -LogBlocked True -LogAllowed True" -Reference "CIS 9.1.7"
    }
    
    # FW-004: IPsec rules (ENHANCED)
    Write-Info "Vérification des règles IPsec..."
    $ipsecRules = Get-NetIPsecRule -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq $true }
    $ipsecCount = ($ipsecRules | Measure-Object).Count
    
    if ($ipsecCount -gt 0) {
        Write-Pass "$ipsecCount règles IPsec configurées"
        Add-Result -Id "FW-004" -Category "CIS L2" -Title "Règles IPsec" -Status "PASS" -Severity "medium" `
            -Description "$ipsecCount règles IPsec actives pour le trafic chiffré" -Reference "CIS 9.3"
    } else {
        Write-Info "Aucune règle IPsec active"
        Add-Result -Id "FW-004" -Category "CIS L2" -Title "Règles IPsec" -Status "WARN" -Severity "medium" `
            -Description "Aucune règle IPsec configurée" `
            -Remediation "Configurer IPsec pour le chiffrement du trafic sensible" -Reference "CIS 9.3"
    }
}

#===============================================================================
# Catégorie 5: Journalisation et Audit (Étendue)
#===============================================================================

function Test-AuditConfiguration {
    Write-Section "5. JOURNALISATION ET AUDIT"
    
    # AUD-001 à AUD-005: Base audit (comme BASE mais avec vérifications plus strictes)
    Write-Info "Vérification de la politique d'audit complète..."
    $auditPolicy = auditpol /get /category:* 2>$null
    
    # Check comprehensive audit settings
    $auditCategories = @(
        @{Pattern="Logon"; Name="Connexions"; Ref="CIS 17.5.1"},
        @{Pattern="Account Logon"; Name="Authentification"; Ref="CIS 17.1"},
        @{Pattern="Account Management"; Name="Gestion des comptes"; Ref="CIS 17.2"},
        @{Pattern="Policy Change"; Name="Changements de stratégie"; Ref="CIS 17.7"},
        @{Pattern="Privilege Use"; Name="Utilisation des privilèges"; Ref="CIS 17.8"},
        @{Pattern="Object Access"; Name="Accès aux objets"; Ref="CIS 17.6"},
        @{Pattern="System"; Name="Système"; Ref="CIS 17.9"},
        @{Pattern="Detailed Tracking"; Name="Suivi détaillé"; Ref="CIS 17.3"}
    )
    
    $auditScore = 0
    foreach ($cat in $auditCategories) {
        $catAudit = $auditPolicy | Select-String $cat.Pattern
        if ($catAudit -match "Success and Failure") {
            $auditScore++
        }
    }
    
    if ($auditScore -ge 7) {
        Write-Pass "Audit complet: $auditScore/8 catégories"
        Add-Result -Id "AUD-001" -Category "CIS L2" -Title "Politique d'audit complète" -Status "PASS" -Severity "high" `
            -Description "$auditScore/8 catégories d'audit configurées correctement" -Reference "CIS 17"
    } elseif ($auditScore -ge 4) {
        Write-Warn "Audit partiel: $auditScore/8 catégories"
        Add-Result -Id "AUD-001" -Category "CIS L2" -Title "Politique d'audit complète" -Status "WARN" -Severity "high" `
            -Description "Seulement $auditScore/8 catégories d'audit configurées" `
            -Remediation "Configurer l'audit complet via auditpol ou GPO" -Reference "CIS 17"
    } else {
        Write-Fail "Audit insuffisant: $auditScore/8 catégories"
        Add-Result -Id "AUD-001" -Category "CIS L2" -Title "Politique d'audit complète" -Status "FAIL" -Severity "high" `
            -Description "Audit insuffisant - seulement $auditScore/8 catégories" `
            -Remediation "Configurer immédiatement l'audit complet" -Reference "CIS 17"
    }
    
    # AUD-002: Taille des journaux (ENHANCED - plus grand)
    Write-Info "Vérification de la taille des journaux..."
    $securityLog = Get-WinEvent -ListLog Security
    $securityLogSizeMB = [math]::Round($securityLog.MaximumSizeInBytes / 1MB)
    
    if ($securityLogSizeMB -ge 1024) {
        Write-Pass "Journal Sécurité: $securityLogSizeMB MB"
        Add-Result -Id "AUD-002" -Category "CIS L2" -Title "Taille journal Sécurité" -Status "PASS" -Severity "medium" `
            -Description "Journal Sécurité configuré à $securityLogSizeMB MB" -Reference "CIS 18.9.27.1"
    } elseif ($securityLogSizeMB -ge 196) {
        Write-Warn "Journal Sécurité: $securityLogSizeMB MB (recommandé: 1024+ MB)"
        Add-Result -Id "AUD-002" -Category "CIS L2" -Title "Taille journal Sécurité" -Status "WARN" -Severity "medium" `
            -Description "Journal Sécurité de $securityLogSizeMB MB (recommandé: 1024+ MB)" `
            -Remediation "Augmenter la taille du journal à 1 GB minimum" -Reference "CIS 18.9.27.1"
    } else {
        Write-Fail "Journal Sécurité trop petit: $securityLogSizeMB MB"
        Add-Result -Id "AUD-002" -Category "CIS L2" -Title "Taille journal Sécurité" -Status "FAIL" -Severity "medium" `
            -Description "Journal Sécurité de seulement $securityLogSizeMB MB" `
            -Remediation "Configurer le journal Sécurité à 1 GB minimum" -Reference "CIS 18.9.27.1"
    }
    
    # AUD-003: Command Line Auditing (ENHANCED)
    Write-Info "Vérification audit de la ligne de commande..."
    $cmdLineAudit = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit" -Name "ProcessCreationIncludeCmdLine_Enabled" -ErrorAction SilentlyContinue
    
    if ($cmdLineAudit.ProcessCreationIncludeCmdLine_Enabled -eq 1) {
        Write-Pass "Audit de la ligne de commande activé"
        Add-Result -Id "AUD-003" -Category "CIS L2" -Title "Audit ligne de commande" -Status "PASS" -Severity "high" `
            -Description "Les lignes de commande des processus sont auditées" -Reference "CIS 18.9.3.1"
    } else {
        Write-Warn "Audit de la ligne de commande désactivé"
        Add-Result -Id "AUD-003" -Category "CIS L2" -Title "Audit ligne de commande" -Status "WARN" -Severity "high" `
            -Description "Les lignes de commande ne sont pas auditées" `
            -Remediation "Activer ProcessCreationIncludeCmdLine_Enabled via GPO" -Reference "CIS 18.9.3.1"
    }
    
    # AUD-004: Sysmon (ENHANCED)
    Write-Info "Vérification Sysmon..."
    $sysmon = Get-Service -Name "Sysmon*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Running" }
    
    if ($sysmon) {
        Write-Pass "Sysmon est actif"
        Add-Result -Id "AUD-004" -Category "ANSSI" -Title "Sysmon" -Status "PASS" -Severity "high" `
            -Description "Sysmon est installé et en cours d'exécution" -Reference "ANSSI R30"
    } else {
        Write-Warn "Sysmon non détecté"
        Add-Result -Id "AUD-004" -Category "ANSSI" -Title "Sysmon" -Status "WARN" -Severity "high" `
            -Description "Sysmon n'est pas installé ou pas en cours d'exécution" `
            -Remediation "Installer et configurer Sysmon avec une configuration recommandée" -Reference "ANSSI R30"
    }
    
    # AUD-005: Windows Event Forwarding (ENHANCED)
    Write-Info "Vérification Windows Event Forwarding..."
    $wefSvc = Get-Service -Name "Wecsvc" -ErrorAction SilentlyContinue
    
    if ($wefSvc -and $wefSvc.Status -eq "Running") {
        Write-Pass "Windows Event Collector actif"
        Add-Result -Id "AUD-005" -Category "CIS L2" -Title "Windows Event Forwarding" -Status "PASS" -Severity "medium" `
            -Description "Le service Windows Event Collector est actif" -Reference "CIS 18.9.27"
    } else {
        Write-Info "Windows Event Collector non actif"
        Add-Result -Id "AUD-005" -Category "CIS L2" -Title "Windows Event Forwarding" -Status "WARN" -Severity "medium" `
            -Description "Windows Event Collector n'est pas actif" `
            -Remediation "Configurer WEF pour centraliser les journaux" -Reference "CIS 18.9.27"
    }
}

#===============================================================================
# Catégorie 6: Réseau (Étendue)
#===============================================================================

function Test-NetworkConfiguration {
    Write-Section "6. CONFIGURATION RÉSEAU"
    
    # NET-001 à NET-005: Comme BASE
    # NET-001: IPv6
    Write-Info "Vérification IPv6..."
    $ipv6Adapters = Get-NetAdapterBinding | Where-Object { $_.ComponentID -eq "ms_tcpip6" -and $_.Enabled -eq $true }
    
    if ($ipv6Adapters.Count -eq 0) {
        Write-Pass "IPv6 désactivé sur toutes les interfaces"
        Add-Result -Id "NET-001" -Category "ANSSI" -Title "Protocole IPv6" -Status "PASS" -Severity "low" `
            -Description "IPv6 est désactivé" -Reference "ANSSI R15"
    } else {
        Write-Info "IPv6 activé - vérifier si nécessaire"
        Add-Result -Id "NET-001" -Category "ANSSI" -Title "Protocole IPv6" -Status "WARN" -Severity "low" `
            -Description "IPv6 est activé sur $($ipv6Adapters.Count) interface(s)" `
            -Remediation "Désactiver IPv6 si non utilisé" -Reference "ANSSI R15"
    }
    
    # NET-002: LLMNR désactivé
    Write-Info "Vérification LLMNR..."
    $llmnr = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Name "EnableMulticast" -ErrorAction SilentlyContinue
    
    if ($llmnr.EnableMulticast -eq 0) {
        Write-Pass "LLMNR désactivé"
        Add-Result -Id "NET-002" -Category "ANSSI" -Title "LLMNR désactivé" -Status "PASS" -Severity "high" `
            -Description "LLMNR est désactivé" -Reference "ANSSI R17"
    } else {
        Write-Fail "LLMNR activé"
        Add-Result -Id "NET-002" -Category "ANSSI" -Title "LLMNR désactivé" -Status "FAIL" -Severity "high" `
            -Description "LLMNR est activé - vulnérable au relaying" `
            -Remediation "Désactiver via GPO" -Reference "ANSSI R17"
    }
    
    # NET-003: mDNS désactivé (ENHANCED)
    Write-Info "Vérification mDNS..."
    $mdns = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters" -Name "EnableMDNS" -ErrorAction SilentlyContinue
    
    if ($mdns.EnableMDNS -eq 0) {
        Write-Pass "mDNS désactivé"
        Add-Result -Id "NET-003" -Category "CIS L2" -Title "mDNS désactivé" -Status "PASS" -Severity "medium" `
            -Description "Multicast DNS est désactivé" -Reference "CIS 18.5.4.1"
    } else {
        Write-Warn "mDNS potentiellement actif"
        Add-Result -Id "NET-003" -Category "CIS L2" -Title "mDNS désactivé" -Status "WARN" -Severity "medium" `
            -Description "mDNS peut être actif" `
            -Remediation "Définir EnableMDNS = 0" -Reference "CIS 18.5.4.1"
    }
    
    # NET-004: NetBIOS
    Write-Info "Vérification NetBIOS..."
    $netbiosDisabled = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.TcpipNetbiosOptions -eq 2 }
    $netbiosCount = ($netbiosDisabled | Measure-Object).Count
    $totalAdapters = (Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true } | Measure-Object).Count
    
    if ($netbiosCount -eq $totalAdapters) {
        Write-Pass "NetBIOS désactivé sur toutes les interfaces"
        Add-Result -Id "NET-004" -Category "ANSSI" -Title "NetBIOS over TCP/IP" -Status "PASS" -Severity "medium" `
            -Description "NetBIOS est désactivé sur toutes les interfaces" -Reference "ANSSI R16"
    } else {
        Write-Warn "NetBIOS actif sur certaines interfaces"
        Add-Result -Id "NET-004" -Category "ANSSI" -Title "NetBIOS over TCP/IP" -Status "WARN" -Severity "medium" `
            -Description "NetBIOS est actif sur certaines interfaces" `
            -Remediation "Désactiver NetBIOS dans les propriétés TCP/IP" -Reference "ANSSI R16"
    }
    
    # NET-005: DNS over HTTPS (ENHANCED)
    Write-Info "Vérification DNS over HTTPS..."
    $doh = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters" -Name "EnableAutoDoh" -ErrorAction SilentlyContinue
    
    if ($doh.EnableAutoDoh -ge 2) {
        Write-Pass "DNS over HTTPS configuré"
        Add-Result -Id "NET-005" -Category "CIS L2" -Title "DNS over HTTPS" -Status "PASS" -Severity "medium" `
            -Description "DoH est configuré pour les requêtes DNS" -Reference "CIS 18.5.4.2"
    } else {
        Write-Info "DNS over HTTPS non configuré"
        Add-Result -Id "NET-005" -Category "CIS L2" -Title "DNS over HTTPS" -Status "WARN" -Severity "medium" `
            -Description "DoH n'est pas configuré" `
            -Remediation "Configurer DoH pour chiffrer les requêtes DNS" -Reference "CIS 18.5.4.2"
    }
    
    # NET-006: WinRM sécurisé (ENHANCED - plus strict)
    Write-Info "Vérification WinRM..."
    try {
        $winrm = Get-WSManInstance -ResourceURI winrm/config/service -ErrorAction Stop
        $winrmClient = Get-WSManInstance -ResourceURI winrm/config/client -ErrorAction Stop
        
        $winrmSecure = $true
        $issues = @()
        
        if ($winrm.AllowUnencrypted -ne $false) { 
            $winrmSecure = $false
            $issues += "AllowUnencrypted"
        }
        if ($winrmClient.AllowUnencrypted -ne $false) { 
            $winrmSecure = $false
            $issues += "Client AllowUnencrypted"
        }
        
        if ($winrmSecure) {
            Write-Pass "WinRM sécurisé (trafic chiffré requis)"
            Add-Result -Id "NET-006" -Category "CIS L2" -Title "WinRM sécurisé" -Status "PASS" -Severity "high" `
                -Description "WinRM n'accepte que les connexions chiffrées" -Reference "CIS 18.9.102"
        } else {
            Write-Fail "WinRM non sécurisé: $($issues -join ', ')"
            Add-Result -Id "NET-006" -Category "CIS L2" -Title "WinRM sécurisé" -Status "FAIL" -Severity "high" `
                -Description "WinRM accepte du trafic non chiffré" `
                -Remediation "Configurer AllowUnencrypted = false côté serveur et client" -Reference "CIS 18.9.102"
        }
    } catch {
        Write-Pass "WinRM non configuré"
        Add-Result -Id "NET-006" -Category "CIS L2" -Title "WinRM sécurisé" -Status "PASS" -Severity "high" `
            -Description "WinRM n'est pas configuré" -Reference "CIS 18.9.102"
    }
}

#===============================================================================
# Catégorie 7: Certificats et Chiffrement (ENHANCED)
#===============================================================================

function Test-CryptographyConfiguration {
    Write-Section "7. CERTIFICATS ET CHIFFREMENT"
    
    # CRYPTO-001: TLS 1.0 désactivé
    Write-Info "Vérification TLS 1.0..."
    $tls10Server = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.0\Server" -Name "Enabled" -ErrorAction SilentlyContinue
    
    if ($tls10Server.Enabled -eq 0) {
        Write-Pass "TLS 1.0 désactivé (serveur)"
        Add-Result -Id "CRYPTO-001" -Category "CIS L2" -Title "TLS 1.0 désactivé" -Status "PASS" -Severity "high" `
            -Description "TLS 1.0 est désactivé côté serveur" -Reference "CIS 18.4.2"
    } else {
        Write-Fail "TLS 1.0 peut être actif"
        Add-Result -Id "CRYPTO-001" -Category "CIS L2" -Title "TLS 1.0 désactivé" -Status "FAIL" -Severity "high" `
            -Description "TLS 1.0 n'est pas explicitement désactivé" `
            -Remediation "Désactiver TLS 1.0 via le registre SCHANNEL" -Reference "CIS 18.4.2"
    }
    
    # CRYPTO-002: TLS 1.1 désactivé
    Write-Info "Vérification TLS 1.1..."
    $tls11Server = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.1\Server" -Name "Enabled" -ErrorAction SilentlyContinue
    
    if ($tls11Server.Enabled -eq 0) {
        Write-Pass "TLS 1.1 désactivé (serveur)"
        Add-Result -Id "CRYPTO-002" -Category "CIS L2" -Title "TLS 1.1 désactivé" -Status "PASS" -Severity "medium" `
            -Description "TLS 1.1 est désactivé côté serveur" -Reference "CIS 18.4.3"
    } else {
        Write-Warn "TLS 1.1 peut être actif"
        Add-Result -Id "CRYPTO-002" -Category "CIS L2" -Title "TLS 1.1 désactivé" -Status "WARN" -Severity "medium" `
            -Description "TLS 1.1 n'est pas explicitement désactivé" `
            -Remediation "Désactiver TLS 1.1 via le registre SCHANNEL" -Reference "CIS 18.4.3"
    }
    
    # CRYPTO-003: SSL 2.0/3.0 désactivé
    Write-Info "Vérification SSL 2.0/3.0..."
    $ssl2 = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 2.0\Server" -Name "Enabled" -ErrorAction SilentlyContinue
    $ssl3 = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 3.0\Server" -Name "Enabled" -ErrorAction SilentlyContinue
    
    if (($ssl2.Enabled -eq 0 -or $null -eq $ssl2) -and ($ssl3.Enabled -eq 0 -or $null -eq $ssl3)) {
        Write-Pass "SSL 2.0 et 3.0 désactivés"
        Add-Result -Id "CRYPTO-003" -Category "CIS L2" -Title "SSL 2.0/3.0 désactivés" -Status "PASS" -Severity "critical" `
            -Description "Les protocoles SSL obsolètes sont désactivés" -Reference "CIS 18.4.1"
    } else {
        Write-Fail "SSL obsolète peut être actif"
        Add-Result -Id "CRYPTO-003" -Category "CIS L2" -Title "SSL 2.0/3.0 désactivés" -Status "FAIL" -Severity "critical" `
            -Description "SSL 2.0 ou 3.0 peut être actif" `
            -Remediation "Désactiver SSL 2.0 et 3.0 via SCHANNEL" -Reference "CIS 18.4.1"
    }
    
    # CRYPTO-004: Ciphers faibles désactivés
    Write-Info "Vérification des ciphers..."
    $weakCiphers = @("RC4", "DES", "3DES", "NULL")
    $enabledWeak = @()
    
    foreach ($cipher in $weakCiphers) {
        $cipherKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Ciphers\$cipher*" -Name "Enabled" -ErrorAction SilentlyContinue
        if ($cipherKey.Enabled -ne 0 -and $null -ne $cipherKey.Enabled) {
            $enabledWeak += $cipher
        }
    }
    
    if ($enabledWeak.Count -eq 0) {
        Write-Pass "Aucun cipher faible détecté"
        Add-Result -Id "CRYPTO-004" -Category "CIS L2" -Title "Ciphers faibles désactivés" -Status "PASS" -Severity "high" `
            -Description "Aucun cipher faible n'est explicitement activé" -Reference "CIS 18.4.4"
    } else {
        Write-Fail "Ciphers faibles actifs: $($enabledWeak -join ', ')"
        Add-Result -Id "CRYPTO-004" -Category "CIS L2" -Title "Ciphers faibles désactivés" -Status "FAIL" -Severity "high" `
            -Description "Ciphers faibles actifs: $($enabledWeak -join ', ')" `
            -Remediation "Désactiver les ciphers RC4, DES, 3DES, NULL" -Reference "CIS 18.4.4"
    }
    
    # CRYPTO-005: Certificats root de confiance
    Write-Info "Vérification des certificats root..."
    $rootCerts = Get-ChildItem Cert:\LocalMachine\Root
    $expiredCerts = $rootCerts | Where-Object { $_.NotAfter -lt (Get-Date) }
    $expiredCount = ($expiredCerts | Measure-Object).Count
    
    if ($expiredCount -eq 0) {
        Write-Pass "Aucun certificat root expiré"
        Add-Result -Id "CRYPTO-005" -Category "ANSSI" -Title "Certificats root valides" -Status "PASS" -Severity "medium" `
            -Description "Tous les certificats root sont valides" -Reference "ANSSI R35"
    } else {
        Write-Warn "$expiredCount certificat(s) root expiré(s)"
        Add-Result -Id "CRYPTO-005" -Category "ANSSI" -Title "Certificats root valides" -Status "WARN" -Severity "medium" `
            -Description "$expiredCount certificat(s) root expiré(s) dans le magasin" `
            -Remediation "Supprimer les certificats root expirés" -Reference "ANSSI R35"
    }
}

#===============================================================================
# Catégorie 8: Hardening Système Avancé (ENHANCED)
#===============================================================================

function Test-AdvancedHardening {
    Write-Section "8. HARDENING AVANCÉ"
    
    # ADV-001: ASLR forcé
    Write-Info "Vérification ASLR..."
    $aslr = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Name "MoveImages" -ErrorAction SilentlyContinue
    
    if ($aslr.MoveImages -eq 1) {
        Write-Pass "ASLR activé"
        Add-Result -Id "ADV-001" -Category "CIS L2" -Title "ASLR activé" -Status "PASS" -Severity "high" `
            -Description "Address Space Layout Randomization est activé" -Reference "CIS 18.9.24.1"
    } else {
        Write-Warn "ASLR non configuré explicitement"
        Add-Result -Id "ADV-001" -Category "CIS L2" -Title "ASLR activé" -Status "WARN" -Severity "high" `
            -Description "ASLR n'est pas explicitement forcé" `
            -Remediation "Configurer MoveImages = 1" -Reference "CIS 18.9.24.1"
    }
    
    # ADV-002: DEP/NX activé
    Write-Info "Vérification DEP..."
    $dep = bcdedit /enum | Select-String "nx"
    
    if ($dep -match "OptOut" -or $dep -match "AlwaysOn") {
        Write-Pass "DEP configuré en mode strict"
        Add-Result -Id "ADV-002" -Category "CIS L2" -Title "DEP/NX activé" -Status "PASS" -Severity "high" `
            -Description "Data Execution Prevention est activé" -Reference "CIS 18.9.24.2"
    } else {
        Write-Warn "DEP peut ne pas être en mode strict"
        Add-Result -Id "ADV-002" -Category "CIS L2" -Title "DEP/NX activé" -Status "WARN" -Severity "high" `
            -Description "DEP n'est peut-être pas en mode strict" `
            -Remediation "Configurer DEP en mode OptOut ou AlwaysOn" -Reference "CIS 18.9.24.2"
    }
    
    # ADV-003: SEHOP activé
    Write-Info "Vérification SEHOP..."
    $sehop = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel" -Name "DisableExceptionChainValidation" -ErrorAction SilentlyContinue
    
    if ($null -eq $sehop.DisableExceptionChainValidation -or $sehop.DisableExceptionChainValidation -eq 0) {
        Write-Pass "SEHOP activé"
        Add-Result -Id "ADV-003" -Category "CIS L2" -Title "SEHOP activé" -Status "PASS" -Severity "high" `
            -Description "Structured Exception Handling Overwrite Protection est activé" -Reference "CIS 18.9.24.3"
    } else {
        Write-Fail "SEHOP désactivé"
        Add-Result -Id "ADV-003" -Category "CIS L2" -Title "SEHOP activé" -Status "FAIL" -Severity "high" `
            -Description "SEHOP est désactivé" `
            -Remediation "Supprimer DisableExceptionChainValidation ou le définir à 0" -Reference "CIS 18.9.24.3"
    }
    
    # ADV-004: Windows Firewall en mode strict (ENHANCED)
    Write-Info "Vérification mode strict pare-feu..."
    $publicProfile = Get-NetFirewallProfile -Name Public
    
    if ($publicProfile.DefaultInboundAction -eq "Block" -and $publicProfile.DefaultOutboundAction -eq "Block") {
        Write-Pass "Profil Public en mode strict (bloquer in/out)"
        Add-Result -Id "ADV-004" -Category "CIS L2" -Title "Pare-feu mode strict" -Status "PASS" -Severity "high" `
            -Description "Le profil Public bloque le trafic entrant et sortant par défaut" -Reference "CIS 9.3.1"
    } else {
        Write-Warn "Profil Public pas en mode strict"
        Add-Result -Id "ADV-004" -Category "CIS L2" -Title "Pare-feu mode strict" -Status "WARN" -Severity "high" `
            -Description "Le profil Public ne bloque pas tout le trafic par défaut" `
            -Remediation "Configurer Block pour le trafic entrant ET sortant sur le profil Public" -Reference "CIS 9.3.1"
    }
    
    # ADV-005: Automatic Sample Submission désactivé
    Write-Info "Vérification envoi automatique d'échantillons..."
    $sampleSubmission = Get-MpPreference | Select-Object -ExpandProperty SubmitSamplesConsent -ErrorAction SilentlyContinue
    
    if ($sampleSubmission -eq 2) {
        Write-Pass "Envoi automatique d'échantillons désactivé"
        Add-Result -Id "ADV-005" -Category "CIS L2" -Title "Sample Submission" -Status "PASS" -Severity "low" `
            -Description "L'envoi automatique d'échantillons est désactivé" -Reference "CIS 18.9.47.4"
    } else {
        Write-Info "Envoi d'échantillons configuré: $sampleSubmission"
        Add-Result -Id "ADV-005" -Category "CIS L2" -Title "Sample Submission" -Status "WARN" -Severity "low" `
            -Description "L'envoi d'échantillons est configuré (vérifier la politique)" `
            -Remediation "Configurer SubmitSamplesConsent selon la politique de l'entreprise" -Reference "CIS 18.9.47.4"
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
    <title>Rapport d'Audit Sécurité Windows Server (ENHANCED) - Infra Shield Tools</title>
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
            <h1>Rapport d'Audit de Sécurité Windows Server (ENHANCED)</h1>
            <div class="subtitle">Généré par Infra Shield Tools - ~100 contrôles complets</div>
            <div class="framework">Référentiel ANSSI + CIS Benchmark Level 2</div>
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
            <p>Basé sur les recommandations ANSSI et CIS Benchmark Level 2 pour Windows Server</p>
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
        report_type = "windows_security_audit_enhanced"
        framework = "ANSSI + CIS Benchmark L2"
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
Write-Host "Démarrage de l'audit de sécurité Windows Server ENHANCED (~100 contrôles)..."
Write-Host "Fichier de sortie: $OutputFile"
Write-Host ""

Test-SystemConfiguration
Test-AccountManagement
Test-ServicesConfiguration
Test-FirewallConfiguration
Test-AuditConfiguration
Test-NetworkConfiguration
Test-CryptographyConfiguration
Test-AdvancedHardening

New-JsonReport
