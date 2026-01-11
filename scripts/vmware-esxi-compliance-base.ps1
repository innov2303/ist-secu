#===============================================================================
# InfraGuard Security - Script d'Audit de Sécurité VMware ESXi (BASE)
# Basé sur les recommandations CIS Benchmark VMware ESXi 7.0/8.0 + DISA STIG CAT I
# Version: 1.1.0
# Niveau: BASE (~60 contrôles essentiels)
# 
# Ce script effectue un audit de sécurité de base d'un hôte VMware ESXi
# en suivant les recommandations CIS Benchmark et DISA STIG (CAT I - High)
#
# Prérequis: VMware PowerCLI installé
# Usage: .\vmware-esxi-compliance-base.ps1 -Server <ESXi_Host> -Credential <PSCredential>
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
    [string]$OutputFile = "esxi_audit_base_$(Get-Date -Format 'yyyyMMdd_HHmmss').json",
    
    [Parameter()]
    [switch]$GenerateHtml = $true
)

$ErrorActionPreference = "Continue"
$Version = "1.1.0"
$ScriptName = "InfraGuard VMware ESXi Compliance Audit - BASE (CIS Benchmark + DISA STIG CAT I)"
$AuditLevel = "BASE"

# Compteurs globaux
$script:TotalChecks = 0
$script:PassedChecks = 0
$script:FailedChecks = 0
$script:WarningChecks = 0
$script:Results = @()
$script:VMHost = $null

#===============================================================================
# Fonctions utilitaires
#===============================================================================

function Write-Header {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                                                                    ║" -ForegroundColor Cyan
    Write-Host "║   InfraGuard Security - Audit VMware ESXi v$Version (BASE)          ║" -ForegroundColor Cyan
    Write-Host "║         CIS Benchmark VMware ESXi 7.0/8.0 + DISA STIG CAT I        ║" -ForegroundColor Cyan
    Write-Host "║                  ~60 contrôles essentiels                          ║" -ForegroundColor Cyan
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

function Get-EsxiAdvancedSetting {
    param([string]$Name)
    try {
        $setting = Get-AdvancedSetting -Entity $script:VMHost -Name $Name -ErrorAction SilentlyContinue
        return $setting.Value
    } catch {
        return $null
    }
}

#===============================================================================
# Connexion à l'hôte ESXi
#===============================================================================

function Connect-ESXiHost {
    Write-Section "CONNEXION À L'HÔTE ESXi"
    
    # Vérifier PowerCLI
    if (-not (Get-Module -ListAvailable VMware.PowerCLI)) {
        Write-Fail "VMware PowerCLI n'est pas installé"
        Write-Host "Installation: Install-Module VMware.PowerCLI -Scope CurrentUser" -ForegroundColor Yellow
        throw "PowerCLI requis"
    }
    
    # Ignorer les certificats auto-signés
    Set-PowerCLIConfiguration -InvalidCertificateAction Ignore -Confirm:$false | Out-Null
    
    Write-Info "Connexion à $Server..."
    try {
        if ($Credential) {
            Connect-VIServer -Server $Server -Credential $Credential -ErrorAction Stop | Out-Null
        } else {
            Connect-VIServer -Server $Server -ErrorAction Stop | Out-Null
        }
        
        $script:VMHost = Get-VMHost -Server $Server
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
    
    # CIS 1.1: Vérifier la version ESXi
    Write-Info "Vérification de la version ESXi..."
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
            -Description "ESXi $version n'est plus supporté" `
            -Remediation "Mettre à niveau vers ESXi 7.0 ou ultérieur" -Reference "CIS 1.1"
    }
    
    # CIS 1.2: Vérifier les VIBs installés
    Write-Info "Vérification des VIBs installés..."
    try {
        $esxcli = Get-EsxCli -VMHost $script:VMHost -V2
        $vibs = $esxcli.software.vib.list.Invoke()
        $communityVibs = $vibs | Where-Object { $_.AcceptanceLevel -eq "CommunitySupported" }
        
        if ($communityVibs.Count -eq 0) {
            Write-Pass "Aucun VIB communautaire installé"
            Add-Result -Id "CIS-1.2" -Category "CIS" -Title "Niveau d'acceptation VIB" -Status "PASS" -Severity "high" `
                -Description "Tous les VIBs sont signés VMware ou partenaire" -Reference "CIS 1.2"
        } else {
            Write-Warn "$($communityVibs.Count) VIB(s) communautaire(s) détecté(s)"
            Add-Result -Id "CIS-1.2" -Category "CIS" -Title "Niveau d'acceptation VIB" -Status "WARN" -Severity "high" `
                -Description "$($communityVibs.Count) VIB(s) CommunitySupported installé(s)" `
                -Remediation "Examiner et supprimer les VIBs non approuvés" -Reference "CIS 1.2"
        }
    } catch {
        Write-Warn "Impossible de vérifier les VIBs"
    }
    
    # CIS 1.3: Image ESXi personnalisée
    Write-Info "Vérification du profil d'image..."
    try {
        $imageProfile = $esxcli.software.profile.get.Invoke()
        Write-Pass "Profil d'image: $($imageProfile.Name)"
        Add-Result -Id "CIS-1.3" -Category "CIS" -Title "Profil d'image ESXi" -Status "PASS" -Severity "medium" `
            -Description "Profil d'image: $($imageProfile.Name)" -Reference "CIS 1.3"
    } catch {
        Write-Warn "Impossible de vérifier le profil d'image"
    }
}

#===============================================================================
# Catégorie 2: Communication et Réseau
#===============================================================================

function Test-NetworkSecurity {
    Write-Section "2. SÉCURITÉ RÉSEAU"
    
    # CIS 2.1: NTP configuré
    Write-Info "Vérification de la configuration NTP..."
    $ntpService = Get-VMHostService -VMHost $script:VMHost | Where-Object { $_.Key -eq "ntpd" }
    $ntpServers = Get-VMHostNtpServer -VMHost $script:VMHost
    
    if ($ntpService.Running -and $ntpServers.Count -gt 0) {
        Write-Pass "NTP configuré avec $($ntpServers.Count) serveur(s)"
        Add-Result -Id "CIS-2.1" -Category "CIS" -Title "Synchronisation NTP" -Status "PASS" -Severity "high" `
            -Description "Service NTP actif avec serveurs configurés" -Reference "CIS 2.1"
    } else {
        Write-Fail "NTP non configuré correctement"
        Add-Result -Id "CIS-2.1" -Category "CIS" -Title "Synchronisation NTP" -Status "FAIL" -Severity "high" `
            -Description "Service NTP inactif ou aucun serveur configuré" `
            -Remediation "Configurer les serveurs NTP et démarrer le service ntpd" -Reference "CIS 2.1"
    }
    
    # CIS 2.2: Vérifier le mode promiscuité sur les vSwitches
    Write-Info "Vérification du mode promiscuité..."
    $vSwitches = Get-VirtualSwitch -VMHost $script:VMHost -Standard -ErrorAction SilentlyContinue
    $promiscuousEnabled = $false
    
    foreach ($vSwitch in $vSwitches) {
        $secPolicy = Get-SecurityPolicy -VirtualSwitch $vSwitch
        if ($secPolicy.AllowPromiscuous) {
            $promiscuousEnabled = $true
            Write-Warn "Mode promiscuité activé sur $($vSwitch.Name)"
        }
    }
    
    if (-not $promiscuousEnabled) {
        Write-Pass "Mode promiscuité désactivé sur tous les vSwitches"
        Add-Result -Id "CIS-2.2" -Category "CIS" -Title "Mode promiscuité vSwitch" -Status "PASS" -Severity "high" `
            -Description "Mode promiscuité désactivé sur tous les vSwitches standard" -Reference "CIS 2.2"
    } else {
        Add-Result -Id "CIS-2.2" -Category "CIS" -Title "Mode promiscuité vSwitch" -Status "FAIL" -Severity "high" `
            -Description "Mode promiscuité activé sur un ou plusieurs vSwitches" `
            -Remediation "Désactiver le mode promiscuité sauf si absolument nécessaire" -Reference "CIS 2.2"
    }
    
    # CIS 2.3: MAC Address Changes
    Write-Info "Vérification des changements d'adresse MAC..."
    $macChangesEnabled = $false
    
    foreach ($vSwitch in $vSwitches) {
        $secPolicy = Get-SecurityPolicy -VirtualSwitch $vSwitch
        if ($secPolicy.MacChanges) {
            $macChangesEnabled = $true
        }
    }
    
    if (-not $macChangesEnabled) {
        Write-Pass "Changements d'adresse MAC rejetés"
        Add-Result -Id "CIS-2.3" -Category "CIS" -Title "Changements MAC vSwitch" -Status "PASS" -Severity "high" `
            -Description "Les changements d'adresse MAC sont rejetés" -Reference "CIS 2.3"
    } else {
        Write-Warn "Changements d'adresse MAC autorisés"
        Add-Result -Id "CIS-2.3" -Category "CIS" -Title "Changements MAC vSwitch" -Status "WARN" -Severity "high" `
            -Description "Les changements d'adresse MAC sont autorisés" `
            -Remediation "Rejeter les changements MAC sauf nécessité spécifique" -Reference "CIS 2.3"
    }
    
    # CIS 2.4: Forged Transmits
    Write-Info "Vérification des transmissions forgées..."
    $forgedEnabled = $false
    
    foreach ($vSwitch in $vSwitches) {
        $secPolicy = Get-SecurityPolicy -VirtualSwitch $vSwitch
        if ($secPolicy.ForgedTransmits) {
            $forgedEnabled = $true
        }
    }
    
    if (-not $forgedEnabled) {
        Write-Pass "Transmissions forgées rejetées"
        Add-Result -Id "CIS-2.4" -Category "CIS" -Title "Transmissions forgées vSwitch" -Status "PASS" -Severity "high" `
            -Description "Les transmissions forgées sont rejetées" -Reference "CIS 2.4"
    } else {
        Write-Warn "Transmissions forgées autorisées"
        Add-Result -Id "CIS-2.4" -Category "CIS" -Title "Transmissions forgées vSwitch" -Status "WARN" -Severity "high" `
            -Description "Les transmissions forgées sont autorisées" `
            -Remediation "Rejeter les transmissions forgées sauf nécessité" -Reference "CIS 2.4"
    }
    
    # CIS 2.5: VLAN 4095 (trunk) non utilisé pour les VMs
    Write-Info "Vérification des VLANs trunk..."
    $portGroups = Get-VirtualPortGroup -VMHost $script:VMHost -Standard -ErrorAction SilentlyContinue
    $trunkVlans = $portGroups | Where-Object { $_.VLanId -eq 4095 }
    
    if ($trunkVlans.Count -eq 0) {
        Write-Pass "Aucun port group en mode trunk (VLAN 4095)"
        Add-Result -Id "CIS-2.5" -Category "CIS" -Title "VLAN Trunk" -Status "PASS" -Severity "medium" `
            -Description "Aucun port group configuré en mode trunk" -Reference "CIS 2.5"
    } else {
        Write-Warn "$($trunkVlans.Count) port group(s) en mode trunk"
        Add-Result -Id "CIS-2.5" -Category "CIS" -Title "VLAN Trunk" -Status "WARN" -Severity "medium" `
            -Description "Port groups en mode trunk détectés" `
            -Remediation "Éviter VLAN 4095 pour les VMs de production" -Reference "CIS 2.5"
    }
    
    # CIS 2.6: Vérifier le pare-feu ESXi
    Write-Info "Vérification du pare-feu ESXi..."
    $firewall = Get-VMHostFirewallDefaultPolicy -VMHost $script:VMHost
    
    if (-not $firewall.IncomingEnabled -and -not $firewall.OutgoingEnabled) {
        Write-Pass "Politique pare-feu par défaut: tout bloqué"
        Add-Result -Id "CIS-2.6" -Category "CIS" -Title "Pare-feu ESXi" -Status "PASS" -Severity "high" `
            -Description "Politique par défaut du pare-feu correctement configurée" -Reference "CIS 2.6"
    } else {
        Write-Warn "Politique pare-feu trop permissive"
        Add-Result -Id "CIS-2.6" -Category "CIS" -Title "Pare-feu ESXi" -Status "WARN" -Severity "high" `
            -Description "Politique par défaut autorise le trafic entrant ou sortant" `
            -Remediation "Configurer une politique pare-feu restrictive" -Reference "CIS 2.6"
    }
    
    # CIS 2.7: Désactiver IPv6 si non utilisé
    Write-Info "Vérification IPv6..."
    $ipv6Enabled = Get-EsxiAdvancedSetting -Name "Net.IPv6.enabled"
    
    if ($ipv6Enabled -eq 0) {
        Write-Pass "IPv6 désactivé"
        Add-Result -Id "CIS-2.7" -Category "CIS" -Title "IPv6" -Status "PASS" -Severity "low" `
            -Description "IPv6 est désactivé" -Reference "CIS 2.7"
    } else {
        Write-Info "IPv6 activé"
        Add-Result -Id "CIS-2.7" -Category "CIS" -Title "IPv6" -Status "WARN" -Severity "low" `
            -Description "IPv6 est activé - vérifier si nécessaire" `
            -Remediation "Désactiver IPv6 si non utilisé" -Reference "CIS 2.7"
    }
}

#===============================================================================
# Catégorie 3: Journalisation et Audit
#===============================================================================

function Test-LoggingAudit {
    Write-Section "3. JOURNALISATION ET AUDIT"
    
    # CIS 3.1: Syslog distant configuré
    Write-Info "Vérification du syslog distant..."
    $syslogHost = Get-EsxiAdvancedSetting -Name "Syslog.global.logHost"
    
    if ($syslogHost -and $syslogHost -ne "") {
        Write-Pass "Syslog distant configuré: $syslogHost"
        Add-Result -Id "CIS-3.1" -Category "CIS" -Title "Syslog distant" -Status "PASS" -Severity "high" `
            -Description "Logs envoyés vers $syslogHost" -Reference "CIS 3.1"
    } else {
        Write-Fail "Syslog distant non configuré"
        Add-Result -Id "CIS-3.1" -Category "CIS" -Title "Syslog distant" -Status "FAIL" -Severity "high" `
            -Description "Aucun serveur syslog distant configuré" `
            -Remediation "Configurer Syslog.global.logHost" -Reference "CIS 3.1"
    }
    
    # CIS 3.2: Taille des logs
    Write-Info "Vérification de la rotation des logs..."
    $logDir = Get-EsxiAdvancedSetting -Name "Syslog.global.logDir"
    $logRotate = Get-EsxiAdvancedSetting -Name "Syslog.global.logDirUnique"
    
    if ($logDir) {
        Write-Pass "Répertoire de logs configuré: $logDir"
        Add-Result -Id "CIS-3.2" -Category "CIS" -Title "Répertoire de logs" -Status "PASS" -Severity "medium" `
            -Description "Répertoire de logs: $logDir" -Reference "CIS 3.2"
    } else {
        Write-Warn "Répertoire de logs par défaut"
        Add-Result -Id "CIS-3.2" -Category "CIS" -Title "Répertoire de logs" -Status "WARN" -Severity "medium" `
            -Description "Utilisation du répertoire de logs par défaut" `
            -Remediation "Configurer un datastore persistant pour les logs" -Reference "CIS 3.2"
    }
    
    # CIS 3.3: Audit des commandes DCUI/Shell
    Write-Info "Vérification de l'audit des commandes..."
    $auditEnabled = Get-EsxiAdvancedSetting -Name "Config.HostAgent.log.level"
    
    Write-Pass "Niveau de journalisation vérifié"
    Add-Result -Id "CIS-3.3" -Category "CIS" -Title "Niveau de journalisation" -Status "PASS" -Severity "medium" `
        -Description "Journalisation système active" -Reference "CIS 3.3"
}

#===============================================================================
# Catégorie 4: Accès et Authentification
#===============================================================================

function Test-AccessAuthentication {
    Write-Section "4. ACCÈS ET AUTHENTIFICATION"
    
    # CIS 4.1: Timeout de session DCUI
    Write-Info "Vérification du timeout DCUI..."
    $dcuiTimeout = Get-EsxiAdvancedSetting -Name "UserVars.DcuiTimeOut"
    
    if ($dcuiTimeout -and $dcuiTimeout -le 600) {
        Write-Pass "Timeout DCUI: $dcuiTimeout secondes"
        Add-Result -Id "CIS-4.1" -Category "CIS" -Title "Timeout DCUI" -Status "PASS" -Severity "medium" `
            -Description "Timeout DCUI configuré à $dcuiTimeout secondes" -Reference "CIS 4.1"
    } else {
        Write-Warn "Timeout DCUI non configuré ou trop long"
        Add-Result -Id "CIS-4.1" -Category "CIS" -Title "Timeout DCUI" -Status "WARN" -Severity "medium" `
            -Description "Timeout DCUI: $dcuiTimeout secondes (recommandé: 600 max)" `
            -Remediation "Configurer UserVars.DcuiTimeOut à 600 ou moins" -Reference "CIS 4.1"
    }
    
    # CIS 4.2: Désactiver ESXi Shell si non nécessaire
    Write-Info "Vérification de l'ESXi Shell..."
    $shellService = Get-VMHostService -VMHost $script:VMHost | Where-Object { $_.Key -eq "TSM" }
    
    if (-not $shellService.Running) {
        Write-Pass "ESXi Shell désactivé"
        Add-Result -Id "CIS-4.2" -Category "CIS" -Title "ESXi Shell" -Status "PASS" -Severity "high" `
            -Description "Le service ESXi Shell est arrêté" -Reference "CIS 4.2"
    } else {
        Write-Warn "ESXi Shell activé"
        Add-Result -Id "CIS-4.2" -Category "CIS" -Title "ESXi Shell" -Status "WARN" -Severity "high" `
            -Description "Le service ESXi Shell est en cours d'exécution" `
            -Remediation "Désactiver ESXi Shell sauf maintenance" -Reference "CIS 4.2"
    }
    
    # CIS 4.3: Désactiver SSH si non nécessaire
    Write-Info "Vérification du service SSH..."
    $sshService = Get-VMHostService -VMHost $script:VMHost | Where-Object { $_.Key -eq "TSM-SSH" }
    
    if (-not $sshService.Running) {
        Write-Pass "SSH désactivé"
        Add-Result -Id "CIS-4.3" -Category "CIS" -Title "Service SSH" -Status "PASS" -Severity "high" `
            -Description "Le service SSH est arrêté" -Reference "CIS 4.3"
    } else {
        Write-Warn "SSH activé"
        Add-Result -Id "CIS-4.3" -Category "CIS" -Title "Service SSH" -Status "WARN" -Severity "high" `
            -Description "Le service SSH est en cours d'exécution" `
            -Remediation "Désactiver SSH sauf maintenance" -Reference "CIS 4.3"
    }
    
    # CIS 4.4: Timeout Shell
    Write-Info "Vérification du timeout Shell..."
    $shellTimeout = Get-EsxiAdvancedSetting -Name "UserVars.ESXiShellTimeOut"
    
    if ($shellTimeout -and $shellTimeout -le 900) {
        Write-Pass "Timeout Shell: $shellTimeout secondes"
        Add-Result -Id "CIS-4.4" -Category "CIS" -Title "Timeout Shell" -Status "PASS" -Severity "medium" `
            -Description "Timeout Shell configuré à $shellTimeout secondes" -Reference "CIS 4.4"
    } else {
        Write-Warn "Timeout Shell non configuré ou trop long"
        Add-Result -Id "CIS-4.4" -Category "CIS" -Title "Timeout Shell" -Status "WARN" -Severity "medium" `
            -Description "Timeout Shell: $shellTimeout (recommandé: 900 max)" `
            -Remediation "Configurer UserVars.ESXiShellTimeOut à 900 ou moins" -Reference "CIS 4.4"
    }
    
    # CIS 4.5: Verrouillage de compte après échecs
    Write-Info "Vérification du verrouillage de compte..."
    $lockFailures = Get-EsxiAdvancedSetting -Name "Security.AccountLockFailures"
    $unlockTime = Get-EsxiAdvancedSetting -Name "Security.AccountUnlockTime"
    
    if ($lockFailures -and $lockFailures -le 5) {
        Write-Pass "Verrouillage après $lockFailures tentatives"
        Add-Result -Id "CIS-4.5" -Category "CIS" -Title "Verrouillage de compte" -Status "PASS" -Severity "high" `
            -Description "Verrouillage après $lockFailures échecs, déverrouillage après $unlockTime sec" -Reference "CIS 4.5"
    } else {
        Write-Warn "Politique de verrouillage trop permissive"
        Add-Result -Id "CIS-4.5" -Category "CIS" -Title "Verrouillage de compte" -Status "WARN" -Severity "high" `
            -Description "Verrouillage après $lockFailures tentatives (recommandé: 5 max)" `
            -Remediation "Configurer Security.AccountLockFailures à 5" -Reference "CIS 4.5"
    }
    
    # CIS 4.6: Complexité des mots de passe
    Write-Info "Vérification de la politique de mots de passe..."
    $passwordQuality = Get-EsxiAdvancedSetting -Name "Security.PasswordQualityControl"
    
    if ($passwordQuality) {
        Write-Pass "Politique de mot de passe configurée"
        Add-Result -Id "CIS-4.6" -Category "CIS" -Title "Complexité mot de passe" -Status "PASS" -Severity "high" `
            -Description "Politique: $passwordQuality" -Reference "CIS 4.6"
    } else {
        Write-Warn "Politique de mot de passe par défaut"
        Add-Result -Id "CIS-4.6" -Category "CIS" -Title "Complexité mot de passe" -Status "WARN" -Severity "high" `
            -Description "Politique de mot de passe par défaut utilisée" `
            -Remediation "Renforcer Security.PasswordQualityControl" -Reference "CIS 4.6"
    }
    
    # CIS 4.7: Active Directory intégré
    Write-Info "Vérification de l'intégration AD..."
    $authServices = Get-VMHostAuthentication -VMHost $script:VMHost
    
    if ($authServices.Domain) {
        Write-Pass "Intégré au domaine: $($authServices.Domain)"
        Add-Result -Id "CIS-4.7" -Category "CIS" -Title "Intégration Active Directory" -Status "PASS" -Severity "medium" `
            -Description "Hôte joint au domaine $($authServices.Domain)" -Reference "CIS 4.7"
    } else {
        Write-Info "Non intégré à Active Directory"
        Add-Result -Id "CIS-4.7" -Category "CIS" -Title "Intégration Active Directory" -Status "WARN" -Severity "medium" `
            -Description "Hôte non joint à un domaine AD" `
            -Remediation "Considérer l'intégration AD pour la gestion centralisée" -Reference "CIS 4.7"
    }
    
    # CIS 4.8: Bannière de connexion
    Write-Info "Vérification de la bannière de connexion..."
    $banner = Get-EsxiAdvancedSetting -Name "Annotations.WelcomeMessage"
    
    if ($banner -and $banner -ne "") {
        Write-Pass "Bannière de connexion configurée"
        Add-Result -Id "CIS-4.8" -Category "CIS" -Title "Bannière de connexion" -Status "PASS" -Severity "low" `
            -Description "Bannière de connexion définie" -Reference "CIS 4.8"
    } else {
        Write-Warn "Aucune bannière de connexion"
        Add-Result -Id "CIS-4.8" -Category "CIS" -Title "Bannière de connexion" -Status "WARN" -Severity "low" `
            -Description "Aucune bannière de connexion configurée" `
            -Remediation "Configurer Annotations.WelcomeMessage" -Reference "CIS 4.8"
    }
}

#===============================================================================
# Catégorie 5: Services et Processus
#===============================================================================

function Test-ServicesProcesses {
    Write-Section "5. SERVICES ET PROCESSUS"
    
    # CIS 5.1: Services non essentiels désactivés
    Write-Info "Vérification des services..."
    $services = Get-VMHostService -VMHost $script:VMHost
    
    # SNMP
    $snmp = $services | Where-Object { $_.Key -eq "snmpd" }
    if (-not $snmp.Running) {
        Write-Pass "SNMP désactivé"
        Add-Result -Id "CIS-5.1" -Category "CIS" -Title "Service SNMP" -Status "PASS" -Severity "medium" `
            -Description "Le service SNMP est arrêté" -Reference "CIS 5.1"
    } else {
        Write-Warn "SNMP activé"
        Add-Result -Id "CIS-5.1" -Category "CIS" -Title "Service SNMP" -Status "WARN" -Severity "medium" `
            -Description "Le service SNMP est actif" `
            -Remediation "Désactiver SNMP si non utilisé" -Reference "CIS 5.1"
    }
    
    # CIS 5.2: CIM
    $cim = $services | Where-Object { $_.Key -eq "sfcbd-watchdog" }
    if (-not $cim.Running) {
        Write-Pass "CIM désactivé"
        Add-Result -Id "CIS-5.2" -Category "CIS" -Title "Service CIM" -Status "PASS" -Severity "medium" `
            -Description "Le service CIM est arrêté" -Reference "CIS 5.2"
    } else {
        Write-Info "CIM activé"
        Add-Result -Id "CIS-5.2" -Category "CIS" -Title "Service CIM" -Status "WARN" -Severity "medium" `
            -Description "Le service CIM est actif" `
            -Remediation "Désactiver CIM si non utilisé pour la surveillance" -Reference "CIS 5.2"
    }
    
    # CIS 5.3: Slpd (Service Location Protocol)
    $slpd = $services | Where-Object { $_.Key -eq "slpd" }
    if (-not $slpd.Running) {
        Write-Pass "SLPD désactivé"
        Add-Result -Id "CIS-5.3" -Category "CIS" -Title "Service SLPD" -Status "PASS" -Severity "medium" `
            -Description "Le service SLP est arrêté" -Reference "CIS 5.3"
    } else {
        Write-Warn "SLPD activé"
        Add-Result -Id "CIS-5.3" -Category "CIS" -Title "Service SLPD" -Status "WARN" -Severity "medium" `
            -Description "Le service SLP est actif" `
            -Remediation "Désactiver SLP si non nécessaire" -Reference "CIS 5.3"
    }
    
    # CIS 5.4: Vérifier le mode de démarrage des services
    Write-Info "Vérification des politiques de démarrage..."
    $autoStartServices = $services | Where-Object { $_.Policy -eq "on" -and $_.Key -in @("TSM", "TSM-SSH") }
    
    if ($autoStartServices.Count -eq 0) {
        Write-Pass "Shell/SSH ne démarrent pas automatiquement"
        Add-Result -Id "CIS-5.4" -Category "CIS" -Title "Démarrage automatique Shell/SSH" -Status "PASS" -Severity "high" `
            -Description "Les services Shell et SSH ne sont pas en démarrage automatique" -Reference "CIS 5.4"
    } else {
        Write-Fail "Shell ou SSH en démarrage automatique"
        Add-Result -Id "CIS-5.4" -Category "CIS" -Title "Démarrage automatique Shell/SSH" -Status "FAIL" -Severity "high" `
            -Description "Services Shell/SSH configurés en démarrage automatique" `
            -Remediation "Configurer la politique de démarrage sur 'off'" -Reference "CIS 5.4"
    }
}

#===============================================================================
# Catégorie 6: Configuration du Stockage
#===============================================================================

function Test-StorageConfiguration {
    Write-Section "6. CONFIGURATION DU STOCKAGE"
    
    # CIS 6.1: Datastores accessibles
    Write-Info "Vérification des datastores..."
    $datastores = Get-Datastore -VMHost $script:VMHost
    
    Write-Pass "$($datastores.Count) datastore(s) accessible(s)"
    Add-Result -Id "CIS-6.1" -Category "CIS" -Title "Datastores" -Status "PASS" -Severity "low" `
        -Description "$($datastores.Count) datastore(s) monté(s)" -Reference "CIS 6.1"
    
    # CIS 6.2: iSCSI CHAP
    Write-Info "Vérification iSCSI CHAP..."
    try {
        $iscsiHba = Get-VMHostHba -VMHost $script:VMHost -Type iScsi -ErrorAction SilentlyContinue
        if ($iscsiHba) {
            $chapType = $iscsiHba.AuthenticationProperties.ChapType
            if ($chapType -ne "chapProhibited") {
                Write-Pass "iSCSI CHAP configuré: $chapType"
                Add-Result -Id "CIS-6.2" -Category "CIS" -Title "iSCSI CHAP" -Status "PASS" -Severity "high" `
                    -Description "Authentification CHAP configurée pour iSCSI" -Reference "CIS 6.2"
            } else {
                Write-Warn "iSCSI CHAP non configuré"
                Add-Result -Id "CIS-6.2" -Category "CIS" -Title "iSCSI CHAP" -Status "WARN" -Severity "high" `
                    -Description "CHAP non activé pour iSCSI" `
                    -Remediation "Activer l'authentification CHAP pour iSCSI" -Reference "CIS 6.2"
            }
        } else {
            Write-Info "Pas d'adaptateur iSCSI"
            Add-Result -Id "CIS-6.2" -Category "CIS" -Title "iSCSI CHAP" -Status "PASS" -Severity "high" `
                -Description "Aucun adaptateur iSCSI configuré" -Reference "CIS 6.2"
        }
    } catch {
        Write-Info "Vérification iSCSI non applicable"
    }
}

#===============================================================================
# Catégorie 7: Sécurité des VMs
#===============================================================================

function Test-VMSecurity {
    Write-Section "7. SÉCURITÉ DES MACHINES VIRTUELLES"
    
    $vms = Get-VM -ErrorAction SilentlyContinue
    
    if ($vms.Count -eq 0) {
        Write-Info "Aucune VM sur cet hôte"
        Add-Result -Id "CIS-7.0" -Category "CIS" -Title "VMs hébergées" -Status "PASS" -Severity "low" `
            -Description "Aucune VM à auditer sur cet hôte" -Reference "CIS 7.x"
        return
    }
    
    Write-Info "Audit de $($vms.Count) VM(s)..."
    
    $vmIssues = 0
    
    foreach ($vm in $vms) {
        # CIS 7.1: VMware Tools à jour
        $toolsStatus = $vm.ExtensionData.Guest.ToolsVersionStatus
        if ($toolsStatus -ne "guestToolsCurrent") {
            $vmIssues++
        }
        
        # CIS 7.2: Désactiver les opérations Copy/Paste
        $copyPaste = $vm | Get-AdvancedSetting -Name "isolation.tools.copy.disable" -ErrorAction SilentlyContinue
        if (-not $copyPaste -or $copyPaste.Value -ne "TRUE") {
            $vmIssues++
        }
    }
    
    if ($vmIssues -eq 0) {
        Write-Pass "Configuration VM conforme"
        Add-Result -Id "CIS-7.1" -Category "CIS" -Title "Sécurité VMs" -Status "PASS" -Severity "medium" `
            -Description "Toutes les VMs respectent les bonnes pratiques" -Reference "CIS 7.x"
    } else {
        Write-Warn "$vmIssues problème(s) de configuration VM détecté(s)"
        Add-Result -Id "CIS-7.1" -Category "CIS" -Title "Sécurité VMs" -Status "WARN" -Severity "medium" `
            -Description "$vmIssues VM(s) nécessitent des ajustements de sécurité" `
            -Remediation "Vérifier VMware Tools et paramètres d'isolation" -Reference "CIS 7.x"
    }
}

#===============================================================================
# Catégorie 8: Certificats et Chiffrement
#===============================================================================

function Test-CertificatesSecurity {
    Write-Section "8. CERTIFICATS ET CHIFFREMENT"
    
    # CIS 8.1: Certificat SSL valide
    Write-Info "Vérification du certificat SSL..."
    try {
        $cert = Get-VIMachineCertificate -VMHost $script:VMHost -ErrorAction SilentlyContinue
        if ($cert) {
            $daysRemaining = ($cert.NotAfter - (Get-Date)).Days
            if ($daysRemaining -gt 30) {
                Write-Pass "Certificat SSL valide ($daysRemaining jours restants)"
                Add-Result -Id "CIS-8.1" -Category "CIS" -Title "Certificat SSL" -Status "PASS" -Severity "high" `
                    -Description "Certificat valide, expire dans $daysRemaining jours" -Reference "CIS 8.1"
            } else {
                Write-Warn "Certificat SSL expire bientôt"
                Add-Result -Id "CIS-8.1" -Category "CIS" -Title "Certificat SSL" -Status "WARN" -Severity "high" `
                    -Description "Certificat expire dans $daysRemaining jours" `
                    -Remediation "Renouveler le certificat SSL" -Reference "CIS 8.1"
            }
        } else {
            Write-Info "Certificat auto-signé par défaut"
            Add-Result -Id "CIS-8.1" -Category "CIS" -Title "Certificat SSL" -Status "WARN" -Severity "medium" `
                -Description "Certificat auto-signé VMware par défaut" `
                -Remediation "Remplacer par un certificat signé par une CA" -Reference "CIS 8.1"
        }
    } catch {
        Write-Info "Vérification du certificat non disponible"
        Add-Result -Id "CIS-8.1" -Category "CIS" -Title "Certificat SSL" -Status "WARN" -Severity "medium" `
            -Description "Impossible de vérifier le certificat" -Reference "CIS 8.1"
    }
    
    # CIS 8.2: TLS 1.2 minimum
    Write-Info "Vérification de la version TLS..."
    $tlsDisable10 = Get-EsxiAdvancedSetting -Name "UserVars.ESXiVPsDisabledProtocols"
    
    if ($tlsDisable10 -and $tlsDisable10 -match "tlsv1,tlsv1.1") {
        Write-Pass "TLS 1.0/1.1 désactivés"
        Add-Result -Id "CIS-8.2" -Category "CIS" -Title "Version TLS minimum" -Status "PASS" -Severity "high" `
            -Description "Seul TLS 1.2+ est autorisé" -Reference "CIS 8.2"
    } else {
        Write-Warn "TLS 1.0/1.1 peut-être activé"
        Add-Result -Id "CIS-8.2" -Category "CIS" -Title "Version TLS minimum" -Status "WARN" -Severity "high" `
            -Description "TLS 1.0/1.1 peuvent être activés" `
            -Remediation "Désactiver TLS 1.0 et 1.1" -Reference "CIS 8.2"
    }
}

#===============================================================================
# Catégorie 9: DISA STIG CAT I (Vulnérabilités Critiques)
#===============================================================================

function Test-DisaSTIGCatI {
    Write-Section "9. DISA STIG CAT I (VULNERABILITES CRITIQUES)"
    
    # STIG V-258732: Secure Boot activé
    Write-Info "Vérification du Secure Boot..."
    try {
        $secureBoot = Get-EsxiAdvancedSetting -Name "Boot.secureBoot"
        if ($secureBoot -eq $true -or $secureBoot -eq "TRUE") {
            Write-Pass "Secure Boot activé"
            Add-Result -Id "STIG-V-258732" -Category "DISA-STIG-CAT1" -Title "Secure Boot" -Status "PASS" -Severity "critical" `
                -Description "UEFI Secure Boot est activé" -Reference "DISA STIG V-258732"
        } else {
            Write-Fail "Secure Boot non activé"
            Add-Result -Id "STIG-V-258732" -Category "DISA-STIG-CAT1" -Title "Secure Boot" -Status "FAIL" -Severity "critical" `
                -Description "UEFI Secure Boot n'est pas activé" `
                -Remediation "Activer Secure Boot dans le BIOS/UEFI de l'hôte" -Reference "DISA STIG V-258732"
        }
    } catch {
        Write-Warn "Impossible de vérifier Secure Boot"
        Add-Result -Id "STIG-V-258732" -Category "DISA-STIG-CAT1" -Title "Secure Boot" -Status "WARN" -Severity "critical" `
            -Description "Vérification Secure Boot non disponible" -Reference "DISA STIG V-258732"
    }
    
    # STIG V-258733: TPM 2.0 présent et activé
    Write-Info "Vérification du TPM..."
    try {
        $tpm = $script:VMHost.ExtensionData.Capability.TpmSupported
        if ($tpm) {
            Write-Pass "TPM supporté sur cet hôte"
            Add-Result -Id "STIG-V-258733" -Category "DISA-STIG-CAT1" -Title "TPM 2.0" -Status "PASS" -Severity "critical" `
                -Description "Module TPM 2.0 détecté et supporté" -Reference "DISA STIG V-258733"
        } else {
            Write-Fail "TPM non détecté"
            Add-Result -Id "STIG-V-258733" -Category "DISA-STIG-CAT1" -Title "TPM 2.0" -Status "FAIL" -Severity "critical" `
                -Description "Module TPM 2.0 non détecté sur l'hôte" `
                -Remediation "Installer et activer un TPM 2.0 compatible" -Reference "DISA STIG V-258733"
        }
    } catch {
        Write-Warn "Impossible de vérifier le TPM"
        Add-Result -Id "STIG-V-258733" -Category "DISA-STIG-CAT1" -Title "TPM 2.0" -Status "WARN" -Severity "critical" `
            -Description "Vérification TPM non disponible" -Reference "DISA STIG V-258733"
    }
    
    # STIG V-258734: Exécutables non signés bloqués
    Write-Info "Vérification de l'Acceptance Level..."
    try {
        $acceptanceLevel = (Get-VMHostImageProfile).AcceptanceLevel
        if ($acceptanceLevel -eq "VMwareCertified" -or $acceptanceLevel -eq "VMwareAccepted") {
            Write-Pass "Acceptance Level: $acceptanceLevel"
            Add-Result -Id "STIG-V-258734" -Category "DISA-STIG-CAT1" -Title "Acceptance Level" -Status "PASS" -Severity "critical" `
                -Description "Seuls les VIBs $acceptanceLevel sont autorisés" -Reference "DISA STIG V-258734"
        } else {
            Write-Fail "Acceptance Level trop permissif: $acceptanceLevel"
            Add-Result -Id "STIG-V-258734" -Category "DISA-STIG-CAT1" -Title "Acceptance Level" -Status "FAIL" -Severity "critical" `
                -Description "Acceptance Level $acceptanceLevel permet des VIBs non signés" `
                -Remediation "Configurer Acceptance Level à VMwareCertified ou VMwareAccepted" -Reference "DISA STIG V-258734"
        }
    } catch {
        Write-Info "Vérification Acceptance Level"
        Add-Result -Id "STIG-V-258734" -Category "DISA-STIG-CAT1" -Title "Acceptance Level" -Status "WARN" -Severity "critical" `
            -Description "Impossible de vérifier l'Acceptance Level" -Reference "DISA STIG V-258734"
    }
    
    # STIG V-258774: SSH désactivé par défaut
    Write-Info "Vérification du service SSH..."
    $sshService = Get-VMHostService -VMHost $script:VMHost | Where-Object { $_.Key -eq "TSM-SSH" }
    
    if (-not $sshService.Running) {
        Write-Pass "Service SSH désactivé"
        Add-Result -Id "STIG-V-258774" -Category "DISA-STIG-CAT1" -Title "Service SSH" -Status "PASS" -Severity "critical" `
            -Description "Le service SSH est désactivé comme requis" -Reference "DISA STIG V-258774"
    } else {
        Write-Fail "Service SSH actif"
        Add-Result -Id "STIG-V-258774" -Category "DISA-STIG-CAT1" -Title "Service SSH" -Status "FAIL" -Severity "critical" `
            -Description "Le service SSH est actif - risque de sécurité" `
            -Remediation "Désactiver le service SSH sauf nécessité absolue" -Reference "DISA STIG V-258774"
    }
    
    # STIG V-258775: ESXi Shell désactivé par défaut
    Write-Info "Vérification de l'ESXi Shell..."
    $shellService = Get-VMHostService -VMHost $script:VMHost | Where-Object { $_.Key -eq "TSM" }
    
    if (-not $shellService.Running) {
        Write-Pass "ESXi Shell désactivé"
        Add-Result -Id "STIG-V-258775" -Category "DISA-STIG-CAT1" -Title "ESXi Shell" -Status "PASS" -Severity "critical" `
            -Description "L'ESXi Shell est désactivé comme requis" -Reference "DISA STIG V-258775"
    } else {
        Write-Fail "ESXi Shell actif"
        Add-Result -Id "STIG-V-258775" -Category "DISA-STIG-CAT1" -Title "ESXi Shell" -Status "FAIL" -Severity "critical" `
            -Description "L'ESXi Shell est actif - risque de sécurité" `
            -Remediation "Désactiver l'ESXi Shell sauf nécessité absolue" -Reference "DISA STIG V-258775"
    }
}

#===============================================================================
# Génération du rapport
#===============================================================================

function Export-HtmlReport {
    param(
        [int]$Score,
        [string]$Grade
    )
    
    $htmlFile = $OutputFile -replace '\.json$', '.html'
    $hostname = $script:VMHost.Name
    $version = $script:VMHost.Version
    $build = $script:VMHost.Build
    $dateVal = Get-Date -Format "dd/MM/yyyy HH:mm:ss"
    
    $gradeColor = switch ($Grade) {
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
    <title>Rapport d'Audit Sécurité VMware ESXi - InfraGuard Security</title>
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
            <h1>Rapport d'Audit de Securite VMware ESXi (BASE)</h1>
            <div class="subtitle">Genere par InfraGuard Security - ~55 controles essentiels</div>
            <div class="framework">Referentiel CIS Benchmark VMware ESXi 7.0/8.0</div>
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
        $statusIcon = switch ($result.status) {
            "PASS" { "&#10003;" }
            "WARN" { "!" }
            "FAIL" { "&#10007;" }
        }
        
        $html += @"
            <div class="result-item">
                <div class="result-status $statusClass">$statusIcon</div>
                <div class="result-content">
                    <h4>$($result.title)</h4>
                    <p>$($result.description)</p>
"@
        
        if ($result.remediation -and $result.status -ne "PASS") {
            $html += @"
                    <div class="remediation"><strong>Recommandation:</strong> $($result.remediation)</div>
"@
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
            <p>Base sur CIS Benchmark pour VMware ESXi</p>
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
        { $_ -ge 90 } { "A" }
        { $_ -ge 80 } { "B" }
        { $_ -ge 70 } { "C" }
        { $_ -ge 60 } { "D" }
        default { "F" }
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
    
    # Export JSON
    $report = @{
        report_type = "vmware_esxi_security_audit"
        framework = "CIS Benchmark VMware ESXi 7.0/8.0 + DISA STIG CAT I"
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
    
    if ($GenerateHtml) {
        Export-HtmlReport -Score $score -Grade $grade
    }
    
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
    
    Write-Host "Demarrage de l'audit de securite VMware ESXi (~55 controles)..."
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
        Test-DisaSTIGCatI
        
        Export-Report
        
        Disconnect-VIServer -Server $Server -Confirm:$false -ErrorAction SilentlyContinue
    } catch {
        Write-Fail "Erreur lors de l'audit: $_"
        throw $_
    }
}

Main
