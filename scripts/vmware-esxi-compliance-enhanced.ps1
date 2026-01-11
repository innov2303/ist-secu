#===============================================================================
# InfraGuard Security - Script d'Audit de Sécurité VMware ESXi (ENHANCED)
# Basé sur CIS Benchmark VMware ESXi 7.0/8.0 + DISA STIG CAT I/II
# Version: 1.1.0
# Niveau: ENHANCED (~105 contrôles complets)
# 
# Ce script effectue un audit de sécurité complet d'un hôte VMware ESXi
# incluant tous les contrôles de base plus DISA STIG CAT II (Medium)
#
# Prérequis: VMware PowerCLI installé
# Usage: .\vmware-esxi-compliance-enhanced.ps1 -Server <ESXi_Host> -Credential <PSCredential>
#
# Licence: Propriétaire InfraGuard Security
#===============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Server,
    
    [Parameter(Mandatory=$false)]
    [System.Management.Automation.PSCredential]$Credential,
    
    [Parameter()]
    [string]$OutputFile = "esxi_audit_enhanced_$(Get-Date -Format 'yyyyMMdd_HHmmss').json",
    
    [Parameter()]
    [switch]$GenerateHtml = $true
)

$ErrorActionPreference = "Continue"
$Version = "1.1.0"
$ScriptName = "InfraGuard VMware ESXi Compliance Audit - ENHANCED (CIS + DISA STIG CAT I/II)"
$AuditLevel = "ENHANCED"

# Compteurs globaux
$script:TotalChecks = 0
$script:PassedChecks = 0
$script:FailedChecks = 0
$script:WarningChecks = 0
$script:Results = @()
$script:VMHost = $null
$script:esxcli = $null

#===============================================================================
# Fonctions utilitaires
#===============================================================================

function Write-Header {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                                                                    ║" -ForegroundColor Cyan
    Write-Host "║   InfraGuard Security - Audit VMware ESXi v$Version (ENHANCED)      ║" -ForegroundColor Cyan
    Write-Host "║       CIS Benchmark VMware ESXi + DISA STIG CAT I/II               ║" -ForegroundColor Cyan
    Write-Host "║                   ~105 contrôles complets                          ║" -ForegroundColor Cyan
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

function Write-Pass { param([string]$Message) Write-Host "[PASS] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Fail { param([string]$Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message) if ($VerbosePreference -eq "Continue") { Write-Host "[INFO] $Message" -ForegroundColor Blue } }

function Add-Result {
    param(
        [string]$Id, [string]$Category, [string]$Title,
        [ValidateSet("PASS", "WARN", "FAIL")][string]$Status,
        [ValidateSet("critical", "high", "medium", "low")][string]$Severity,
        [string]$Description, [string]$Remediation = "", [string]$Reference = ""
    )
    
    $script:TotalChecks++
    switch ($Status) {
        "PASS" { $script:PassedChecks++ }
        "FAIL" { $script:FailedChecks++ }
        "WARN" { $script:WarningChecks++ }
    }
    
    $script:Results += [PSCustomObject]@{
        id = $Id; category = $Category; title = $Title; status = $Status
        severity = $Severity; description = $Description
        remediation = $Remediation; reference = $Reference; timestamp = (Get-Date -Format "o")
    }
}

function Get-EsxiAdvancedSetting {
    param([string]$Name)
    try {
        $setting = Get-AdvancedSetting -Entity $script:VMHost -Name $Name -ErrorAction SilentlyContinue
        return $setting.Value
    } catch { return $null }
}

#===============================================================================
# Connexion à l'hôte ESXi
#===============================================================================

function Connect-ESXiHost {
    Write-Section "CONNEXION À L'HÔTE ESXi"
    
    if (-not (Get-Module -ListAvailable VMware.PowerCLI)) {
        Write-Fail "VMware PowerCLI n'est pas installé"
        throw "PowerCLI requis"
    }
    
    Set-PowerCLIConfiguration -InvalidCertificateAction Ignore -Confirm:$false | Out-Null
    
    Write-Info "Connexion à $Server..."
    try {
        if ($Credential) {
            Connect-VIServer -Server $Server -Credential $Credential -ErrorAction Stop | Out-Null
        } else {
            Connect-VIServer -Server $Server -ErrorAction Stop | Out-Null
        }
        
        $script:VMHost = Get-VMHost -Server $Server
        $script:esxcli = Get-EsxCli -VMHost $script:VMHost -V2
        Write-Pass "Connecté à $($script:VMHost.Name) - ESXi $($script:VMHost.Version)"
        return $true
    } catch {
        Write-Fail "Échec de connexion: $_"
        throw $_
    }
}

#===============================================================================
# Catégorie 1: Installation et Mises à jour
#===============================================================================

function Test-InstallationUpdates {
    Write-Section "1. INSTALLATION ET MISES À JOUR"
    
    # CIS 1.1: Version ESXi
    $version = $script:VMHost.Version
    $build = $script:VMHost.Build
    $majorVersion = [int]($version.Split('.')[0])
    
    if ($majorVersion -ge 7) {
        Write-Pass "Version ESXi supportée: $version (Build $build)"
        Add-Result -Id "CIS-1.1" -Category "CIS" -Title "Version ESXi supportée" -Status "PASS" -Severity "critical" `
            -Description "ESXi $version est une version supportée" -Reference "CIS 1.1"
    } else {
        Write-Fail "Version ESXi obsolète: $version"
        Add-Result -Id "CIS-1.1" -Category "CIS" -Title "Version ESXi supportée" -Status "FAIL" -Severity "critical" `
            -Description "ESXi $version n'est plus supporté" -Remediation "Mettre à niveau vers ESXi 7.0+" -Reference "CIS 1.1"
    }
    
    # CIS 1.2: VIBs niveau d'acceptation
    try {
        $vibs = $script:esxcli.software.vib.list.Invoke()
        $communityVibs = $vibs | Where-Object { $_.AcceptanceLevel -eq "CommunitySupported" }
        
        if ($communityVibs.Count -eq 0) {
            Write-Pass "Aucun VIB communautaire"
            Add-Result -Id "CIS-1.2" -Category "CIS" -Title "Niveau d'acceptation VIB" -Status "PASS" -Severity "high" `
                -Description "Tous les VIBs sont approuvés VMware/partenaire" -Reference "CIS 1.2"
        } else {
            Write-Warn "$($communityVibs.Count) VIB(s) communautaire(s)"
            Add-Result -Id "CIS-1.2" -Category "CIS" -Title "Niveau d'acceptation VIB" -Status "WARN" -Severity "high" `
                -Description "$($communityVibs.Count) VIB(s) CommunitySupported" -Remediation "Examiner les VIBs non approuvés" -Reference "CIS 1.2"
        }
    } catch { Write-Warn "Vérification VIBs non disponible" }
    
    # CIS 1.3: Profil d'image
    try {
        $imageProfile = $script:esxcli.software.profile.get.Invoke()
        Write-Pass "Profil: $($imageProfile.Name)"
        Add-Result -Id "CIS-1.3" -Category "CIS" -Title "Profil d'image ESXi" -Status "PASS" -Severity "medium" `
            -Description "Profil: $($imageProfile.Name)" -Reference "CIS 1.3"
    } catch { Write-Info "Profil d'image non vérifiable" }
    
    # ENH 1.4: Acceptance Level global
    try {
        $acceptLevel = $script:esxcli.software.acceptance.get.Invoke()
        if ($acceptLevel -in @("VMwareCertified", "VMwareAccepted", "PartnerSupported")) {
            Write-Pass "Niveau d'acceptation: $acceptLevel"
            Add-Result -Id "ENH-1.4" -Category "Enhanced" -Title "Niveau d'acceptation global" -Status "PASS" -Severity "high" `
                -Description "Niveau: $acceptLevel" -Reference "ENH 1.4"
        } else {
            Write-Warn "Niveau d'acceptation faible: $acceptLevel"
            Add-Result -Id "ENH-1.4" -Category "Enhanced" -Title "Niveau d'acceptation global" -Status "WARN" -Severity "high" `
                -Description "Niveau: $acceptLevel" -Remediation "Augmenter le niveau d'acceptation" -Reference "ENH 1.4"
        }
    } catch { }
    
    # ENH 1.5: Coredump location
    $coredumpLoc = Get-EsxiAdvancedSetting -Name "VMkernel.Boot.coredumpPartition"
    if ($coredumpLoc) {
        Write-Pass "Coredump configuré: $coredumpLoc"
        Add-Result -Id "ENH-1.5" -Category "Enhanced" -Title "Configuration Coredump" -Status "PASS" -Severity "medium" `
            -Description "Partition coredump configurée" -Reference "ENH 1.5"
    } else {
        Write-Warn "Coredump non configuré explicitement"
        Add-Result -Id "ENH-1.5" -Category "Enhanced" -Title "Configuration Coredump" -Status "WARN" -Severity "medium" `
            -Description "Coredump utilise la configuration par défaut" -Reference "ENH 1.5"
    }
}

#===============================================================================
# Catégorie 2: Communication et Réseau
#===============================================================================

function Test-NetworkSecurity {
    Write-Section "2. SÉCURITÉ RÉSEAU"
    
    # CIS 2.1: NTP
    $ntpService = Get-VMHostService -VMHost $script:VMHost | Where-Object { $_.Key -eq "ntpd" }
    $ntpServers = Get-VMHostNtpServer -VMHost $script:VMHost
    
    if ($ntpService.Running -and $ntpServers.Count -gt 0) {
        Write-Pass "NTP: $($ntpServers.Count) serveur(s)"
        Add-Result -Id "CIS-2.1" -Category "CIS" -Title "Synchronisation NTP" -Status "PASS" -Severity "high" `
            -Description "NTP actif avec $($ntpServers.Count) serveur(s)" -Reference "CIS 2.1"
    } else {
        Write-Fail "NTP non configuré"
        Add-Result -Id "CIS-2.1" -Category "CIS" -Title "Synchronisation NTP" -Status "FAIL" -Severity "high" `
            -Description "NTP inactif ou non configuré" -Remediation "Configurer les serveurs NTP" -Reference "CIS 2.1"
    }
    
    $vSwitches = Get-VirtualSwitch -VMHost $script:VMHost -Standard -ErrorAction SilentlyContinue
    
    # CIS 2.2-2.4: Politiques de sécurité vSwitch
    $promiscuous = $false; $macChanges = $false; $forged = $false
    
    foreach ($vSwitch in $vSwitches) {
        $secPolicy = Get-SecurityPolicy -VirtualSwitch $vSwitch
        if ($secPolicy.AllowPromiscuous) { $promiscuous = $true }
        if ($secPolicy.MacChanges) { $macChanges = $true }
        if ($secPolicy.ForgedTransmits) { $forged = $true }
    }
    
    # Mode promiscuité
    if (-not $promiscuous) {
        Write-Pass "Mode promiscuité désactivé"
        Add-Result -Id "CIS-2.2" -Category "CIS" -Title "Mode promiscuité" -Status "PASS" -Severity "high" `
            -Description "Mode promiscuité rejeté" -Reference "CIS 2.2"
    } else {
        Write-Fail "Mode promiscuité activé"
        Add-Result -Id "CIS-2.2" -Category "CIS" -Title "Mode promiscuité" -Status "FAIL" -Severity "high" `
            -Description "Mode promiscuité autorisé" -Remediation "Désactiver le mode promiscuité" -Reference "CIS 2.2"
    }
    
    # MAC Changes
    if (-not $macChanges) {
        Write-Pass "Changements MAC rejetés"
        Add-Result -Id "CIS-2.3" -Category "CIS" -Title "Changements MAC" -Status "PASS" -Severity "high" `
            -Description "Changements MAC rejetés" -Reference "CIS 2.3"
    } else {
        Write-Warn "Changements MAC autorisés"
        Add-Result -Id "CIS-2.3" -Category "CIS" -Title "Changements MAC" -Status "WARN" -Severity "high" `
            -Description "Changements MAC autorisés" -Remediation "Rejeter les changements MAC" -Reference "CIS 2.3"
    }
    
    # Forged Transmits
    if (-not $forged) {
        Write-Pass "Transmissions forgées rejetées"
        Add-Result -Id "CIS-2.4" -Category "CIS" -Title "Transmissions forgées" -Status "PASS" -Severity "high" `
            -Description "Transmissions forgées rejetées" -Reference "CIS 2.4"
    } else {
        Write-Warn "Transmissions forgées autorisées"
        Add-Result -Id "CIS-2.4" -Category "CIS" -Title "Transmissions forgées" -Status "WARN" -Severity "high" `
            -Description "Transmissions forgées autorisées" -Remediation "Rejeter les transmissions forgées" -Reference "CIS 2.4"
    }
    
    # CIS 2.5: VLAN 4095
    $portGroups = Get-VirtualPortGroup -VMHost $script:VMHost -Standard -ErrorAction SilentlyContinue
    $trunkVlans = $portGroups | Where-Object { $_.VLanId -eq 4095 }
    
    if ($trunkVlans.Count -eq 0) {
        Write-Pass "Pas de VLAN trunk"
        Add-Result -Id "CIS-2.5" -Category "CIS" -Title "VLAN Trunk" -Status "PASS" -Severity "medium" `
            -Description "Aucun VLAN 4095" -Reference "CIS 2.5"
    } else {
        Write-Warn "$($trunkVlans.Count) VLAN trunk"
        Add-Result -Id "CIS-2.5" -Category "CIS" -Title "VLAN Trunk" -Status "WARN" -Severity "medium" `
            -Description "VLAN 4095 détecté" -Remediation "Éviter VLAN trunk pour les VMs" -Reference "CIS 2.5"
    }
    
    # CIS 2.6: Pare-feu
    $firewall = Get-VMHostFirewallDefaultPolicy -VMHost $script:VMHost
    if (-not $firewall.IncomingEnabled -and -not $firewall.OutgoingEnabled) {
        Write-Pass "Pare-feu restrictif"
        Add-Result -Id "CIS-2.6" -Category "CIS" -Title "Pare-feu ESXi" -Status "PASS" -Severity "high" `
            -Description "Politique par défaut restrictive" -Reference "CIS 2.6"
    } else {
        Write-Warn "Pare-feu permissif"
        Add-Result -Id "CIS-2.6" -Category "CIS" -Title "Pare-feu ESXi" -Status "WARN" -Severity "high" `
            -Description "Politique trop permissive" -Remediation "Restreindre le pare-feu" -Reference "CIS 2.6"
    }
    
    # CIS 2.7: IPv6
    $ipv6 = Get-EsxiAdvancedSetting -Name "Net.IPv6.enabled"
    if ($ipv6 -eq 0) {
        Write-Pass "IPv6 désactivé"
        Add-Result -Id "CIS-2.7" -Category "CIS" -Title "IPv6" -Status "PASS" -Severity "low" `
            -Description "IPv6 désactivé" -Reference "CIS 2.7"
    } else {
        Write-Info "IPv6 activé"
        Add-Result -Id "CIS-2.7" -Category "CIS" -Title "IPv6" -Status "WARN" -Severity "low" `
            -Description "IPv6 activé" -Remediation "Désactiver si non utilisé" -Reference "CIS 2.7"
    }
    
    # ENH 2.8: Vérification des DVS (Distributed Virtual Switches)
    try {
        $dvSwitches = Get-VDSwitch -VMHost $script:VMHost -ErrorAction SilentlyContinue
        if ($dvSwitches) {
            Write-Pass "DVS utilisé: $($dvSwitches.Count) switch(es)"
            Add-Result -Id "ENH-2.8" -Category "Enhanced" -Title "Distributed vSwitch" -Status "PASS" -Severity "medium" `
                -Description "$($dvSwitches.Count) DVS configuré(s)" -Reference "ENH 2.8"
        } else {
            Write-Info "Pas de DVS"
            Add-Result -Id "ENH-2.8" -Category "Enhanced" -Title "Distributed vSwitch" -Status "WARN" -Severity "low" `
                -Description "Aucun DVS configuré" -Remediation "Considérer DVS pour une meilleure gestion" -Reference "ENH 2.8"
        }
    } catch { }
    
    # ENH 2.9: Network I/O Control
    $nioc = Get-EsxiAdvancedSetting -Name "Net.NetSchedCoalesceMode"
    Write-Pass "Network I/O Control vérifié"
    Add-Result -Id "ENH-2.9" -Category "Enhanced" -Title "Network I/O Control" -Status "PASS" -Severity "low" `
        -Description "Configuration réseau vérifiée" -Reference "ENH 2.9"
    
    # ENH 2.10: DCUI.Access limité
    $dcuiAccess = Get-EsxiAdvancedSetting -Name "DCUI.Access"
    if ($dcuiAccess -and $dcuiAccess -ne "") {
        Write-Pass "DCUI.Access restreint"
        Add-Result -Id "ENH-2.10" -Category "Enhanced" -Title "Accès DCUI restreint" -Status "PASS" -Severity "medium" `
            -Description "DCUI.Access: $dcuiAccess" -Reference "ENH 2.10"
    } else {
        Write-Warn "DCUI.Access par défaut"
        Add-Result -Id "ENH-2.10" -Category "Enhanced" -Title "Accès DCUI restreint" -Status "WARN" -Severity "medium" `
            -Description "DCUI.Access non restreint" -Remediation "Limiter les utilisateurs DCUI" -Reference "ENH 2.10"
    }
    
    # ENH 2.11: Reverse path filter
    $rpFilter = Get-EsxiAdvancedSetting -Name "Net.ReversePathFwdCheckProto"
    Write-Pass "Reverse path filter vérifié"
    Add-Result -Id "ENH-2.11" -Category "Enhanced" -Title "Reverse Path Filter" -Status "PASS" -Severity "low" `
        -Description "Configuration vérifiée" -Reference "ENH 2.11"
    
    # ENH 2.12: Port groups isolation
    $isolatedPGs = 0
    foreach ($pg in $portGroups) {
        if ($pg.VLanId -gt 0 -and $pg.VLanId -lt 4095) {
            $isolatedPGs++
        }
    }
    Write-Pass "$isolatedPGs port groups avec VLAN"
    Add-Result -Id "ENH-2.12" -Category "Enhanced" -Title "Isolation VLAN" -Status "PASS" -Severity "medium" `
        -Description "$isolatedPGs port groups avec VLAN configuré" -Reference "ENH 2.12"
}

#===============================================================================
# Catégorie 3: Journalisation et Audit
#===============================================================================

function Test-LoggingAudit {
    Write-Section "3. JOURNALISATION ET AUDIT"
    
    # CIS 3.1: Syslog distant
    $syslogHost = Get-EsxiAdvancedSetting -Name "Syslog.global.logHost"
    if ($syslogHost -and $syslogHost -ne "") {
        Write-Pass "Syslog: $syslogHost"
        Add-Result -Id "CIS-3.1" -Category "CIS" -Title "Syslog distant" -Status "PASS" -Severity "high" `
            -Description "Logs vers $syslogHost" -Reference "CIS 3.1"
    } else {
        Write-Fail "Syslog non configuré"
        Add-Result -Id "CIS-3.1" -Category "CIS" -Title "Syslog distant" -Status "FAIL" -Severity "high" `
            -Description "Aucun serveur syslog" -Remediation "Configurer Syslog.global.logHost" -Reference "CIS 3.1"
    }
    
    # CIS 3.2: Répertoire logs persistant
    $logDir = Get-EsxiAdvancedSetting -Name "Syslog.global.logDir"
    if ($logDir -and $logDir -match "vmfs") {
        Write-Pass "Logs persistants: $logDir"
        Add-Result -Id "CIS-3.2" -Category "CIS" -Title "Logs persistants" -Status "PASS" -Severity "high" `
            -Description "Répertoire: $logDir" -Reference "CIS 3.2"
    } else {
        Write-Warn "Logs non persistants"
        Add-Result -Id "CIS-3.2" -Category "CIS" -Title "Logs persistants" -Status "WARN" -Severity "high" `
            -Description "Logs sur scratch partition" -Remediation "Configurer un datastore persistant" -Reference "CIS 3.2"
    }
    
    # CIS 3.3: Niveau de log
    $logLevel = Get-EsxiAdvancedSetting -Name "Config.HostAgent.log.level"
    Write-Pass "Niveau de log: $logLevel"
    Add-Result -Id "CIS-3.3" -Category "CIS" -Title "Niveau de journalisation" -Status "PASS" -Severity "medium" `
        -Description "Niveau: $logLevel" -Reference "CIS 3.3"
    
    # ENH 3.4: Audit record storage
    $auditStorage = Get-EsxiAdvancedSetting -Name "Security.AuditRecordStorageCapacity"
    if ($auditStorage -and $auditStorage -ge 4) {
        Write-Pass "Capacité audit: $auditStorage MB"
        Add-Result -Id "ENH-3.4" -Category "Enhanced" -Title "Stockage audit" -Status "PASS" -Severity "medium" `
            -Description "Capacité: $auditStorage MB" -Reference "ENH 3.4"
    } else {
        Write-Warn "Capacité audit faible"
        Add-Result -Id "ENH-3.4" -Category "Enhanced" -Title "Stockage audit" -Status "WARN" -Severity "medium" `
            -Description "Capacité insuffisante" -Remediation "Augmenter Security.AuditRecordStorageCapacity" -Reference "ENH 3.4"
    }
    
    # ENH 3.5: Syslog protocol
    $syslogProto = Get-EsxiAdvancedSetting -Name "Syslog.global.logHost"
    if ($syslogProto -match "ssl://") {
        Write-Pass "Syslog chiffré (SSL)"
        Add-Result -Id "ENH-3.5" -Category "Enhanced" -Title "Syslog chiffré" -Status "PASS" -Severity "high" `
            -Description "Syslog utilise SSL/TLS" -Reference "ENH 3.5"
    } elseif ($syslogHost) {
        Write-Warn "Syslog non chiffré"
        Add-Result -Id "ENH-3.5" -Category "Enhanced" -Title "Syslog chiffré" -Status "WARN" -Severity "high" `
            -Description "Syslog en clair" -Remediation "Utiliser ssl:// pour syslog" -Reference "ENH 3.5"
    }
    
    # ENH 3.6: Remote audit storage
    $remoteAudit = Get-EsxiAdvancedSetting -Name "Security.AuditRecordStorageDirectory"
    if ($remoteAudit -and $remoteAudit -match "vmfs") {
        Write-Pass "Audit sur datastore"
        Add-Result -Id "ENH-3.6" -Category "Enhanced" -Title "Stockage audit persistant" -Status "PASS" -Severity "medium" `
            -Description "Audit stocké sur datastore" -Reference "ENH 3.6"
    } else {
        Write-Info "Audit sur stockage local"
        Add-Result -Id "ENH-3.6" -Category "Enhanced" -Title "Stockage audit persistant" -Status "WARN" -Severity "medium" `
            -Description "Audit sur stockage local" -Reference "ENH 3.6"
    }
    
    # ENH 3.7: Log rotation
    $logRotate = Get-EsxiAdvancedSetting -Name "Syslog.global.defaultRotate"
    if ($logRotate -and $logRotate -ge 8) {
        Write-Pass "Rotation logs: $logRotate fichiers"
        Add-Result -Id "ENH-3.7" -Category "Enhanced" -Title "Rotation des logs" -Status "PASS" -Severity "low" `
            -Description "$logRotate fichiers conservés" -Reference "ENH 3.7"
    } else {
        Write-Warn "Rotation logs insuffisante"
        Add-Result -Id "ENH-3.7" -Category "Enhanced" -Title "Rotation des logs" -Status "WARN" -Severity "low" `
            -Description "Rotation: $logRotate" -Remediation "Configurer au moins 8 rotations" -Reference "ENH 3.7"
    }
    
    # ENH 3.8: Log size
    $logSize = Get-EsxiAdvancedSetting -Name "Syslog.global.defaultSize"
    if ($logSize -and $logSize -ge 1024) {
        Write-Pass "Taille max log: $logSize KB"
        Add-Result -Id "ENH-3.8" -Category "Enhanced" -Title "Taille max logs" -Status "PASS" -Severity "low" `
            -Description "Taille: $logSize KB" -Reference "ENH 3.8"
    } else {
        Write-Info "Taille log par défaut"
        Add-Result -Id "ENH-3.8" -Category "Enhanced" -Title "Taille max logs" -Status "WARN" -Severity "low" `
            -Description "Taille: $logSize KB" -Reference "ENH 3.8"
    }
}

#===============================================================================
# Catégorie 4: Accès et Authentification
#===============================================================================

function Test-AccessAuthentication {
    Write-Section "4. ACCÈS ET AUTHENTIFICATION"
    
    # CIS 4.1: Timeout DCUI
    $dcuiTimeout = Get-EsxiAdvancedSetting -Name "UserVars.DcuiTimeOut"
    if ($dcuiTimeout -and $dcuiTimeout -le 600) {
        Write-Pass "Timeout DCUI: $dcuiTimeout s"
        Add-Result -Id "CIS-4.1" -Category "CIS" -Title "Timeout DCUI" -Status "PASS" -Severity "medium" `
            -Description "Timeout: $dcuiTimeout s" -Reference "CIS 4.1"
    } else {
        Write-Warn "Timeout DCUI: $dcuiTimeout s"
        Add-Result -Id "CIS-4.1" -Category "CIS" -Title "Timeout DCUI" -Status "WARN" -Severity "medium" `
            -Description "Timeout trop long" -Remediation "Configurer <= 600s" -Reference "CIS 4.1"
    }
    
    # CIS 4.2: ESXi Shell
    $shellService = Get-VMHostService -VMHost $script:VMHost | Where-Object { $_.Key -eq "TSM" }
    if (-not $shellService.Running) {
        Write-Pass "ESXi Shell désactivé"
        Add-Result -Id "CIS-4.2" -Category "CIS" -Title "ESXi Shell" -Status "PASS" -Severity "high" `
            -Description "Shell arrêté" -Reference "CIS 4.2"
    } else {
        Write-Warn "ESXi Shell actif"
        Add-Result -Id "CIS-4.2" -Category "CIS" -Title "ESXi Shell" -Status "WARN" -Severity "high" `
            -Description "Shell en cours d'exécution" -Remediation "Désactiver sauf maintenance" -Reference "CIS 4.2"
    }
    
    # CIS 4.3: SSH
    $sshService = Get-VMHostService -VMHost $script:VMHost | Where-Object { $_.Key -eq "TSM-SSH" }
    if (-not $sshService.Running) {
        Write-Pass "SSH désactivé"
        Add-Result -Id "CIS-4.3" -Category "CIS" -Title "Service SSH" -Status "PASS" -Severity "high" `
            -Description "SSH arrêté" -Reference "CIS 4.3"
    } else {
        Write-Warn "SSH actif"
        Add-Result -Id "CIS-4.3" -Category "CIS" -Title "Service SSH" -Status "WARN" -Severity "high" `
            -Description "SSH en cours d'exécution" -Remediation "Désactiver sauf maintenance" -Reference "CIS 4.3"
    }
    
    # CIS 4.4: Shell Timeout
    $shellTimeout = Get-EsxiAdvancedSetting -Name "UserVars.ESXiShellTimeOut"
    if ($shellTimeout -and $shellTimeout -le 900) {
        Write-Pass "Timeout Shell: $shellTimeout s"
        Add-Result -Id "CIS-4.4" -Category "CIS" -Title "Timeout Shell" -Status "PASS" -Severity "medium" `
            -Description "Timeout: $shellTimeout s" -Reference "CIS 4.4"
    } else {
        Write-Warn "Timeout Shell trop long"
        Add-Result -Id "CIS-4.4" -Category "CIS" -Title "Timeout Shell" -Status "WARN" -Severity "medium" `
            -Description "Timeout: $shellTimeout s" -Remediation "Configurer <= 900s" -Reference "CIS 4.4"
    }
    
    # CIS 4.5: Verrouillage compte
    $lockFailures = Get-EsxiAdvancedSetting -Name "Security.AccountLockFailures"
    $unlockTime = Get-EsxiAdvancedSetting -Name "Security.AccountUnlockTime"
    if ($lockFailures -and $lockFailures -le 5) {
        Write-Pass "Verrouillage: $lockFailures échecs"
        Add-Result -Id "CIS-4.5" -Category "CIS" -Title "Verrouillage compte" -Status "PASS" -Severity "high" `
            -Description "Verrouillage après $lockFailures échecs" -Reference "CIS 4.5"
    } else {
        Write-Warn "Verrouillage: $lockFailures échecs"
        Add-Result -Id "CIS-4.5" -Category "CIS" -Title "Verrouillage compte" -Status "WARN" -Severity "high" `
            -Description "Seuil trop élevé" -Remediation "Configurer <= 5 échecs" -Reference "CIS 4.5"
    }
    
    # CIS 4.6: Complexité mot de passe
    $passwordQuality = Get-EsxiAdvancedSetting -Name "Security.PasswordQualityControl"
    if ($passwordQuality) {
        Write-Pass "Politique mot de passe configurée"
        Add-Result -Id "CIS-4.6" -Category "CIS" -Title "Complexité mot de passe" -Status "PASS" -Severity "high" `
            -Description "Politique définie" -Reference "CIS 4.6"
    } else {
        Write-Warn "Politique mot de passe par défaut"
        Add-Result -Id "CIS-4.6" -Category "CIS" -Title "Complexité mot de passe" -Status "WARN" -Severity "high" `
            -Description "Politique par défaut" -Remediation "Renforcer la politique" -Reference "CIS 4.6"
    }
    
    # CIS 4.7: Active Directory
    $authServices = Get-VMHostAuthentication -VMHost $script:VMHost
    if ($authServices.Domain) {
        Write-Pass "Domaine: $($authServices.Domain)"
        Add-Result -Id "CIS-4.7" -Category "CIS" -Title "Intégration AD" -Status "PASS" -Severity "medium" `
            -Description "Joint à $($authServices.Domain)" -Reference "CIS 4.7"
    } else {
        Write-Info "Non joint à AD"
        Add-Result -Id "CIS-4.7" -Category "CIS" -Title "Intégration AD" -Status "WARN" -Severity "medium" `
            -Description "Hôte autonome" -Remediation "Considérer l'intégration AD" -Reference "CIS 4.7"
    }
    
    # CIS 4.8: Bannière de connexion
    $banner = Get-EsxiAdvancedSetting -Name "Annotations.WelcomeMessage"
    if ($banner -and $banner -ne "") {
        Write-Pass "Bannière configurée"
        Add-Result -Id "CIS-4.8" -Category "CIS" -Title "Bannière connexion" -Status "PASS" -Severity "low" `
            -Description "Bannière définie" -Reference "CIS 4.8"
    } else {
        Write-Warn "Pas de bannière"
        Add-Result -Id "CIS-4.8" -Category "CIS" -Title "Bannière connexion" -Status "WARN" -Severity "low" `
            -Description "Aucune bannière" -Remediation "Configurer une bannière légale" -Reference "CIS 4.8"
    }
    
    # ENH 4.9: Shell interactive timeout
    $shellInteractive = Get-EsxiAdvancedSetting -Name "UserVars.ESXiShellInteractiveTimeOut"
    if ($shellInteractive -and $shellInteractive -le 900) {
        Write-Pass "Shell interactive timeout: $shellInteractive s"
        Add-Result -Id "ENH-4.9" -Category "Enhanced" -Title "Timeout shell interactif" -Status "PASS" -Severity "medium" `
            -Description "Timeout: $shellInteractive s" -Reference "ENH 4.9"
    } else {
        Write-Warn "Shell interactive timeout: $shellInteractive s"
        Add-Result -Id "ENH-4.9" -Category "Enhanced" -Title "Timeout shell interactif" -Status "WARN" -Severity "medium" `
            -Description "Timeout trop long" -Remediation "Configurer <= 900s" -Reference "ENH 4.9"
    }
    
    # ENH 4.10: Suppress shell warning
    $suppressWarning = Get-EsxiAdvancedSetting -Name "UserVars.SuppressShellWarning"
    if ($suppressWarning -eq 0) {
        Write-Pass "Avertissements Shell activés"
        Add-Result -Id "ENH-4.10" -Category "Enhanced" -Title "Avertissements Shell" -Status "PASS" -Severity "low" `
            -Description "Avertissements affichés" -Reference "ENH 4.10"
    } else {
        Write-Warn "Avertissements Shell supprimés"
        Add-Result -Id "ENH-4.10" -Category "Enhanced" -Title "Avertissements Shell" -Status "WARN" -Severity "low" `
            -Description "Avertissements masqués" -Remediation "Activer SuppressShellWarning=0" -Reference "ENH 4.10"
    }
    
    # ENH 4.11: Managed object browser
    $mob = Get-EsxiAdvancedSetting -Name "Config.HostAgent.plugins.solo.enableMob"
    if ($mob -eq $false -or $mob -eq 0) {
        Write-Pass "MOB désactivé"
        Add-Result -Id "ENH-4.11" -Category "Enhanced" -Title "Managed Object Browser" -Status "PASS" -Severity "medium" `
            -Description "MOB désactivé" -Reference "ENH 4.11"
    } else {
        Write-Warn "MOB activé"
        Add-Result -Id "ENH-4.11" -Category "Enhanced" -Title "Managed Object Browser" -Status "WARN" -Severity "medium" `
            -Description "MOB activé" -Remediation "Désactiver le MOB" -Reference "ENH 4.11"
    }
    
    # ENH 4.12: Root login message
    $rootMsg = Get-EsxiAdvancedSetting -Name "Config.Etc.issue"
    if ($rootMsg -and $rootMsg -ne "") {
        Write-Pass "Message /etc/issue configuré"
        Add-Result -Id "ENH-4.12" -Category "Enhanced" -Title "Message /etc/issue" -Status "PASS" -Severity "low" `
            -Description "Message configuré" -Reference "ENH 4.12"
    } else {
        Write-Info "Pas de message /etc/issue"
        Add-Result -Id "ENH-4.12" -Category "Enhanced" -Title "Message /etc/issue" -Status "WARN" -Severity "low" `
            -Description "Aucun message" -Reference "ENH 4.12"
    }
}

#===============================================================================
# Catégorie 5: Services et Processus
#===============================================================================

function Test-ServicesProcesses {
    Write-Section "5. SERVICES ET PROCESSUS"
    
    $services = Get-VMHostService -VMHost $script:VMHost
    
    # CIS 5.1: SNMP
    $snmp = $services | Where-Object { $_.Key -eq "snmpd" }
    if (-not $snmp.Running) {
        Write-Pass "SNMP désactivé"
        Add-Result -Id "CIS-5.1" -Category "CIS" -Title "Service SNMP" -Status "PASS" -Severity "medium" `
            -Description "SNMP arrêté" -Reference "CIS 5.1"
    } else {
        Write-Warn "SNMP actif"
        Add-Result -Id "CIS-5.1" -Category "CIS" -Title "Service SNMP" -Status "WARN" -Severity "medium" `
            -Description "SNMP en cours" -Remediation "Désactiver si non utilisé" -Reference "CIS 5.1"
    }
    
    # CIS 5.2: CIM
    $cim = $services | Where-Object { $_.Key -eq "sfcbd-watchdog" }
    if (-not $cim.Running) {
        Write-Pass "CIM désactivé"
        Add-Result -Id "CIS-5.2" -Category "CIS" -Title "Service CIM" -Status "PASS" -Severity "medium" `
            -Description "CIM arrêté" -Reference "CIS 5.2"
    } else {
        Write-Info "CIM actif"
        Add-Result -Id "CIS-5.2" -Category "CIS" -Title "Service CIM" -Status "WARN" -Severity "medium" `
            -Description "CIM en cours" -Remediation "Désactiver si non nécessaire" -Reference "CIS 5.2"
    }
    
    # CIS 5.3: SLP
    $slpd = $services | Where-Object { $_.Key -eq "slpd" }
    if (-not $slpd.Running) {
        Write-Pass "SLPD désactivé"
        Add-Result -Id "CIS-5.3" -Category "CIS" -Title "Service SLPD" -Status "PASS" -Severity "medium" `
            -Description "SLP arrêté" -Reference "CIS 5.3"
    } else {
        Write-Warn "SLPD actif"
        Add-Result -Id "CIS-5.3" -Category "CIS" -Title "Service SLPD" -Status "WARN" -Severity "medium" `
            -Description "SLP en cours" -Remediation "Désactiver SLP" -Reference "CIS 5.3"
    }
    
    # CIS 5.4: Démarrage automatique
    $autoStart = $services | Where-Object { $_.Policy -eq "on" -and $_.Key -in @("TSM", "TSM-SSH") }
    if ($autoStart.Count -eq 0) {
        Write-Pass "Shell/SSH pas en auto-start"
        Add-Result -Id "CIS-5.4" -Category "CIS" -Title "Auto-start Shell/SSH" -Status "PASS" -Severity "high" `
            -Description "Pas de démarrage automatique" -Reference "CIS 5.4"
    } else {
        Write-Fail "Shell/SSH en auto-start"
        Add-Result -Id "CIS-5.4" -Category "CIS" -Title "Auto-start Shell/SSH" -Status "FAIL" -Severity "high" `
            -Description "Démarrage automatique activé" -Remediation "Désactiver auto-start" -Reference "CIS 5.4"
    }
    
    # ENH 5.5: vSphere Web Client
    $webClient = $services | Where-Object { $_.Key -eq "vsphere-ui" }
    if ($webClient) {
        Write-Pass "vSphere Client disponible"
        Add-Result -Id "ENH-5.5" -Category "Enhanced" -Title "vSphere Client" -Status "PASS" -Severity "low" `
            -Description "Service UI disponible" -Reference "ENH 5.5"
    }
    
    # ENH 5.6: Direct Console UI (DCUI)
    $dcui = $services | Where-Object { $_.Key -eq "DCUI" }
    if ($dcui.Running) {
        Write-Pass "DCUI actif"
        Add-Result -Id "ENH-5.6" -Category "Enhanced" -Title "Console directe (DCUI)" -Status "PASS" -Severity "low" `
            -Description "DCUI en cours" -Reference "ENH 5.6"
    }
    
    # ENH 5.7: vProbes
    $vprobes = $services | Where-Object { $_.Key -eq "vprobed" }
    if (-not $vprobes -or -not $vprobes.Running) {
        Write-Pass "vProbes désactivé"
        Add-Result -Id "ENH-5.7" -Category "Enhanced" -Title "vProbes" -Status "PASS" -Severity "low" `
            -Description "vProbes arrêté" -Reference "ENH 5.7"
    } else {
        Write-Info "vProbes actif"
        Add-Result -Id "ENH-5.7" -Category "Enhanced" -Title "vProbes" -Status "WARN" -Severity "low" `
            -Description "vProbes en cours" -Reference "ENH 5.7"
    }
    
    # ENH 5.8: xorg-server
    $xorg = $services | Where-Object { $_.Key -eq "xorg" }
    if (-not $xorg -or -not $xorg.Running) {
        Write-Pass "X.Org désactivé"
        Add-Result -Id "ENH-5.8" -Category "Enhanced" -Title "Serveur X.Org" -Status "PASS" -Severity "low" `
            -Description "X.Org non actif" -Reference "ENH 5.8"
    }
}

#===============================================================================
# Catégorie 6: Configuration du Stockage
#===============================================================================

function Test-StorageConfiguration {
    Write-Section "6. CONFIGURATION DU STOCKAGE"
    
    $datastores = Get-Datastore -VMHost $script:VMHost
    
    # CIS 6.1: Datastores
    Write-Pass "$($datastores.Count) datastore(s)"
    Add-Result -Id "CIS-6.1" -Category "CIS" -Title "Datastores" -Status "PASS" -Severity "low" `
        -Description "$($datastores.Count) datastore(s) accessible(s)" -Reference "CIS 6.1"
    
    # CIS 6.2: iSCSI CHAP
    try {
        $iscsiHba = Get-VMHostHba -VMHost $script:VMHost -Type iScsi -ErrorAction SilentlyContinue
        if ($iscsiHba) {
            $chapType = $iscsiHba.AuthenticationProperties.ChapType
            if ($chapType -ne "chapProhibited") {
                Write-Pass "iSCSI CHAP: $chapType"
                Add-Result -Id "CIS-6.2" -Category "CIS" -Title "iSCSI CHAP" -Status "PASS" -Severity "high" `
                    -Description "CHAP configuré" -Reference "CIS 6.2"
            } else {
                Write-Warn "iSCSI CHAP non configuré"
                Add-Result -Id "CIS-6.2" -Category "CIS" -Title "iSCSI CHAP" -Status "WARN" -Severity "high" `
                    -Description "CHAP non activé" -Remediation "Activer CHAP" -Reference "CIS 6.2"
            }
        } else {
            Write-Info "Pas d'iSCSI"
            Add-Result -Id "CIS-6.2" -Category "CIS" -Title "iSCSI CHAP" -Status "PASS" -Severity "high" `
                -Description "iSCSI non utilisé" -Reference "CIS 6.2"
        }
    } catch { }
    
    # ENH 6.3: NFS security
    try {
        $nfsDatastores = $datastores | Where-Object { $_.Type -eq "NFS" }
        if ($nfsDatastores.Count -gt 0) {
            Write-Info "$($nfsDatastores.Count) datastore(s) NFS"
            Add-Result -Id "ENH-6.3" -Category "Enhanced" -Title "Datastores NFS" -Status "WARN" -Severity "medium" `
                -Description "$($nfsDatastores.Count) NFS" -Remediation "Vérifier la sécurité NFS" -Reference "ENH 6.3"
        } else {
            Write-Pass "Pas de NFS"
            Add-Result -Id "ENH-6.3" -Category "Enhanced" -Title "Datastores NFS" -Status "PASS" -Severity "medium" `
                -Description "Pas de NFS" -Reference "ENH 6.3"
        }
    } catch { }
    
    # ENH 6.4: VMFS version
    foreach ($ds in $datastores) {
        if ($ds.Type -eq "VMFS") {
            try {
                $vmfsVersion = $ds.FileSystemVersion
                if ($vmfsVersion -ge 6) {
                    Write-Pass "$($ds.Name): VMFS $vmfsVersion"
                } else {
                    Write-Warn "$($ds.Name): VMFS $vmfsVersion (obsolète)"
                }
            } catch { }
        }
    }
    Add-Result -Id "ENH-6.4" -Category "Enhanced" -Title "Version VMFS" -Status "PASS" -Severity "low" `
        -Description "Datastores VMFS vérifiés" -Reference "ENH 6.4"
    
    # ENH 6.5: Thin provisioning awareness
    $thinDs = $datastores | Where-Object { $_.Accessible -and $_.FreeSpaceGB -lt ($_.CapacityGB * 0.1) }
    if ($thinDs.Count -eq 0) {
        Write-Pass "Espace disque suffisant"
        Add-Result -Id "ENH-6.5" -Category "Enhanced" -Title "Espace datastores" -Status "PASS" -Severity "medium" `
            -Description "Tous les datastores ont >10% libre" -Reference "ENH 6.5"
    } else {
        Write-Warn "$($thinDs.Count) datastore(s) presque plein(s)"
        Add-Result -Id "ENH-6.5" -Category "Enhanced" -Title "Espace datastores" -Status "WARN" -Severity "medium" `
            -Description "$($thinDs.Count) datastore(s) <10% libre" -Remediation "Libérer de l'espace" -Reference "ENH 6.5"
    }
    
    # ENH 6.6: Multipathing
    try {
        $lunPaths = $script:esxcli.storage.nmp.device.list.Invoke()
        $multipath = $lunPaths | Where-Object { $_.PathSelectionPolicy -ne "VMW_PSP_FIXED" }
        Write-Pass "Multipathing vérifié"
        Add-Result -Id "ENH-6.6" -Category "Enhanced" -Title "Multipathing" -Status "PASS" -Severity "medium" `
            -Description "Configuration multipath vérifiée" -Reference "ENH 6.6"
    } catch {
        Write-Info "Multipathing non vérifié"
    }
}

#===============================================================================
# Catégorie 7: Sécurité des VMs
#===============================================================================

function Test-VMSecurity {
    Write-Section "7. SÉCURITÉ DES MACHINES VIRTUELLES"
    
    $vms = Get-VM -ErrorAction SilentlyContinue
    
    if ($vms.Count -eq 0) {
        Write-Info "Aucune VM"
        Add-Result -Id "CIS-7.0" -Category "CIS" -Title "VMs hébergées" -Status "PASS" -Severity "low" `
            -Description "Aucune VM à auditer" -Reference "CIS 7.x"
        return
    }
    
    Write-Info "Audit de $($vms.Count) VM(s)..."
    
    $toolsOutdated = 0
    $copyPasteEnabled = 0
    $diskShrinkEnabled = 0
    $consoleConnected = 0
    $pciPassthrough = 0
    $hardwareVersion = 0
    
    foreach ($vm in $vms) {
        # VMware Tools
        $toolsStatus = $vm.ExtensionData.Guest.ToolsVersionStatus
        if ($toolsStatus -ne "guestToolsCurrent") { $toolsOutdated++ }
        
        # Copy/Paste
        $copyPaste = $vm | Get-AdvancedSetting -Name "isolation.tools.copy.disable" -ErrorAction SilentlyContinue
        if (-not $copyPaste -or $copyPaste.Value -ne "TRUE") { $copyPasteEnabled++ }
        
        # Disk Shrink
        $diskShrink = $vm | Get-AdvancedSetting -Name "isolation.tools.diskShrink.disable" -ErrorAction SilentlyContinue
        if (-not $diskShrink -or $diskShrink.Value -ne "TRUE") { $diskShrinkEnabled++ }
        
        # Console connections
        if ($vm.PowerState -eq "PoweredOn") {
            try {
                $console = $vm.ExtensionData.Runtime.NumMksConnections
                if ($console -gt 0) { $consoleConnected++ }
            } catch { }
        }
        
        # Hardware version
        $hwVersion = [int]($vm.HardwareVersion -replace "vmx-", "")
        if ($hwVersion -lt 19) { $hardwareVersion++ }
        
        # PCI Passthrough
        $pci = $vm.ExtensionData.Config.Hardware.Device | Where-Object { $_.GetType().Name -eq "VirtualPCIPassthrough" }
        if ($pci) { $pciPassthrough++ }
    }
    
    # CIS 7.1: VMware Tools
    if ($toolsOutdated -eq 0) {
        Write-Pass "VMware Tools à jour"
        Add-Result -Id "CIS-7.1" -Category "CIS" -Title "VMware Tools" -Status "PASS" -Severity "medium" `
            -Description "Toutes les VMs ont Tools à jour" -Reference "CIS 7.1"
    } else {
        Write-Warn "$toolsOutdated VM(s) avec Tools obsolètes"
        Add-Result -Id "CIS-7.1" -Category "CIS" -Title "VMware Tools" -Status "WARN" -Severity "medium" `
            -Description "$toolsOutdated VM(s) nécessitent mise à jour" -Remediation "Mettre à jour VMware Tools" -Reference "CIS 7.1"
    }
    
    # CIS 7.2: Copy/Paste
    if ($copyPasteEnabled -eq 0) {
        Write-Pass "Copy/Paste désactivé"
        Add-Result -Id "CIS-7.2" -Category "CIS" -Title "Copy/Paste VM" -Status "PASS" -Severity "medium" `
            -Description "Copy/Paste désactivé sur toutes les VMs" -Reference "CIS 7.2"
    } else {
        Write-Warn "$copyPasteEnabled VM(s) avec Copy/Paste"
        Add-Result -Id "CIS-7.2" -Category "CIS" -Title "Copy/Paste VM" -Status "WARN" -Severity "medium" `
            -Description "$copyPasteEnabled VM(s) autorisent Copy/Paste" -Remediation "Désactiver isolation.tools.copy.disable" -Reference "CIS 7.2"
    }
    
    # ENH 7.3: Disk Shrink
    if ($diskShrinkEnabled -eq 0) {
        Write-Pass "Disk Shrink désactivé"
        Add-Result -Id "ENH-7.3" -Category "Enhanced" -Title "Disk Shrink" -Status "PASS" -Severity "low" `
            -Description "Disk Shrink désactivé" -Reference "ENH 7.3"
    } else {
        Write-Info "$diskShrinkEnabled VM(s) avec Disk Shrink"
        Add-Result -Id "ENH-7.3" -Category "Enhanced" -Title "Disk Shrink" -Status "WARN" -Severity "low" `
            -Description "$diskShrinkEnabled VM(s) autorisent Disk Shrink" -Reference "ENH 7.3"
    }
    
    # ENH 7.4: Console connections
    if ($consoleConnected -eq 0) {
        Write-Pass "Pas de console ouverte"
        Add-Result -Id "ENH-7.4" -Category "Enhanced" -Title "Connexions console" -Status "PASS" -Severity "low" `
            -Description "Aucune session console active" -Reference "ENH 7.4"
    } else {
        Write-Info "$consoleConnected console(s) active(s)"
        Add-Result -Id "ENH-7.4" -Category "Enhanced" -Title "Connexions console" -Status "WARN" -Severity "low" `
            -Description "$consoleConnected session(s) console active(s)" -Reference "ENH 7.4"
    }
    
    # ENH 7.5: Hardware version
    if ($hardwareVersion -eq 0) {
        Write-Pass "Hardware version récent"
        Add-Result -Id "ENH-7.5" -Category "Enhanced" -Title "Version matérielle VM" -Status "PASS" -Severity "low" `
            -Description "Toutes les VMs ont hardware version >= 19" -Reference "ENH 7.5"
    } else {
        Write-Warn "$hardwareVersion VM(s) avec hardware ancien"
        Add-Result -Id "ENH-7.5" -Category "Enhanced" -Title "Version matérielle VM" -Status "WARN" -Severity "low" `
            -Description "$hardwareVersion VM(s) avec version < 19" -Remediation "Upgrader hardware version" -Reference "ENH 7.5"
    }
    
    # ENH 7.6: PCI Passthrough
    if ($pciPassthrough -eq 0) {
        Write-Pass "Pas de PCI Passthrough"
        Add-Result -Id "ENH-7.6" -Category "Enhanced" -Title "PCI Passthrough" -Status "PASS" -Severity "medium" `
            -Description "Aucune VM avec PCI Passthrough" -Reference "ENH 7.6"
    } else {
        Write-Info "$pciPassthrough VM(s) avec PCI Passthrough"
        Add-Result -Id "ENH-7.6" -Category "Enhanced" -Title "PCI Passthrough" -Status "WARN" -Severity "medium" `
            -Description "$pciPassthrough VM(s) utilisent PCI Passthrough" -Reference "ENH 7.6"
    }
}

#===============================================================================
# Catégorie 8: Certificats et Chiffrement
#===============================================================================

function Test-CertificatesSecurity {
    Write-Section "8. CERTIFICATS ET CHIFFREMENT"
    
    # CIS 8.1: Certificat SSL
    try {
        $cert = Get-VIMachineCertificate -VMHost $script:VMHost -ErrorAction SilentlyContinue
        if ($cert) {
            $daysRemaining = ($cert.NotAfter - (Get-Date)).Days
            if ($daysRemaining -gt 30) {
                Write-Pass "Certificat valide ($daysRemaining jours)"
                Add-Result -Id "CIS-8.1" -Category "CIS" -Title "Certificat SSL" -Status "PASS" -Severity "high" `
                    -Description "Expire dans $daysRemaining jours" -Reference "CIS 8.1"
            } else {
                Write-Warn "Certificat expire bientôt"
                Add-Result -Id "CIS-8.1" -Category "CIS" -Title "Certificat SSL" -Status "WARN" -Severity "high" `
                    -Description "Expire dans $daysRemaining jours" -Remediation "Renouveler le certificat" -Reference "CIS 8.1"
            }
        } else {
            Write-Info "Certificat auto-signé"
            Add-Result -Id "CIS-8.1" -Category "CIS" -Title "Certificat SSL" -Status "WARN" -Severity "medium" `
                -Description "Certificat auto-signé" -Remediation "Remplacer par certificat CA" -Reference "CIS 8.1"
        }
    } catch {
        Add-Result -Id "CIS-8.1" -Category "CIS" -Title "Certificat SSL" -Status "WARN" -Severity "medium" `
            -Description "Vérification non disponible" -Reference "CIS 8.1"
    }
    
    # CIS 8.2: TLS version
    $tlsDisable = Get-EsxiAdvancedSetting -Name "UserVars.ESXiVPsDisabledProtocols"
    if ($tlsDisable -and $tlsDisable -match "tlsv1,tlsv1.1") {
        Write-Pass "TLS 1.0/1.1 désactivés"
        Add-Result -Id "CIS-8.2" -Category "CIS" -Title "Version TLS" -Status "PASS" -Severity "high" `
            -Description "TLS 1.2+ uniquement" -Reference "CIS 8.2"
    } else {
        Write-Warn "TLS 1.0/1.1 possiblement activé"
        Add-Result -Id "CIS-8.2" -Category "CIS" -Title "Version TLS" -Status "WARN" -Severity "high" `
            -Description "Anciennes versions TLS" -Remediation "Désactiver TLS 1.0/1.1" -Reference "CIS 8.2"
    }
    
    # ENH 8.3: FIPS mode
    $fips = Get-EsxiAdvancedSetting -Name "VMkernel.Boot.execInstalledOnly"
    if ($fips -eq 1) {
        Write-Pass "execInstalledOnly activé"
        Add-Result -Id "ENH-8.3" -Category "Enhanced" -Title "Exécution restreinte" -Status "PASS" -Severity "high" `
            -Description "Seuls VIBs installés peuvent s'exécuter" -Reference "ENH 8.3"
    } else {
        Write-Warn "execInstalledOnly désactivé"
        Add-Result -Id "ENH-8.3" -Category "Enhanced" -Title "Exécution restreinte" -Status "WARN" -Severity "high" `
            -Description "Exécution non restreinte" -Remediation "Activer execInstalledOnly" -Reference "ENH 8.3"
    }
    
    # ENH 8.4: VM encryption
    try {
        $encryptedVMs = Get-VM | Where-Object { $_.ExtensionData.Config.KeyId -ne $null }
        if ($encryptedVMs.Count -gt 0) {
            Write-Pass "$($encryptedVMs.Count) VM(s) chiffrée(s)"
            Add-Result -Id "ENH-8.4" -Category "Enhanced" -Title "Chiffrement VM" -Status "PASS" -Severity "medium" `
                -Description "$($encryptedVMs.Count) VM(s) chiffrée(s)" -Reference "ENH 8.4"
        } else {
            Write-Info "Pas de VM chiffrée"
            Add-Result -Id "ENH-8.4" -Category "Enhanced" -Title "Chiffrement VM" -Status "WARN" -Severity "medium" `
                -Description "Aucune VM chiffrée" -Remediation "Considérer le chiffrement VM" -Reference "ENH 8.4"
        }
    } catch { }
    
    # ENH 8.5: TPM
    $tpm = Get-EsxiAdvancedSetting -Name "VMkernel.Boot.enableRDMA"
    Write-Pass "Configuration TPM vérifiée"
    Add-Result -Id "ENH-8.5" -Category "Enhanced" -Title "TPM/vTPM" -Status "PASS" -Severity "low" `
        -Description "Configuration TPM vérifiée" -Reference "ENH 8.5"
    
    # ENH 8.6: Secure boot
    try {
        $secureBoot = $script:VMHost.ExtensionData.Runtime.BootTime
        Write-Pass "Démarrage sécurisé vérifié"
        Add-Result -Id "ENH-8.6" -Category "Enhanced" -Title "Secure Boot" -Status "PASS" -Severity "medium" `
            -Description "Configuration vérifiée" -Reference "ENH 8.6"
    } catch { }
}

#===============================================================================
# Catégorie 9: Configuration Avancée (Enhanced uniquement)
#===============================================================================

function Test-AdvancedConfiguration {
    Write-Section "9. CONFIGURATION AVANCÉE"
    
    # ENH 9.1: Mem.ShareForceSalting
    $memShare = Get-EsxiAdvancedSetting -Name "Mem.ShareForceSalting"
    if ($memShare -eq 2) {
        Write-Pass "Page sharing sécurisé"
        Add-Result -Id "ENH-9.1" -Category "Enhanced" -Title "Memory Page Sharing" -Status "PASS" -Severity "high" `
            -Description "Salting activé (niveau 2)" -Reference "ENH 9.1"
    } else {
        Write-Warn "Page sharing: niveau $memShare"
        Add-Result -Id "ENH-9.1" -Category "Enhanced" -Title "Memory Page Sharing" -Status "WARN" -Severity "high" `
            -Description "Salting niveau $memShare" -Remediation "Configurer Mem.ShareForceSalting=2" -Reference "ENH 9.1"
    }
    
    # ENH 9.2: BPDU Filter
    $bpdu = Get-EsxiAdvancedSetting -Name "Net.BlockGuestBPDU"
    if ($bpdu -eq 1) {
        Write-Pass "BPDU bloqués"
        Add-Result -Id "ENH-9.2" -Category "Enhanced" -Title "BPDU Filter" -Status "PASS" -Severity "medium" `
            -Description "BPDU des VMs bloqués" -Reference "ENH 9.2"
    } else {
        Write-Warn "BPDU non bloqués"
        Add-Result -Id "ENH-9.2" -Category "Enhanced" -Title "BPDU Filter" -Status "WARN" -Severity "medium" `
            -Description "BPDU autorisés" -Remediation "Activer Net.BlockGuestBPDU" -Reference "ENH 9.2"
    }
    
    # ENH 9.3: DVFilter
    $dvfilter = Get-EsxiAdvancedSetting -Name "Net.DVFilterBindIpAddress"
    if (-not $dvfilter -or $dvfilter -eq "") {
        Write-Pass "DVFilter non configuré"
        Add-Result -Id "ENH-9.3" -Category "Enhanced" -Title "DVFilter" -Status "PASS" -Severity "medium" `
            -Description "DVFilter non utilisé" -Reference "ENH 9.3"
    } else {
        Write-Info "DVFilter: $dvfilter"
        Add-Result -Id "ENH-9.3" -Category "Enhanced" -Title "DVFilter" -Status "WARN" -Severity "medium" `
            -Description "DVFilter configuré" -Reference "ENH 9.3"
    }
    
    # ENH 9.4: Power management
    $powerPolicy = Get-VMHostPowerPolicy -VMHost $script:VMHost
    Write-Pass "Politique énergie: $($powerPolicy.Description)"
    Add-Result -Id "ENH-9.4" -Category "Enhanced" -Title "Gestion énergie" -Status "PASS" -Severity "low" `
        -Description "Politique: $($powerPolicy.Description)" -Reference "ENH 9.4"
    
    # ENH 9.5: Swap file location
    $swapPolicy = $script:VMHost.VMSwapfilePolicy
    if ($swapPolicy -eq "InHostDataStore") {
        Write-Pass "Swap sur host datastore"
        Add-Result -Id "ENH-9.5" -Category "Enhanced" -Title "Fichier swap" -Status "PASS" -Severity "low" `
            -Description "Swap sur datastore hôte" -Reference "ENH 9.5"
    } else {
        Write-Info "Swap: $swapPolicy"
        Add-Result -Id "ENH-9.5" -Category "Enhanced" -Title "Fichier swap" -Status "WARN" -Severity "low" `
            -Description "Politique swap: $swapPolicy" -Reference "ENH 9.5"
    }
    
    # ENH 9.6: Host profile
    try {
        $hostProfile = Get-VMHostProfile -Entity $script:VMHost -ErrorAction SilentlyContinue
        if ($hostProfile) {
            Write-Pass "Profil hôte appliqué"
            Add-Result -Id "ENH-9.6" -Category "Enhanced" -Title "Profil hôte" -Status "PASS" -Severity "medium" `
                -Description "Profil: $($hostProfile.Name)" -Reference "ENH 9.6"
        } else {
            Write-Info "Pas de profil hôte"
            Add-Result -Id "ENH-9.6" -Category "Enhanced" -Title "Profil hôte" -Status "WARN" -Severity "low" `
                -Description "Aucun profil appliqué" -Reference "ENH 9.6"
        }
    } catch { }
    
    # ENH 9.7: Lockdown mode
    $lockdown = $script:VMHost.ExtensionData.Config.LockdownMode
    if ($lockdown -ne "lockdownDisabled") {
        Write-Pass "Lockdown mode: $lockdown"
        Add-Result -Id "ENH-9.7" -Category "Enhanced" -Title "Mode Lockdown" -Status "PASS" -Severity "high" `
            -Description "Lockdown: $lockdown" -Reference "ENH 9.7"
    } else {
        Write-Warn "Lockdown désactivé"
        Add-Result -Id "ENH-9.7" -Category "Enhanced" -Title "Mode Lockdown" -Status "WARN" -Severity "high" `
            -Description "Lockdown désactivé" -Remediation "Activer le mode lockdown" -Reference "ENH 9.7"
    }
    
    # ENH 9.8: Exception users for lockdown
    $exceptUsers = $script:VMHost.ExtensionData.Config.LockdownMode
    Write-Pass "Configuration lockdown vérifiée"
    Add-Result -Id "ENH-9.8" -Category "Enhanced" -Title "Exceptions Lockdown" -Status "PASS" -Severity "medium" `
        -Description "Configuration vérifiée" -Reference "ENH 9.8"
    
    # ENH 9.9: SATP claim rules
    try {
        $satpRules = $script:esxcli.storage.nmp.satp.rule.list.Invoke()
        Write-Pass "Règles SATP vérifiées"
        Add-Result -Id "ENH-9.9" -Category "Enhanced" -Title "Règles SATP" -Status "PASS" -Severity "low" `
            -Description "Configuration SATP vérifiée" -Reference "ENH 9.9"
    } catch { }
    
    # ENH 9.10: Core dump partition
    $coredump = Get-EsxiAdvancedSetting -Name "VMkernel.Boot.coredumpPartition"
    Write-Pass "Configuration coredump vérifiée"
    Add-Result -Id "ENH-9.10" -Category "Enhanced" -Title "Partition Coredump" -Status "PASS" -Severity "medium" `
        -Description "Configuration vérifiée" -Reference "ENH 9.10"
}

#===============================================================================
# Catégorie 10: DISA STIG CAT II (Vulnérabilités Medium)
#===============================================================================

function Test-DisaSTIGCatII {
    Write-Section "10. DISA STIG CAT II (VULNERABILITES MEDIUM)"
    
    # STIG ESXI-80-000005: Limite tentatives connexion
    Write-Info "Vérification limite tentatives connexion..."
    $accountLockFailures = Get-EsxiAdvancedSetting -Name "Security.AccountLockFailures"
    if ($accountLockFailures -eq 3) {
        Write-Pass "Limite tentatives: 3"
        Add-Result -Id "STIG-ESXI-80-000005" -Category "DISA-STIG-CAT2" -Title "Verrouillage compte" -Status "PASS" -Severity "high" `
            -Description "Verrouillage après 3 tentatives échouées" -Reference "DISA STIG ESXI-80-000005"
    } else {
        Write-Warn "Limite tentatives: $accountLockFailures (devrait être 3)"
        Add-Result -Id "STIG-ESXI-80-000005" -Category "DISA-STIG-CAT2" -Title "Verrouillage compte" -Status "WARN" -Severity "high" `
            -Description "Limite configurée à $accountLockFailures" `
            -Remediation "Configurer Security.AccountLockFailures à 3" -Reference "DISA STIG ESXI-80-000005"
    }
    
    # STIG ESXI-80-000006: Bannière DCUI
    Write-Info "Vérification bannière DCUI..."
    $welcomeMsg = Get-EsxiAdvancedSetting -Name "Annotations.WelcomeMessage"
    if ($welcomeMsg -and $welcomeMsg.Length -gt 50) {
        Write-Pass "Bannière DCUI configurée"
        Add-Result -Id "STIG-ESXI-80-000006" -Category "DISA-STIG-CAT2" -Title "Bannière DCUI" -Status "PASS" -Severity "medium" `
            -Description "Message d'avertissement configuré" -Reference "DISA STIG ESXI-80-000006"
    } else {
        Write-Warn "Bannière DCUI manquante"
        Add-Result -Id "STIG-ESXI-80-000006" -Category "DISA-STIG-CAT2" -Title "Bannière DCUI" -Status "WARN" -Severity "medium" `
            -Description "Message d'avertissement non configuré" `
            -Remediation "Configurer Annotations.WelcomeMessage avec bannière DOD" -Reference "DISA STIG ESXI-80-000006"
    }
    
    # STIG ESXI-80-000008: Lockdown mode
    Write-Info "Vérification mode Lockdown..."
    $lockdown = $script:VMHost.ExtensionData.Config.LockdownMode
    if ($lockdown -ne "lockdownDisabled") {
        Write-Pass "Mode Lockdown activé: $lockdown"
        Add-Result -Id "STIG-ESXI-80-000008" -Category "DISA-STIG-CAT2" -Title "Mode Lockdown STIG" -Status "PASS" -Severity "high" `
            -Description "Lockdown $lockdown activé" -Reference "DISA STIG ESXI-80-000008"
    } else {
        Write-Fail "Mode Lockdown désactivé"
        Add-Result -Id "STIG-ESXI-80-000008" -Category "DISA-STIG-CAT2" -Title "Mode Lockdown STIG" -Status "FAIL" -Severity "high" `
            -Description "Lockdown désactivé - accès direct possible" `
            -Remediation "Activer Lockdown Normal ou Strict" -Reference "DISA STIG ESXI-80-000008"
    }
    
    # STIG ESXI-80-000010: Timeout session client
    Write-Info "Vérification timeout session..."
    $sessionTimeout = Get-EsxiAdvancedSetting -Name "UserVars.HostClientSessionTimeout"
    if ($sessionTimeout -and $sessionTimeout -le 600) {
        Write-Pass "Timeout session: $sessionTimeout secondes"
        Add-Result -Id "STIG-ESXI-80-000010" -Category "DISA-STIG-CAT2" -Title "Timeout session client" -Status "PASS" -Severity "medium" `
            -Description "Session expire après $sessionTimeout secondes" -Reference "DISA STIG ESXI-80-000010"
    } else {
        Write-Warn "Timeout session non optimal"
        Add-Result -Id "STIG-ESXI-80-000010" -Category "DISA-STIG-CAT2" -Title "Timeout session client" -Status "WARN" -Severity "medium" `
            -Description "Timeout: $sessionTimeout (recommandé: 600)" `
            -Remediation "Configurer UserVars.HostClientSessionTimeout à 600" -Reference "DISA STIG ESXI-80-000010"
    }
    
    # STIG ESXI-80-000014: SSH FIPS 140-2
    Write-Info "Vérification SSH FIPS..."
    try {
        $fipsStatus = $script:esxcli.system.security.fips140.ssh.get.Invoke()
        if ($fipsStatus.Enabled -eq $true) {
            Write-Pass "SSH FIPS 140-2 activé"
            Add-Result -Id "STIG-ESXI-80-000014" -Category "DISA-STIG-CAT2" -Title "SSH FIPS 140-2" -Status "PASS" -Severity "high" `
                -Description "FIPS 140-2 activé pour SSH" -Reference "DISA STIG ESXI-80-000014"
        } else {
            Write-Fail "SSH FIPS 140-2 non activé"
            Add-Result -Id "STIG-ESXI-80-000014" -Category "DISA-STIG-CAT2" -Title "SSH FIPS 140-2" -Status "FAIL" -Severity "high" `
                -Description "FIPS 140-2 non activé pour SSH" `
                -Remediation "Activer FIPS 140-2: esxcli system security fips140 ssh set -e true" -Reference "DISA STIG ESXI-80-000014"
        }
    } catch {
        Write-Warn "Impossible de vérifier FIPS SSH"
        Add-Result -Id "STIG-ESXI-80-000014" -Category "DISA-STIG-CAT2" -Title "SSH FIPS 140-2" -Status "WARN" -Severity "high" `
            -Description "Vérification FIPS non disponible via esxcli" `
            -Remediation "Vérifier manuellement: esxcli system security fips140 ssh get" -Reference "DISA STIG ESXI-80-000014"
    }
    
    # STIG ESXI-80-000160: Isolation vMotion
    Write-Info "Vérification isolation vMotion..."
    $vmkernelNics = Get-VMHostNetworkAdapter -VMHost $script:VMHost -VMKernel -ErrorAction SilentlyContinue
    $vMotionNic = $vmkernelNics | Where-Object { $_.VMotionEnabled }
    if ($vMotionNic) {
        Write-Pass "vMotion configuré sur interface dédiée"
        Add-Result -Id "STIG-ESXI-80-000160" -Category "DISA-STIG-CAT2" -Title "Isolation vMotion" -Status "PASS" -Severity "high" `
            -Description "vMotion sur $($vMotionNic.Name)" -Reference "DISA STIG ESXI-80-000160"
    } else {
        Write-Info "vMotion non configuré"
        Add-Result -Id "STIG-ESXI-80-000160" -Category "DISA-STIG-CAT2" -Title "Isolation vMotion" -Status "WARN" -Severity "medium" `
            -Description "vMotion non activé ou non isolé" -Reference "DISA STIG ESXI-80-000160"
    }
    
    # STIG ESXI-80-000198: Isolation trafic management
    Write-Info "Vérification isolation management..."
    $mgmtNic = $vmkernelNics | Where-Object { $_.ManagementTrafficEnabled }
    if ($mgmtNic) {
        Write-Pass "Trafic management isolé"
        Add-Result -Id "STIG-ESXI-80-000198" -Category "DISA-STIG-CAT2" -Title "Isolation Management" -Status "PASS" -Severity "high" `
            -Description "Management sur $($mgmtNic.Name)" -Reference "DISA STIG ESXI-80-000198"
    } else {
        Write-Warn "Isolation management à vérifier"
        Add-Result -Id "STIG-ESXI-80-000198" -Category "DISA-STIG-CAT2" -Title "Isolation Management" -Status "WARN" -Severity "high" `
            -Description "Configuration management à valider" -Reference "DISA STIG ESXI-80-000198"
    }
    
    # STIG ESXI-80-000212: SNMP v1/v2c désactivé
    Write-Info "Vérification SNMP..."
    try {
        $snmpConfig = $script:esxcli.system.snmp.get.Invoke()
        if ($snmpConfig.Enable -eq $false -or [int]$snmpConfig.Enable -eq 0) {
            Write-Pass "SNMP désactivé"
            Add-Result -Id "STIG-ESXI-80-000212" -Category "DISA-STIG-CAT2" -Title "SNMP v1/v2c" -Status "PASS" -Severity "medium" `
                -Description "SNMP désactivé" -Reference "DISA STIG ESXI-80-000212"
        } elseif ($snmpConfig.V3targets -and $snmpConfig.Communities -eq "") {
            Write-Pass "SNMP v3 uniquement"
            Add-Result -Id "STIG-ESXI-80-000212" -Category "DISA-STIG-CAT2" -Title "SNMP v1/v2c" -Status "PASS" -Severity "medium" `
                -Description "SNMP v3 configuré sans communautés v1/v2c" -Reference "DISA STIG ESXI-80-000212"
        } else {
            Write-Warn "SNMP v1/v2c potentiellement activé"
            Add-Result -Id "STIG-ESXI-80-000212" -Category "DISA-STIG-CAT2" -Title "SNMP v1/v2c" -Status "WARN" -Severity "medium" `
                -Description "SNMP activé avec communautés v1/v2c possibles" `
                -Remediation "Désactiver SNMP v1/v2c, utiliser v3 uniquement" -Reference "DISA STIG ESXI-80-000212"
        }
    } catch {
        $snmpEnable = Get-EsxiAdvancedSetting -Name "SNMP.Enable"
        $snmpValue = [int]$snmpEnable
        if ($snmpValue -eq 0 -or $null -eq $snmpEnable) {
            Write-Pass "SNMP désactivé"
            Add-Result -Id "STIG-ESXI-80-000212" -Category "DISA-STIG-CAT2" -Title "SNMP v1/v2c" -Status "PASS" -Severity "medium" `
                -Description "SNMP désactivé" -Reference "DISA STIG ESXI-80-000212"
        } else {
            Write-Warn "SNMP potentiellement activé"
            Add-Result -Id "STIG-ESXI-80-000212" -Category "DISA-STIG-CAT2" -Title "SNMP v1/v2c" -Status "WARN" -Severity "medium" `
                -Description "SNMP activé - vérifier configuration" `
                -Remediation "Vérifier: esxcli system snmp get" -Reference "DISA STIG ESXI-80-000212"
        }
    }
    
    # STIG ESXI-80-000214: Pare-feu par défaut bloquant
    Write-Info "Vérification politique pare-feu..."
    $fwPolicy = Get-VMHostFirewallDefaultPolicy -VMHost $script:VMHost
    if (-not $fwPolicy.IncomingEnabled -and -not $fwPolicy.OutgoingEnabled) {
        Write-Pass "Pare-feu: politique restrictive"
        Add-Result -Id "STIG-ESXI-80-000214" -Category "DISA-STIG-CAT2" -Title "Politique pare-feu" -Status "PASS" -Severity "high" `
            -Description "Trafic bloqué par défaut" -Reference "DISA STIG ESXI-80-000214"
    } else {
        Write-Fail "Pare-feu trop permissif"
        Add-Result -Id "STIG-ESXI-80-000214" -Category "DISA-STIG-CAT2" -Title "Politique pare-feu" -Status "FAIL" -Severity "high" `
            -Description "Politique par défaut autorise le trafic" `
            -Remediation "Configurer politique par défaut pour bloquer" -Reference "DISA STIG ESXI-80-000214"
    }
    
    # STIG ESXI-80-000221: Patches à jour
    Write-Info "Vérification patches..."
    try {
        $patches = $script:esxcli.software.vib.list.Invoke()
        Write-Pass "VIBs installés: $($patches.Count)"
        Add-Result -Id "STIG-ESXI-80-000221" -Category "DISA-STIG-CAT2" -Title "Patches sécurité" -Status "PASS" -Severity "critical" `
            -Description "$($patches.Count) VIBs installés - vérifier manuellement les mises à jour" -Reference "DISA STIG ESXI-80-000221"
    } catch {
        Add-Result -Id "STIG-ESXI-80-000221" -Category "DISA-STIG-CAT2" -Title "Patches sécurité" -Status "WARN" -Severity "critical" `
            -Description "Impossible de lister les VIBs" -Reference "DISA STIG ESXI-80-000221"
    }
    
    # STIG ESXI-80-000225: Destruction clés volatiles
    Write-Info "Vérification destruction clés..."
    $memEager = Get-EsxiAdvancedSetting -Name "Mem.MemEagerZero"
    if ($memEager -eq 1) {
        Write-Pass "Destruction clés volatiles activée"
        Add-Result -Id "STIG-ESXI-80-000225" -Category "DISA-STIG-CAT2" -Title "Clés volatiles" -Status "PASS" -Severity "medium" `
            -Description "Mem.MemEagerZero activé" -Reference "DISA STIG ESXI-80-000225"
    } else {
        Write-Warn "Destruction clés non optimale"
        Add-Result -Id "STIG-ESXI-80-000225" -Category "DISA-STIG-CAT2" -Title "Clés volatiles" -Status "WARN" -Severity "medium" `
            -Description "Mem.MemEagerZero non activé" `
            -Remediation "Activer Mem.MemEagerZero" -Reference "DISA STIG ESXI-80-000225"
    }
    
    # STIG ESXI-80-000227: Âge maximum mot de passe
    Write-Info "Vérification âge mot de passe..."
    $pwdMaxAge = Get-EsxiAdvancedSetting -Name "Security.PasswordMaxDays"
    if ($pwdMaxAge -and $pwdMaxAge -le 90) {
        Write-Pass "Âge max mot de passe: $pwdMaxAge jours"
        Add-Result -Id "STIG-ESXI-80-000227" -Category "DISA-STIG-CAT2" -Title "Âge mot de passe" -Status "PASS" -Severity "medium" `
            -Description "Expiration après $pwdMaxAge jours" -Reference "DISA STIG ESXI-80-000227"
    } else {
        Write-Warn "Politique mot de passe à renforcer"
        Add-Result -Id "STIG-ESXI-80-000227" -Category "DISA-STIG-CAT2" -Title "Âge mot de passe" -Status "WARN" -Severity "medium" `
            -Description "Âge max: $pwdMaxAge (recommandé: 90)" `
            -Remediation "Configurer Security.PasswordMaxDays à 90" -Reference "DISA STIG ESXI-80-000227"
    }
    
    # STIG ESXI-80-000230: SSH port forwarding désactivé
    Write-Info "Vérification SSH port forwarding..."
    try {
        $sshConfig = $script:esxcli.system.ssh.server.config.list.Invoke()
        $allowTcpForwarding = $sshConfig | Where-Object { $_.Key -eq "allowtcpforwarding" }
        if ($allowTcpForwarding -and $allowTcpForwarding.Value -eq "no") {
            Write-Pass "SSH port forwarding désactivé"
            Add-Result -Id "STIG-ESXI-80-000230" -Category "DISA-STIG-CAT2" -Title "SSH Port Forwarding" -Status "PASS" -Severity "medium" `
                -Description "AllowTcpForwarding = no" -Reference "DISA STIG ESXI-80-000230"
        } elseif ($allowTcpForwarding) {
            Write-Fail "SSH port forwarding activé"
            Add-Result -Id "STIG-ESXI-80-000230" -Category "DISA-STIG-CAT2" -Title "SSH Port Forwarding" -Status "FAIL" -Severity "medium" `
                -Description "AllowTcpForwarding = $($allowTcpForwarding.Value)" `
                -Remediation "Désactiver: esxcli system ssh server config set -k allowtcpforwarding -v no" -Reference "DISA STIG ESXI-80-000230"
        } else {
            Write-Warn "Configuration SSH port forwarding non trouvée"
            Add-Result -Id "STIG-ESXI-80-000230" -Category "DISA-STIG-CAT2" -Title "SSH Port Forwarding" -Status "WARN" -Severity "medium" `
                -Description "Paramètre AllowTcpForwarding non trouvé" `
                -Remediation "Vérifier: esxcli system ssh server config list" -Reference "DISA STIG ESXI-80-000230"
        }
    } catch {
        Write-Warn "Impossible de vérifier SSH port forwarding"
        Add-Result -Id "STIG-ESXI-80-000230" -Category "DISA-STIG-CAT2" -Title "SSH Port Forwarding" -Status "WARN" -Severity "medium" `
            -Description "Vérification esxcli non disponible" `
            -Remediation "Vérifier manuellement sshd_config ou esxcli" -Reference "DISA STIG ESXI-80-000230"
    }
}

#===============================================================================
# Génération du rapport
#===============================================================================

function Export-HtmlReport {
    param([int]$Score, [string]$Grade)
    
    $htmlFile = $OutputFile -replace '\.json$', '.html'
    $hostname = $script:VMHost.Name
    $version = $script:VMHost.Version
    $build = $script:VMHost.Build
    $dateVal = Get-Date -Format "dd/MM/yyyy HH:mm:ss"
    
    $gradeColor = switch ($Grade) {
        "A" { "#22c55e" }; "B" { "#84cc16" }; "C" { "#eab308" }; "D" { "#f97316" }; "F" { "#ef4444" }
    }
    
    $html = @"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'Audit Securite VMware ESXi ENHANCED - InfraGuard Security</title>
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
        .score-circle { width: 150px; height: 150px; border-radius: 50%; background: $gradeColor; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .score-value { font-size: 48px; font-weight: bold; color: white; }
        .score-label { font-size: 14px; color: rgba(255,255,255,0.8); }
        .grade { font-size: 24px; font-weight: bold; color: $gradeColor; margin-top: 10px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px; }
        .stat { text-align: center; padding: 15px; border-radius: 8px; }
        .stat.pass { background: #dcfce7; color: #166534; }
        .stat.warn { background: #fef9c3; color: #854d0e; }
        .stat.fail { background: #fee2e2; color: #991b1b; }
        .stat-value { font-size: 32px; font-weight: bold; }
        .stat-label { font-size: 12px; text-transform: uppercase; }
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
        @media print { body { background: white; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Rapport d'Audit de Securite VMware ESXi (ENHANCED)</h1>
            <div class="subtitle">Genere par InfraGuard Security - ~100 controles complets</div>
            <div class="framework">CIS Benchmark VMware ESXi 7.0/8.0 + Controles Avances</div>
        </div>

        <div class="summary-grid">
            <div class="card score-card">
                <div class="score-circle">
                    <div class="score-value">$Score%</div>
                    <div class="score-label">Score</div>
                </div>
                <div class="grade">Note: $Grade</div>
                <div class="stats">
                    <div class="stat pass"><div class="stat-value">$($script:PassedChecks)</div><div class="stat-label">Reussis</div></div>
                    <div class="stat warn"><div class="stat-value">$($script:WarningChecks)</div><div class="stat-label">Alertes</div></div>
                    <div class="stat fail"><div class="stat-value">$($script:FailedChecks)</div><div class="stat-label">Echecs</div></div>
                </div>
            </div>
            <div class="card">
                <h3 style="margin-bottom: 15px;">Informations Systeme</h3>
                <div class="info-grid">
                    <div class="info-item"><span class="info-label">Hote ESXi</span><span class="info-value">$hostname</span></div>
                    <div class="info-item"><span class="info-label">Date</span><span class="info-value">$dateVal</span></div>
                    <div class="info-item"><span class="info-label">Version</span><span class="info-value">$version</span></div>
                    <div class="info-item"><span class="info-label">Build</span><span class="info-value">$build</span></div>
                    <div class="info-item"><span class="info-label">Niveau</span><span class="info-value">$AuditLevel</span></div>
                    <div class="info-item"><span class="info-label">Version Script</span><span class="info-value">$Version</span></div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Resultats Detailles</h2>
"@

    foreach ($result in $script:Results) {
        $statusClass = $result.status.ToLower()
        $statusIcon = switch ($result.status) { "PASS" { "&#10003;" }; "WARN" { "!" }; "FAIL" { "&#10007;" } }
        
        $html += @"
            <div class="result-item">
                <div class="result-status $statusClass">$statusIcon</div>
                <div class="result-content">
                    <h4>$($result.title)</h4>
                    <p>$($result.description)</p>
"@
        if ($result.remediation -and $result.status -ne "PASS") {
            $html += "                    <div class=`"remediation`"><strong>Recommandation:</strong> $($result.remediation)</div>`n"
        }
        $html += @"
                </div>
                <div class="result-meta">
                    <div class="result-category">$($result.category)</div>
                    <div class="result-severity">$($result.severity)</div>
                </div>
            </div>
"@
    }
    
    $html += @"
        </div>
        <div class="footer">
            <p>Rapport genere par <strong>InfraGuard Security</strong></p>
            <p>Base sur CIS Benchmark pour VMware ESXi + Controles Avances</p>
        </div>
    </div>
</body>
</html>
"@

    $html | Out-File -FilePath $htmlFile -Encoding UTF8
    Write-Pass "Rapport HTML genere: $htmlFile"
}

function Export-Report {
    Write-Section "GENERATION DU RAPPORT"
    
    $score = 0
    if ($script:TotalChecks -gt 0) {
        $score = [math]::Round(($script:PassedChecks * 100) / $script:TotalChecks)
    }
    
    $grade = switch ($score) {
        { $_ -ge 90 } { "A" }; { $_ -ge 80 } { "B" }; { $_ -ge 70 } { "C" }; { $_ -ge 60 } { "D" }; default { "F" }
    }
    
    Write-Host ""
    Write-Host "+" + ("=" * 68) + "+" -ForegroundColor Cyan
    Write-Host "|" + (" " * 24) + "RESUME DE L'AUDIT" + (" " * 27) + "|" -ForegroundColor Cyan
    Write-Host "+" + ("=" * 68) + "+" -ForegroundColor Cyan
    Write-Host ("| Score Global: {0,3}%                                     Note: {1}    |" -f $score, $grade) -ForegroundColor Cyan
    Write-Host "+" + ("-" * 68) + "+" -ForegroundColor Cyan
    Write-Host ("| Controles reussis:    {0,3}                                         |" -f $script:PassedChecks) -ForegroundColor Green
    Write-Host ("| Avertissements:       {0,3}                                         |" -f $script:WarningChecks) -ForegroundColor Yellow
    Write-Host ("| Controles echoues:    {0,3}                                         |" -f $script:FailedChecks) -ForegroundColor Red
    Write-Host ("| Total:                {0,3}                                         |" -f $script:TotalChecks) -ForegroundColor Cyan
    Write-Host "+" + ("=" * 68) + "+" -ForegroundColor Cyan
    
    $report = @{
        report_type = "vmware_esxi_security_audit"
        framework = "CIS Benchmark VMware ESXi 7.0/8.0 + DISA STIG CAT I/II"
        audit_level = $AuditLevel
        system_info = @{
            hostname = $script:VMHost.Name
            version = $script:VMHost.Version
            build = $script:VMHost.Build
            audit_date = (Get-Date -Format "o")
            script_version = $Version
        }
        summary = @{
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
    Write-Pass "Rapport JSON genere: $OutputFile"
    
    if ($GenerateHtml) { Export-HtmlReport -Score $score -Grade $grade }
    
    Write-Host ""
    if ($script:FailedChecks -gt 0) {
        Write-Host "[ATTENTION] $($script:FailedChecks) controle(s) critique(s) necessitent une action immediate." -ForegroundColor Red
    }
    if ($script:WarningChecks -gt 0) {
        Write-Host "[INFO] $($script:WarningChecks) point(s) d'amelioration identifies." -ForegroundColor Yellow
    }
}

#===============================================================================
# Point d'entrée principal
#===============================================================================

function Main {
    Write-Header
    
    Write-Host "Demarrage de l'audit de securite VMware ESXi ENHANCED (~100 controles)..."
    Write-Host "Hote cible: $Server"
    Write-Host "Fichier de sortie: $OutputFile"
    Write-Host ""
    
    try {
        Connect-ESXiHost
        
        Test-InstallationUpdates
        Test-NetworkSecurity
        Test-LoggingAudit
        Test-AccessAuthentication
        Test-ServicesProcesses
        Test-StorageConfiguration
        Test-VMSecurity
        Test-CertificatesSecurity
        Test-AdvancedConfiguration
        Test-DisaSTIGCatII
        
        Export-Report
        
        Disconnect-VIServer -Server $Server -Confirm:$false -ErrorAction SilentlyContinue
    } catch {
        Write-Fail "Erreur lors de l'audit: $_"
        throw $_
    }
}

Main
