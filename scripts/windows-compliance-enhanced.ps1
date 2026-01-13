#===============================================================================
# Infra Shield Tools - Script d'Audit de Securite Windows Server (ENHANCED)
# Base sur les recommandations ANSSI et CIS Benchmark Level 2
# Version: 1.0.0
# Niveau: ENHANCED (~100 controles complets)
# 
# Ce script effectue un audit de securite renforce d'un systeme Windows Server
# couvrant l'integralite des recommandations ANSSI et CIS Benchmark Level 2
#
# Usage: .\windows-compliance-enhanced.ps1 [-OutputFile <fichier>] [-Verbose]
#
# Licence: Proprietaire Infra Shield Tools
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
    Write-Host "+====================================================================+" -ForegroundColor Cyan
    Write-Host "|                                                                    |" -ForegroundColor Cyan
    Write-Host "|   Infra Shield Tools - Audit Windows Server v$Version (ENHANCED)   |" -ForegroundColor Cyan
    Write-Host "|            ANSSI + CIS Benchmark Level 2                           |" -ForegroundColor Cyan
    Write-Host "|               ~100 controles complets                              |" -ForegroundColor Cyan
    Write-Host "|                                                                    |" -ForegroundColor Cyan
    Write-Host "+====================================================================+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "---------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  $Title" -ForegroundColor White
    Write-Host "---------------------------------------------------------------------" -ForegroundColor DarkGray
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
# Categorie 1: Configuration du Systeme (Etendue)
#===============================================================================

function Test-SystemConfiguration {
    Write-Section "1. CONFIGURATION DU SYSTEME"
    
    # SYS-001: Verification du niveau de patch Windows Update
    Write-Info "Verification des mises a jour Windows..."
    try {
        $lastUpdate = Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1
        $daysSinceUpdate = ((Get-Date) - $lastUpdate.InstalledOn).Days
        
        if ($daysSinceUpdate -le 30) {
            Write-Pass "Derniere mise a jour: $($lastUpdate.HotFixID) il y a $($daysSinceUpdate) jours"
            Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises a jour systeme" -Status "PASS" -Severity "critical" `
                -Description "Systeme mis a jour recemment (il y a $($daysSinceUpdate) jours)" -Reference "ANSSI R1"
        } elseif ($daysSinceUpdate -le 90) {
            Write-Warn "Derniere mise a jour il y a $($daysSinceUpdate) jours"
            Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises a jour systeme" -Status "WARN" -Severity "critical" `
                -Description "Derniere mise a jour il y a $($daysSinceUpdate) jours" `
                -Remediation "Executer Windows Update pour installer les dernieres mises a jour de securite" -Reference "ANSSI R1"
        } else {
            Write-Fail "Systeme non mis a jour depuis $($daysSinceUpdate) jours"
            Add-Result -Id "SYS-001" -Category "ANSSI" -Title "Mises a jour systeme" -Status "FAIL" -Severity "critical" `
                -Description "Systeme non mis a jour depuis $($daysSinceUpdate) jours" `
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
    
    # SYS-008: Credential Guard (ENHANCED)
    Write-Info "Verification Credential Guard..."
    try {
        $credGuard = Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard -ErrorAction Stop
        if ($credGuard.SecurityServicesRunning -contains 1) {
            Write-Pass "Credential Guard active"
            Add-Result -Id "SYS-008" -Category "CIS L2" -Title "Credential Guard" -Status "PASS" -Severity "high" `
                -Description "Windows Defender Credential Guard est actif" -Reference "CIS 18.9.5.1"
        } else {
            Write-Warn "Credential Guard non actif"
            Add-Result -Id "SYS-008" -Category "CIS L2" -Title "Credential Guard" -Status "WARN" -Severity "high" `
                -Description "Credential Guard n'est pas en cours d'execution" `
                -Remediation "Activer Credential Guard via GPO ou UEFI" -Reference "CIS 18.9.5.1"
        }
    } catch {
        Write-Info "Credential Guard non disponible"
        Add-Result -Id "SYS-008" -Category "CIS L2" -Title "Credential Guard" -Status "WARN" -Severity "high" `
            -Description "Credential Guard non disponible sur ce systeme" `
            -Remediation "Verifier la compatibilite materielle pour Credential Guard" -Reference "CIS 18.9.5.1"
    }
    
    # SYS-009: Device Guard (ENHANCED)
    Write-Info "Verification Device Guard..."
    try {
        $deviceGuard = Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard -ErrorAction Stop
        if ($deviceGuard.VirtualizationBasedSecurityStatus -eq 2) {
            Write-Pass "Device Guard/VBS active"
            Add-Result -Id "SYS-009" -Category "CIS L2" -Title "Virtualization Based Security" -Status "PASS" -Severity "high" `
                -Description "VBS (Virtualization Based Security) est active" -Reference "CIS 18.9.5.2"
        } else {
            Write-Warn "VBS non actif"
            Add-Result -Id "SYS-009" -Category "CIS L2" -Title "Virtualization Based Security" -Status "WARN" -Severity "high" `
                -Description "VBS n'est pas active" `
                -Remediation "Activer VBS via GPO et configuration UEFI" -Reference "CIS 18.9.5.2"
        }
    } catch {
        Write-Info "Device Guard non disponible"
    }
    
    # SYS-010: LSASS Protection (ENHANCED)
    Write-Info "Verification protection LSASS..."
    $lsassKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa" -Name "RunAsPPL" -ErrorAction SilentlyContinue
    
    if ($lsassKey.RunAsPPL -eq 1) {
        Write-Pass "LSASS s'execute en mode protege (PPL)"
        Add-Result -Id "SYS-010" -Category "CIS L2" -Title "Protection LSASS" -Status "PASS" -Severity "critical" `
            -Description "LSASS s'execute en Protected Process Light (PPL)" -Reference "CIS 18.3.1"
    } else {
        Write-Fail "LSASS non protege"
        Add-Result -Id "SYS-010" -Category "CIS L2" -Title "Protection LSASS" -Status "FAIL" -Severity "critical" `
            -Description "LSASS n'est pas protege - vulnerable au credential dumping" `
            -Remediation "Configurer RunAsPPL = 1 dans HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" -Reference "CIS 18.3.1"
    }
    
    # SYS-011: WDigest desactive (ENHANCED)
    Write-Info "Verification WDigest..."
    $wdigestKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest" -Name "UseLogonCredential" -ErrorAction SilentlyContinue
    
    if ($null -eq $wdigestKey.UseLogonCredential -or $wdigestKey.UseLogonCredential -eq 0) {
        Write-Pass "WDigest desactive"
        Add-Result -Id "SYS-011" -Category "ANSSI" -Title "WDigest desactive" -Status "PASS" -Severity "critical" `
            -Description "Le stockage WDigest des credentials est desactive" -Reference "ANSSI R25"
    } else {
        Write-Fail "WDigest active - credentials en clair en memoire"
        Add-Result -Id "SYS-011" -Category "ANSSI" -Title "WDigest desactive" -Status "FAIL" -Severity "critical" `
            -Description "WDigest stocke les credentials en clair en memoire" `
            -Remediation "Definir UseLogonCredential = 0" -Reference "ANSSI R25"
    }
}

#===============================================================================
# Categorie 2: Gestion des Comptes (Etendue)
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
    
    # ACC-003 a ACC-007: Politique de mot de passe (meme que BASE)
    Write-Info "Verification de la politique de mots de passe..."
    $secpol = secedit /export /cfg "$env:TEMP\secpol.cfg" 2>$null
    $secpolContent = Get-Content "$env:TEMP\secpol.cfg" -ErrorAction SilentlyContinue
    
    $minPwdLen = ($secpolContent | Select-String "MinimumPasswordLength").ToString().Split("=")[1].Trim()
    if ([int]$($minPwdLen) -ge 14) {
        Write-Pass "Longueur minimale du mot de passe: $($minPwdLen) caracteres"
        Add-Result -Id "ACC-003" -Category "ANSSI" -Title "Longueur minimale du mot de passe" -Status "PASS" -Severity "high" `
            -Description "Longueur minimale configuree a $($minPwdLen) caracteres" -Reference "ANSSI R20"
    } elseif ([int]$($minPwdLen) -ge 8) {
        Write-Warn "Longueur minimale du mot de passe: $($minPwdLen) caracteres (recommande: 14)"
        Add-Result -Id "ACC-003" -Category "ANSSI" -Title "Longueur minimale du mot de passe" -Status "WARN" -Severity "high" `
            -Description "Longueur minimale de $($minPwdLen) caracteres (recommande: 14)" `
            -Remediation "Augmenter la longueur minimale a 14 caracteres via GPO" -Reference "ANSSI R20"
    } else {
        Write-Fail "Longueur minimale du mot de passe insuffisante: $($minPwdLen)"
        Add-Result -Id "ACC-003" -Category "ANSSI" -Title "Longueur minimale du mot de passe" -Status "FAIL" -Severity "high" `
            -Description "Longueur minimale de seulement $($minPwdLen) caracteres" `
            -Remediation "Configurer une longueur minimale de 14 caracteres" -Reference "ANSSI R20"
    }
    
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
    
    $lockoutThreshold = ($secpolContent | Select-String "LockoutBadCount").ToString().Split("=")[1].Trim()
    if ([int]$($lockoutThreshold) -gt 0 -and [int]$($lockoutThreshold) -le 5) {
        Write-Pass "Verrouillage apres $($lockoutThreshold) tentatives echouees"
        Add-Result -Id "ACC-005" -Category "CIS" -Title "Seuil de verrouillage de compte" -Status "PASS" -Severity "high" `
            -Description "Verrouillage configure apres $($lockoutThreshold) tentatives" -Reference "CIS 1.2.1"
    } elseif ([int]$($lockoutThreshold) -gt 5) {
        Write-Warn "Seuil de verrouillage trop eleve: $($lockoutThreshold)"
        Add-Result -Id "ACC-005" -Category "CIS" -Title "Seuil de verrouillage de compte" -Status "WARN" -Severity "high" `
            -Description "Seuil de verrouillage trop permissif ($lockoutThreshold tentatives)" `
            -Remediation "Reduire le seuil a 5 tentatives maximum" -Reference "CIS 1.2.1"
    } else {
        Write-Fail "Verrouillage de compte non configure"
        Add-Result -Id "ACC-005" -Category "CIS" -Title "Seuil de verrouillage de compte" -Status "FAIL" -Severity "high" `
            -Description "Aucun verrouillage de compte configure" `
            -Remediation "Configurer un seuil de 5 tentatives maximum" -Reference "CIS 1.2.1"
    }
    
    Remove-Item "$env:TEMP\secpol.cfg" -Force -ErrorAction SilentlyContinue
    
    # ACC-008: NTLM restrictions (ENHANCED)
    Write-Info "Verification restrictions NTLM..."
    $ntlmKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa\MSV1_0" -Name "RestrictSendingNTLMTraffic" -ErrorAction SilentlyContinue
    
    if ($ntlmKey.RestrictSendingNTLMTraffic -ge 1) {
        Write-Pass "Restrictions NTLM configurees"
        Add-Result -Id "ACC-008" -Category "CIS L2" -Title "Restrictions NTLM" -Status "PASS" -Severity "high" `
            -Description "Le trafic NTLM sortant est restreint" -Reference "CIS 2.3.11.9"
    } else {
        Write-Warn "NTLM non restreint"
        Add-Result -Id "ACC-008" -Category "CIS L2" -Title "Restrictions NTLM" -Status "WARN" -Severity "high" `
            -Description "Le trafic NTLM n'est pas restreint" `
            -Remediation "Configurer les restrictions NTLM via GPO" -Reference "CIS 2.3.11.9"
    }
    
    # ACC-009: LAN Manager Hash desactive (ENHANCED)
    Write-Info "Verification stockage LM Hash..."
    $lmHashKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa" -Name "NoLMHash" -ErrorAction SilentlyContinue
    
    if ($lmHashKey.NoLMHash -eq 1) {
        Write-Pass "Stockage LM Hash desactive"
        Add-Result -Id "ACC-009" -Category "CIS L2" -Title "LM Hash desactive" -Status "PASS" -Severity "high" `
            -Description "Le stockage des hash LAN Manager est desactive" -Reference "CIS 2.3.11.5"
    } else {
        Write-Fail "LM Hash peut etre stocke"
        Add-Result -Id "ACC-009" -Category "CIS L2" -Title "LM Hash desactive" -Status "FAIL" -Severity "high" `
            -Description "Les hash LM peuvent etre stockes (vulnerable)" `
            -Remediation "Definir NoLMHash = 1 dans HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" -Reference "CIS 2.3.11.5"
    }
    
    # ACC-010: Audit des comptes de service (ENHANCED)
    Write-Info "Verification des comptes de service..."
    $serviceAccounts = Get-CimInstance Win32_Service | Where-Object { 
        $_.StartName -ne "LocalSystem" -and 
        $_.StartName -ne "NT AUTHORITY\LocalService" -and 
        $_.StartName -ne "NT AUTHORITY\NetworkService" -and
        $_.StartName -ne $null
    }
    
    $customServiceCount = ($serviceAccounts | Measure-Object).Count
    if ($customServiceCount -eq 0) {
        Write-Pass "Aucun compte de service personnalise detecte"
        Add-Result -Id "ACC-010" -Category "ANSSI" -Title "Comptes de service" -Status "PASS" -Severity "medium" `
            -Description "Tous les services utilisent des comptes systeme integres" -Reference "ANSSI R22"
    } else {
        Write-Info "$customServiceCount services avec comptes personnalises"
        Add-Result -Id "ACC-010" -Category "ANSSI" -Title "Comptes de service" -Status "WARN" -Severity "medium" `
            -Description "$customServiceCount services utilisent des comptes personnalises - a auditer" `
            -Remediation "Verifier les privileges des comptes de service personnalises" -Reference "ANSSI R22"
    }
}

#===============================================================================
# Categorie 3: Services et Applications (Etendue)
#===============================================================================

function Test-ServicesConfiguration {
    Write-Section "3. SERVICES ET APPLICATIONS"
    
    # SVC-001 a SVC-006: Meme que BASE
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
    
    # SVC-002: Windows Defender
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
        Write-Warn "Windows Defender non disponible"
        Add-Result -Id "SVC-002" -Category "ANSSI" -Title "Antivirus Windows Defender" -Status "WARN" -Severity "critical" `
            -Description "Windows Defender non disponible - verifier qu'un antivirus est installe" `
            -Remediation "S'assurer qu'une solution antivirus est active" -Reference "ANSSI R4"
    }
    
    # SVC-003: SMBv1 desactive
    Write-Info "Verification SMBv1..."
    try {
        $smb1 = Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -ErrorAction Stop
        
        if ($smb1.State -eq "Disabled") {
            Write-Pass "SMBv1 desactive"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Protocole SMBv1 desactive" -Status "PASS" -Severity "critical" `
                -Description "Le protocole SMBv1 vulnerable est desactive" -Reference "ANSSI R12"
        } else {
            Write-Fail "SMBv1 active - vulnerabilite critique"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Protocole SMBv1 desactive" -Status "FAIL" -Severity "critical" `
                -Description "SMBv1 est active - vulnerable a EternalBlue/WannaCry" `
                -Remediation "Disable-WindowsOptionalFeature -FeatureName SMB1Protocol" -Reference "ANSSI R12"
        }
    } catch {
        $smb1Config = Get-SmbServerConfiguration | Select-Object EnableSMB1Protocol
        if (-not $smb1Config.EnableSMB1Protocol) {
            Write-Pass "SMBv1 desactive"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Protocole SMBv1 desactive" -Status "PASS" -Severity "critical" `
                -Description "Le protocole SMBv1 est desactive" -Reference "ANSSI R12"
        } else {
            Write-Fail "SMBv1 active"
            Add-Result -Id "SVC-003" -Category "ANSSI" -Title "Protocole SMBv1 desactive" -Status "FAIL" -Severity "critical" `
                -Description "SMBv1 est active" `
                -Remediation "Set-SmbServerConfiguration -EnableSMB1Protocol $false" -Reference "ANSSI R12"
        }
    }
    
    # SVC-004: SMB Signing (ENHANCED)
    Write-Info "Verification SMB Signing..."
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
    Write-Info "Verification SMB Encryption..."
    if ($smbConfig.EncryptData) {
        Write-Pass "SMB Encryption active"
        Add-Result -Id "SVC-005" -Category "CIS L2" -Title "SMB Encryption" -Status "PASS" -Severity "high" `
            -Description "Le chiffrement SMB est active" -Reference "CIS 2.3.9.5"
    } else {
        Write-Warn "SMB Encryption non active"
        Add-Result -Id "SVC-005" -Category "CIS L2" -Title "SMB Encryption" -Status "WARN" -Severity "high" `
            -Description "Le chiffrement SMB n'est pas active" `
            -Remediation "Set-SmbServerConfiguration -EncryptData $true" -Reference "CIS 2.3.9.5"
    }
    
    # SVC-006: Print Spooler
    Write-Info "Verification Print Spooler..."
    $spooler = Get-Service -Name "Spooler" -ErrorAction SilentlyContinue
    
    if (-not $spooler -or $spooler.Status -ne "Running") {
        Write-Pass "Print Spooler desactive"
        Add-Result -Id "SVC-006" -Category "ANSSI" -Title "Service Print Spooler" -Status "PASS" -Severity "critical" `
            -Description "Print Spooler desactive (protection PrintNightmare)" -Reference "ANSSI R5"
    } else {
        Write-Warn "Print Spooler actif"
        Add-Result -Id "SVC-006" -Category "ANSSI" -Title "Service Print Spooler" -Status "WARN" -Severity "critical" `
            -Description "Print Spooler actif - verifier les correctifs PrintNightmare" `
            -Remediation "Stop-Service Spooler; Set-Service Spooler -StartupType Disabled" -Reference "ANSSI R5"
    }
    
    # SVC-007: PowerShell Logging (ENHANCED)
    Write-Info "Verification logging PowerShell complet..."
    $psLogging = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging" -ErrorAction SilentlyContinue
    $psTranscription = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\Transcription" -ErrorAction SilentlyContinue
    $psModuleLogging = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ModuleLogging" -ErrorAction SilentlyContinue
    
    $loggingScore = 0
    if ($psLogging.EnableScriptBlockLogging -eq 1) { $loggingScore++ }
    if ($psTranscription.EnableTranscripting -eq 1) { $loggingScore++ }
    if ($psModuleLogging.EnableModuleLogging -eq 1) { $loggingScore++ }
    
    if ($loggingScore -eq 3) {
        Write-Pass "Logging PowerShell complet active"
        Add-Result -Id "SVC-007" -Category "CIS L2" -Title "Logging PowerShell complet" -Status "PASS" -Severity "high" `
            -Description "Script Block, Transcription et Module Logging sont actives" -Reference "CIS 18.9.97"
    } elseif ($loggingScore -gt 0) {
        Write-Warn "Logging PowerShell partiel ($loggingScore/3)"
        Add-Result -Id "SVC-007" -Category "CIS L2" -Title "Logging PowerShell complet" -Status "WARN" -Severity "high" `
            -Description "Seulement $loggingScore/3 types de logging PowerShell actives" `
            -Remediation "Activer tous les types de logging PowerShell via GPO" -Reference "CIS 18.9.97"
    } else {
        Write-Fail "Logging PowerShell desactive"
        Add-Result -Id "SVC-007" -Category "CIS L2" -Title "Logging PowerShell complet" -Status "FAIL" -Severity "high" `
            -Description "Aucun logging PowerShell configure" `
            -Remediation "Configurer Script Block Logging, Transcription et Module Logging" -Reference "CIS 18.9.97"
    }
    
    # SVC-008: PowerShell Constrained Language Mode (ENHANCED)
    Write-Info "Verification mode langage PowerShell..."
    $languageMode = $ExecutionContext.SessionState.LanguageMode
    
    if ($languageMode -eq "ConstrainedLanguage") {
        Write-Pass "PowerShell en mode Constrained Language"
        Add-Result -Id "SVC-008" -Category "CIS L2" -Title "PowerShell Constrained Mode" -Status "PASS" -Severity "medium" `
            -Description "PowerShell s'execute en mode Constrained Language" -Reference "CIS 18.9.97.1"
    } else {
        Write-Info "PowerShell en mode $languageMode"
        Add-Result -Id "SVC-008" -Category "CIS L2" -Title "PowerShell Constrained Mode" -Status "WARN" -Severity "medium" `
            -Description "PowerShell en mode $languageMode (Constrained recommande)" `
            -Remediation "Configurer Constrained Language Mode via AppLocker/WDAC" -Reference "CIS 18.9.97.1"
    }
    
    # SVC-009: AppLocker/WDAC (ENHANCED)
    Write-Info "Verification AppLocker..."
    $applockerSvc = Get-Service -Name "AppIDSvc" -ErrorAction SilentlyContinue
    
    if ($applockerSvc -and $applockerSvc.Status -eq "Running") {
        Write-Pass "AppLocker est actif"
        Add-Result -Id "SVC-009" -Category "CIS L2" -Title "AppLocker" -Status "PASS" -Severity "high" `
            -Description "Le service AppLocker est en cours d'execution" -Reference "CIS 18.9.65"
    } else {
        Write-Warn "AppLocker non actif"
        Add-Result -Id "SVC-009" -Category "CIS L2" -Title "AppLocker" -Status "WARN" -Severity "high" `
            -Description "AppLocker n'est pas en cours d'execution" `
            -Remediation "Configurer et activer AppLocker pour le controle d'applications" -Reference "CIS 18.9.65"
    }
    
    # SVC-010: Windows Defender ASR Rules (ENHANCED)
    Write-Info "Verification regles ASR..."
    try {
        $asrRules = Get-MpPreference | Select-Object -ExpandProperty AttackSurfaceReductionRules_Ids -ErrorAction Stop
        $asrRulesCount = ($asrRules | Measure-Object).Count
        
        if ($asrRulesCount -ge 10) {
            Write-Pass "$asrRulesCount regles ASR configurees"
            Add-Result -Id "SVC-010" -Category "CIS L2" -Title "Attack Surface Reduction" -Status "PASS" -Severity "high" `
                -Description "$asrRulesCount regles ASR sont configurees" -Reference "CIS 18.9.47"
        } elseif ($asrRulesCount -gt 0) {
            Write-Warn "$asrRulesCount regles ASR (recommande: 10+)"
            Add-Result -Id "SVC-010" -Category "CIS L2" -Title "Attack Surface Reduction" -Status "WARN" -Severity "high" `
                -Description "Seulement $asrRulesCount regles ASR configurees" `
                -Remediation "Ajouter les regles ASR recommandees via GPO ou Intune" -Reference "CIS 18.9.47"
        } else {
            Write-Fail "Aucune regle ASR configuree"
            Add-Result -Id "SVC-010" -Category "CIS L2" -Title "Attack Surface Reduction" -Status "FAIL" -Severity "high" `
                -Description "Aucune regle Attack Surface Reduction configuree" `
                -Remediation "Configurer les regles ASR pour reduire la surface d'attaque" -Reference "CIS 18.9.47"
        }
    } catch {
        Write-Info "Impossible de verifier les regles ASR"
    }
}

#===============================================================================
# Categorie 4: Pare-feu Windows (Etendue)
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
            -Remediation "Set-NetFirewallProfile -All -Enabled True" -Reference "CIS 9.1.1"
    }
    
    # FW-002: Action par defaut
    Write-Info "Verification de l'action par defaut du pare-feu..."
    $allBlock = $true
    foreach ($profile in $profiles) {
        if ($profile.DefaultInboundAction -ne "Block") {
            $allBlock = $false
        }
    }
    
    if ($allBlock) {
        Write-Pass "Action par defaut: Bloquer les connexions entrantes"
        Add-Result -Id "FW-002" -Category "CIS" -Title "Regle par defaut du pare-feu" -Status "PASS" -Severity "high" `
            -Description "Les connexions entrantes sont bloquees par defaut" -Reference "CIS 9.1.2"
    } else {
        Write-Fail "Action par defaut non conforme"
        Add-Result -Id "FW-002" -Category "CIS" -Title "Regle par defaut du pare-feu" -Status "FAIL" -Severity "high" `
            -Description "Les connexions entrantes ne sont pas bloquees par defaut" `
            -Remediation "Set-NetFirewallProfile -All -DefaultInboundAction Block" -Reference "CIS 9.1.2"
    }
    
    # FW-003: Logging (ENHANCED - plus strict)
    Write-Info "Verification du logging pare-feu..."
    $loggingComplete = $true
    foreach ($profile in $profiles) {
        if (-not $profile.LogBlocked -or -not $profile.LogAllowed) {
            $loggingComplete = $false
        }
    }
    
    if ($loggingComplete) {
        Write-Pass "Logging complet active (bloque + autorise)"
        Add-Result -Id "FW-003" -Category "CIS L2" -Title "Logging complet du pare-feu" -Status "PASS" -Severity "medium" `
            -Description "Le logging des connexions bloquees et autorisees est active" -Reference "CIS 9.1.7"
    } else {
        Write-Warn "Logging pare-feu incomplet"
        Add-Result -Id "FW-003" -Category "CIS L2" -Title "Logging complet du pare-feu" -Status "WARN" -Severity "medium" `
            -Description "Le logging n'est pas complet sur tous les profils" `
            -Remediation "Set-NetFirewallProfile -All -LogBlocked True -LogAllowed True" -Reference "CIS 9.1.7"
    }
    
    # FW-004: IPsec rules (ENHANCED)
    Write-Info "Verification des regles IPsec..."
    $ipsecRules = Get-NetIPsecRule -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq $true }
    $ipsecCount = ($ipsecRules | Measure-Object).Count
    
    if ($ipsecCount -gt 0) {
        Write-Pass "$ipsecCount regles IPsec configurees"
        Add-Result -Id "FW-004" -Category "CIS L2" -Title "Regles IPsec" -Status "PASS" -Severity "medium" `
            -Description "$ipsecCount regles IPsec actives pour le trafic chiffre" -Reference "CIS 9.3"
    } else {
        Write-Info "Aucune regle IPsec active"
        Add-Result -Id "FW-004" -Category "CIS L2" -Title "Regles IPsec" -Status "WARN" -Severity "medium" `
            -Description "Aucune regle IPsec configuree" `
            -Remediation "Configurer IPsec pour le chiffrement du trafic sensible" -Reference "CIS 9.3"
    }
}

#===============================================================================
# Categorie 5: Journalisation et Audit (Etendue)
#===============================================================================

function Test-AuditConfiguration {
    Write-Section "5. JOURNALISATION ET AUDIT"
    
    # AUD-001 a AUD-005: Base audit (comme BASE mais avec verifications plus strictes)
    Write-Info "Verification de la politique d'audit complete..."
    $auditPolicy = auditpol /get /category:* 2>$null
    
    # Check comprehensive audit settings
    $auditCategories = @(
        @{Pattern="Logon"; Name="Connexions"; Ref="CIS 17.5.1"},
        @{Pattern="Account Logon"; Name="Authentification"; Ref="CIS 17.1"},
        @{Pattern="Account Management"; Name="Gestion des comptes"; Ref="CIS 17.2"},
        @{Pattern="Policy Change"; Name="Changements de strategie"; Ref="CIS 17.7"},
        @{Pattern="Privilege Use"; Name="Utilisation des privileges"; Ref="CIS 17.8"},
        @{Pattern="Object Access"; Name="Acces aux objets"; Ref="CIS 17.6"},
        @{Pattern="System"; Name="Systeme"; Ref="CIS 17.9"},
        @{Pattern="Detailed Tracking"; Name="Suivi detaille"; Ref="CIS 17.3"}
    )
    
    $auditScore = 0
    foreach ($cat in $auditCategories) {
        $catAudit = $auditPolicy | Select-String $cat.Pattern
        if ($catAudit -match "Success and Failure") {
            $auditScore++
        }
    }
    
    if ($auditScore -ge 7) {
        Write-Pass "Audit complet: $auditScore/8 categories"
        Add-Result -Id "AUD-001" -Category "CIS L2" -Title "Politique d'audit complete" -Status "PASS" -Severity "high" `
            -Description "$auditScore/8 categories d'audit configurees correctement" -Reference "CIS 17"
    } elseif ($auditScore -ge 4) {
        Write-Warn "Audit partiel: $auditScore/8 categories"
        Add-Result -Id "AUD-001" -Category "CIS L2" -Title "Politique d'audit complete" -Status "WARN" -Severity "high" `
            -Description "Seulement $auditScore/8 categories d'audit configurees" `
            -Remediation "Configurer l'audit complet via auditpol ou GPO" -Reference "CIS 17"
    } else {
        Write-Fail "Audit insuffisant: $auditScore/8 categories"
        Add-Result -Id "AUD-001" -Category "CIS L2" -Title "Politique d'audit complete" -Status "FAIL" -Severity "high" `
            -Description "Audit insuffisant - seulement $auditScore/8 categories" `
            -Remediation "Configurer immediatement l'audit complet" -Reference "CIS 17"
    }
    
    # AUD-002: Taille des journaux (ENHANCED - plus grand)
    Write-Info "Verification de la taille des journaux..."
    $securityLog = Get-WinEvent -ListLog Security
    $securityLogSizeMB = [math]::Round($securityLog.MaximumSizeInBytes / 1MB)
    
    if ($securityLogSizeMB -ge 1024) {
        Write-Pass "Journal Securite: $($securityLogSizeMB) MB"
        Add-Result -Id "AUD-002" -Category "CIS L2" -Title "Taille journal Securite" -Status "PASS" -Severity "medium" `
            -Description "Journal Securite configure a $($securityLogSizeMB) MB" -Reference "CIS 18.9.27.1"
    } elseif ($securityLogSizeMB -ge 196) {
        Write-Warn "Journal Securite: $($securityLogSizeMB) MB (recommande: 1024+ MB)"
        Add-Result -Id "AUD-002" -Category "CIS L2" -Title "Taille journal Securite" -Status "WARN" -Severity "medium" `
            -Description "Journal Securite de $($securityLogSizeMB) MB (recommande: 1024+ MB)" `
            -Remediation "Augmenter la taille du journal a 1 GB minimum" -Reference "CIS 18.9.27.1"
    } else {
        Write-Fail "Journal Securite trop petit: $($securityLogSizeMB) MB"
        Add-Result -Id "AUD-002" -Category "CIS L2" -Title "Taille journal Securite" -Status "FAIL" -Severity "medium" `
            -Description "Journal Securite de seulement $($securityLogSizeMB) MB" `
            -Remediation "Configurer le journal Securite a 1 GB minimum" -Reference "CIS 18.9.27.1"
    }
    
    # AUD-003: Command Line Auditing (ENHANCED)
    Write-Info "Verification audit de la ligne de commande..."
    $cmdLineAudit = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit" -Name "ProcessCreationIncludeCmdLine_Enabled" -ErrorAction SilentlyContinue
    
    if ($cmdLineAudit.ProcessCreationIncludeCmdLine_Enabled -eq 1) {
        Write-Pass "Audit de la ligne de commande active"
        Add-Result -Id "AUD-003" -Category "CIS L2" -Title "Audit ligne de commande" -Status "PASS" -Severity "high" `
            -Description "Les lignes de commande des processus sont auditees" -Reference "CIS 18.9.3.1"
    } else {
        Write-Warn "Audit de la ligne de commande desactive"
        Add-Result -Id "AUD-003" -Category "CIS L2" -Title "Audit ligne de commande" -Status "WARN" -Severity "high" `
            -Description "Les lignes de commande ne sont pas auditees" `
            -Remediation "Activer ProcessCreationIncludeCmdLine_Enabled via GPO" -Reference "CIS 18.9.3.1"
    }
    
    # AUD-004: Sysmon (ENHANCED)
    Write-Info "Verification Sysmon..."
    $sysmon = Get-Service -Name "Sysmon*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Running" }
    
    if ($sysmon) {
        Write-Pass "Sysmon est actif"
        Add-Result -Id "AUD-004" -Category "ANSSI" -Title "Sysmon" -Status "PASS" -Severity "high" `
            -Description "Sysmon est installe et en cours d'execution" -Reference "ANSSI R30"
    } else {
        Write-Warn "Sysmon non detecte"
        Add-Result -Id "AUD-004" -Category "ANSSI" -Title "Sysmon" -Status "WARN" -Severity "high" `
            -Description "Sysmon n'est pas installe ou pas en cours d'execution" `
            -Remediation "Installer et configurer Sysmon avec une configuration recommandee" -Reference "ANSSI R30"
    }
    
    # AUD-005: Windows Event Forwarding (ENHANCED)
    Write-Info "Verification Windows Event Forwarding..."
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
# Categorie 6: Reseau (Etendue)
#===============================================================================

function Test-NetworkConfiguration {
    Write-Section "6. CONFIGURATION RESEAU"
    
    # NET-001 a NET-005: Comme BASE
    # NET-001: IPv6
    Write-Info "Verification IPv6..."
    $ipv6Adapters = Get-NetAdapterBinding | Where-Object { $_.ComponentID -eq "ms_tcpip6" -and $_.Enabled -eq $true }
    
    if ($ipv6Adapters.Count -eq 0) {
        Write-Pass "IPv6 desactive sur toutes les interfaces"
        Add-Result -Id "NET-001" -Category "ANSSI" -Title "Protocole IPv6" -Status "PASS" -Severity "low" `
            -Description "IPv6 est desactive" -Reference "ANSSI R15"
    } else {
        Write-Info "IPv6 active - verifier si necessaire"
        Add-Result -Id "NET-001" -Category "ANSSI" -Title "Protocole IPv6" -Status "WARN" -Severity "low" `
            -Description "IPv6 est active sur $($ipv6Adapters.Count) interface(s)" `
            -Remediation "Desactiver IPv6 si non utilise" -Reference "ANSSI R15"
    }
    
    # NET-002: LLMNR desactive
    Write-Info "Verification LLMNR..."
    $llmnr = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Name "EnableMulticast" -ErrorAction SilentlyContinue
    
    if ($llmnr.EnableMulticast -eq 0) {
        Write-Pass "LLMNR desactive"
        Add-Result -Id "NET-002" -Category "ANSSI" -Title "LLMNR desactive" -Status "PASS" -Severity "high" `
            -Description "LLMNR est desactive" -Reference "ANSSI R17"
    } else {
        Write-Fail "LLMNR active"
        Add-Result -Id "NET-002" -Category "ANSSI" -Title "LLMNR desactive" -Status "FAIL" -Severity "high" `
            -Description "LLMNR est active - vulnerable au relaying" `
            -Remediation "Desactiver via GPO" -Reference "ANSSI R17"
    }
    
    # NET-003: mDNS desactive (ENHANCED)
    Write-Info "Verification mDNS..."
    $mdns = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters" -Name "EnableMDNS" -ErrorAction SilentlyContinue
    
    if ($mdns.EnableMDNS -eq 0) {
        Write-Pass "mDNS desactive"
        Add-Result -Id "NET-003" -Category "CIS L2" -Title "mDNS desactive" -Status "PASS" -Severity "medium" `
            -Description "Multicast DNS est desactive" -Reference "CIS 18.5.4.1"
    } else {
        Write-Warn "mDNS potentiellement actif"
        Add-Result -Id "NET-003" -Category "CIS L2" -Title "mDNS desactive" -Status "WARN" -Severity "medium" `
            -Description "mDNS peut etre actif" `
            -Remediation "Definir EnableMDNS = 0" -Reference "CIS 18.5.4.1"
    }
    
    # NET-004: NetBIOS
    Write-Info "Verification NetBIOS..."
    $netbiosDisabled = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.TcpipNetbiosOptions -eq 2 }
    $netbiosCount = ($netbiosDisabled | Measure-Object).Count
    $totalAdapters = (Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true } | Measure-Object).Count
    
    if ($netbiosCount -eq $totalAdapters) {
        Write-Pass "NetBIOS desactive sur toutes les interfaces"
        Add-Result -Id "NET-004" -Category "ANSSI" -Title "NetBIOS over TCP/IP" -Status "PASS" -Severity "medium" `
            -Description "NetBIOS est desactive sur toutes les interfaces" -Reference "ANSSI R16"
    } else {
        Write-Warn "NetBIOS actif sur certaines interfaces"
        Add-Result -Id "NET-004" -Category "ANSSI" -Title "NetBIOS over TCP/IP" -Status "WARN" -Severity "medium" `
            -Description "NetBIOS est actif sur certaines interfaces" `
            -Remediation "Desactiver NetBIOS dans les proprietes TCP/IP" -Reference "ANSSI R16"
    }
    
    # NET-005: DNS over HTTPS (ENHANCED)
    Write-Info "Verification DNS over HTTPS..."
    $doh = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters" -Name "EnableAutoDoh" -ErrorAction SilentlyContinue
    
    if ($doh.EnableAutoDoh -ge 2) {
        Write-Pass "DNS over HTTPS configure"
        Add-Result -Id "NET-005" -Category "CIS L2" -Title "DNS over HTTPS" -Status "PASS" -Severity "medium" `
            -Description "DoH est configure pour les requetes DNS" -Reference "CIS 18.5.4.2"
    } else {
        Write-Info "DNS over HTTPS non configure"
        Add-Result -Id "NET-005" -Category "CIS L2" -Title "DNS over HTTPS" -Status "WARN" -Severity "medium" `
            -Description "DoH n'est pas configure" `
            -Remediation "Configurer DoH pour chiffrer les requetes DNS" -Reference "CIS 18.5.4.2"
    }
    
    # NET-006: WinRM securise (ENHANCED - plus strict)
    Write-Info "Verification WinRM..."
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
            Write-Pass "WinRM securise (trafic chiffre requis)"
            Add-Result -Id "NET-006" -Category "CIS L2" -Title "WinRM securise" -Status "PASS" -Severity "high" `
                -Description "WinRM n'accepte que les connexions chiffrees" -Reference "CIS 18.9.102"
        } else {
            Write-Fail "WinRM non securise: $($issues -join ', ')"
            Add-Result -Id "NET-006" -Category "CIS L2" -Title "WinRM securise" -Status "FAIL" -Severity "high" `
                -Description "WinRM accepte du trafic non chiffre" `
                -Remediation "Configurer AllowUnencrypted = false cote serveur et client" -Reference "CIS 18.9.102"
        }
    } catch {
        Write-Pass "WinRM non configure"
        Add-Result -Id "NET-006" -Category "CIS L2" -Title "WinRM securise" -Status "PASS" -Severity "high" `
            -Description "WinRM n'est pas configure" -Reference "CIS 18.9.102"
    }
}

#===============================================================================
# Categorie 7: Certificats et Chiffrement (ENHANCED)
#===============================================================================

function Test-CryptographyConfiguration {
    Write-Section "7. CERTIFICATS ET CHIFFREMENT"
    
    # CRYPTO-001: TLS 1.0 desactive
    Write-Info "Verification TLS 1.0..."
    $tls10Server = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.0\Server" -Name "Enabled" -ErrorAction SilentlyContinue
    
    if ($tls10Server.Enabled -eq 0) {
        Write-Pass "TLS 1.0 desactive (serveur)"
        Add-Result -Id "CRYPTO-001" -Category "CIS L2" -Title "TLS 1.0 desactive" -Status "PASS" -Severity "high" `
            -Description "TLS 1.0 est desactive cote serveur" -Reference "CIS 18.4.2"
    } else {
        Write-Fail "TLS 1.0 peut etre actif"
        Add-Result -Id "CRYPTO-001" -Category "CIS L2" -Title "TLS 1.0 desactive" -Status "FAIL" -Severity "high" `
            -Description "TLS 1.0 n'est pas explicitement desactive" `
            -Remediation "Desactiver TLS 1.0 via le registre SCHANNEL" -Reference "CIS 18.4.2"
    }
    
    # CRYPTO-002: TLS 1.1 desactive
    Write-Info "Verification TLS 1.1..."
    $tls11Server = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.1\Server" -Name "Enabled" -ErrorAction SilentlyContinue
    
    if ($tls11Server.Enabled -eq 0) {
        Write-Pass "TLS 1.1 desactive (serveur)"
        Add-Result -Id "CRYPTO-002" -Category "CIS L2" -Title "TLS 1.1 desactive" -Status "PASS" -Severity "medium" `
            -Description "TLS 1.1 est desactive cote serveur" -Reference "CIS 18.4.3"
    } else {
        Write-Warn "TLS 1.1 peut etre actif"
        Add-Result -Id "CRYPTO-002" -Category "CIS L2" -Title "TLS 1.1 desactive" -Status "WARN" -Severity "medium" `
            -Description "TLS 1.1 n'est pas explicitement desactive" `
            -Remediation "Desactiver TLS 1.1 via le registre SCHANNEL" -Reference "CIS 18.4.3"
    }
    
    # CRYPTO-003: SSL 2.0/3.0 desactive
    Write-Info "Verification SSL 2.0/3.0..."
    $ssl2 = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 2.0\Server" -Name "Enabled" -ErrorAction SilentlyContinue
    $ssl3 = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 3.0\Server" -Name "Enabled" -ErrorAction SilentlyContinue
    
    if (($ssl2.Enabled -eq 0 -or $null -eq $ssl2) -and ($ssl3.Enabled -eq 0 -or $null -eq $ssl3)) {
        Write-Pass "SSL 2.0 et 3.0 desactives"
        Add-Result -Id "CRYPTO-003" -Category "CIS L2" -Title "SSL 2.0/3.0 desactives" -Status "PASS" -Severity "critical" `
            -Description "Les protocoles SSL obsoletes sont desactives" -Reference "CIS 18.4.1"
    } else {
        Write-Fail "SSL obsolete peut etre actif"
        Add-Result -Id "CRYPTO-003" -Category "CIS L2" -Title "SSL 2.0/3.0 desactives" -Status "FAIL" -Severity "critical" `
            -Description "SSL 2.0 ou 3.0 peut etre actif" `
            -Remediation "Desactiver SSL 2.0 et 3.0 via SCHANNEL" -Reference "CIS 18.4.1"
    }
    
    # CRYPTO-004: Ciphers faibles desactives
    Write-Info "Verification des ciphers..."
    $weakCiphers = @("RC4", "DES", "3DES", "NULL")
    $enabledWeak = @()
    
    foreach ($cipher in $weakCiphers) {
        $cipherKey = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Ciphers\$cipher*" -Name "Enabled" -ErrorAction SilentlyContinue
        if ($cipherKey.Enabled -ne 0 -and $null -ne $cipherKey.Enabled) {
            $enabledWeak += $cipher
        }
    }
    
    if ($enabledWeak.Count -eq 0) {
        Write-Pass "Aucun cipher faible detecte"
        Add-Result -Id "CRYPTO-004" -Category "CIS L2" -Title "Ciphers faibles desactives" -Status "PASS" -Severity "high" `
            -Description "Aucun cipher faible n'est explicitement active" -Reference "CIS 18.4.4"
    } else {
        Write-Fail "Ciphers faibles actifs: $($enabledWeak -join ', ')"
        Add-Result -Id "CRYPTO-004" -Category "CIS L2" -Title "Ciphers faibles desactives" -Status "FAIL" -Severity "high" `
            -Description "Ciphers faibles actifs: $($enabledWeak -join ', ')" `
            -Remediation "Desactiver les ciphers RC4, DES, 3DES, NULL" -Reference "CIS 18.4.4"
    }
    
    # CRYPTO-005: Certificats root de confiance
    Write-Info "Verification des certificats root..."
    $rootCerts = Get-ChildItem Cert:\LocalMachine\Root
    $expiredCerts = $rootCerts | Where-Object { $_.NotAfter -lt (Get-Date) }
    $expiredCount = ($expiredCerts | Measure-Object).Count
    
    if ($expiredCount -eq 0) {
        Write-Pass "Aucun certificat root expire"
        Add-Result -Id "CRYPTO-005" -Category "ANSSI" -Title "Certificats root valides" -Status "PASS" -Severity "medium" `
            -Description "Tous les certificats root sont valides" -Reference "ANSSI R35"
    } else {
        Write-Warn "$expiredCount certificat(s) root expire(s)"
        Add-Result -Id "CRYPTO-005" -Category "ANSSI" -Title "Certificats root valides" -Status "WARN" -Severity "medium" `
            -Description "$expiredCount certificat(s) root expire(s) dans le magasin" `
            -Remediation "Supprimer les certificats root expires" -Reference "ANSSI R35"
    }
}

#===============================================================================
# Categorie 8: Hardening Systeme Avance (ENHANCED)
#===============================================================================

function Test-AdvancedHardening {
    Write-Section "8. HARDENING AVANCE"
    
    # ADV-001: ASLR force
    Write-Info "Verification ASLR..."
    $aslr = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Name "MoveImages" -ErrorAction SilentlyContinue
    
    if ($aslr.MoveImages -eq 1) {
        Write-Pass "ASLR active"
        Add-Result -Id "ADV-001" -Category "CIS L2" -Title "ASLR active" -Status "PASS" -Severity "high" `
            -Description "Address Space Layout Randomization est active" -Reference "CIS 18.9.24.1"
    } else {
        Write-Warn "ASLR non configure explicitement"
        Add-Result -Id "ADV-001" -Category "CIS L2" -Title "ASLR active" -Status "WARN" -Severity "high" `
            -Description "ASLR n'est pas explicitement force" `
            -Remediation "Configurer MoveImages = 1" -Reference "CIS 18.9.24.1"
    }
    
    # ADV-002: DEP/NX active
    Write-Info "Verification DEP..."
    $dep = bcdedit /enum | Select-String "nx"
    
    if ($dep -match "OptOut" -or $dep -match "AlwaysOn") {
        Write-Pass "DEP configure en mode strict"
        Add-Result -Id "ADV-002" -Category "CIS L2" -Title "DEP/NX active" -Status "PASS" -Severity "high" `
            -Description "Data Execution Prevention est active" -Reference "CIS 18.9.24.2"
    } else {
        Write-Warn "DEP peut ne pas etre en mode strict"
        Add-Result -Id "ADV-002" -Category "CIS L2" -Title "DEP/NX active" -Status "WARN" -Severity "high" `
            -Description "DEP n'est peut-etre pas en mode strict" `
            -Remediation "Configurer DEP en mode OptOut ou AlwaysOn" -Reference "CIS 18.9.24.2"
    }
    
    # ADV-003: SEHOP active
    Write-Info "Verification SEHOP..."
    $sehop = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel" -Name "DisableExceptionChainValidation" -ErrorAction SilentlyContinue
    
    if ($null -eq $sehop.DisableExceptionChainValidation -or $sehop.DisableExceptionChainValidation -eq 0) {
        Write-Pass "SEHOP active"
        Add-Result -Id "ADV-003" -Category "CIS L2" -Title "SEHOP active" -Status "PASS" -Severity "high" `
            -Description "Structured Exception Handling Overwrite Protection est active" -Reference "CIS 18.9.24.3"
    } else {
        Write-Fail "SEHOP desactive"
        Add-Result -Id "ADV-003" -Category "CIS L2" -Title "SEHOP active" -Status "FAIL" -Severity "high" `
            -Description "SEHOP est desactive" `
            -Remediation "Supprimer DisableExceptionChainValidation ou le definir a 0" -Reference "CIS 18.9.24.3"
    }
    
    # ADV-004: Windows Firewall en mode strict (ENHANCED)
    Write-Info "Verification mode strict pare-feu..."
    $publicProfile = Get-NetFirewallProfile -Name Public
    
    if ($publicProfile.DefaultInboundAction -eq "Block" -and $publicProfile.DefaultOutboundAction -eq "Block") {
        Write-Pass "Profil Public en mode strict (bloquer in/out)"
        Add-Result -Id "ADV-004" -Category "CIS L2" -Title "Pare-feu mode strict" -Status "PASS" -Severity "high" `
            -Description "Le profil Public bloque le trafic entrant et sortant par defaut" -Reference "CIS 9.3.1"
    } else {
        Write-Warn "Profil Public pas en mode strict"
        Add-Result -Id "ADV-004" -Category "CIS L2" -Title "Pare-feu mode strict" -Status "WARN" -Severity "high" `
            -Description "Le profil Public ne bloque pas tout le trafic par defaut" `
            -Remediation "Configurer Block pour le trafic entrant ET sortant sur le profil Public" -Reference "CIS 9.3.1"
    }
    
    # ADV-005: Automatic Sample Submission desactive
    Write-Info "Verification envoi automatique d'echantillons..."
    $sampleSubmission = Get-MpPreference | Select-Object -ExpandProperty SubmitSamplesConsent -ErrorAction SilentlyContinue
    
    if ($sampleSubmission -eq 2) {
        Write-Pass "Envoi automatique d'echantillons desactive"
        Add-Result -Id "ADV-005" -Category "CIS L2" -Title "Sample Submission" -Status "PASS" -Severity "low" `
            -Description "L'envoi automatique d'echantillons est desactive" -Reference "CIS 18.9.47.4"
    } else {
        Write-Info "Envoi d'echantillons configure: $sampleSubmission"
        Add-Result -Id "ADV-005" -Category "CIS L2" -Title "Sample Submission" -Status "WARN" -Severity "low" `
            -Description "L'envoi d'echantillons est configure (verifier la politique)" `
            -Remediation "Configurer SubmitSamplesConsent selon la politique de l'entreprise" -Reference "CIS 18.9.47.4"
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
            "PASS" { "OK" }
            "WARN" { "!" }
            "FAIL" { "X" }
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
    <title>Rapport d'Audit Securite Windows Server (ENHANCED) - Infra Shield Tools</title>
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
            <h1>Rapport d'Audit de Securite Windows Server (ENHANCED)</h1>
            <div class="subtitle">Genere par Infra Shield Tools - ~100 controles complets</div>
            <div class="framework">Referentiel ANSSI + CIS Benchmark Level 2</div>
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
            <p>Base sur les recommandations ANSSI et CIS Benchmark Level 2 pour Windows Server</p>
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
    Write-Host "+====================================================================+"
    Write-Host "|                       RESUME DE L'AUDIT                            |"
    Write-Host "+====================================================================+"
    Write-Host ("|  Score Global: {0,-3}%                                    Note: {1,-1}   |" -f $score, $grade)
    Write-Host "+====================================================================+"
    Write-Host ("|  OK Controles reussis:    {0,-3}                                      |" -f $script:PassedChecks)
    Write-Host ("|  ! Avertissements:       {0,-3}                                      |" -f $script:WarningChecks)
    Write-Host ("|  X Controles echoues:    {0,-3}                                      |" -f $script:FailedChecks)
    Write-Host ("|  Total:                  {0,-3}                                      |" -f $script:TotalChecks)
    Write-Host "+====================================================================+"
    
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
Write-Host "Demarrage de l'audit de securite Windows Server ENHANCED (~100 controles)..."
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
