#!/bin/bash
#===============================================================================
# Infra Shield Tools - Script d'Audit de Sécurité Linux (RENFORCÉ)
# Basé sur les recommandations ANSSI-BP-028 + CIS Benchmark Level 2
# Version: 1.0.0
# Niveau: RENFORCÉ (~100 contrôles complets)
# 
# Ce script effectue un audit de sécurité complet d'un système Linux
# en suivant les recommandations ANSSI-BP-028 v2.0 et CIS Benchmark Level 2
#
# Contrôles additionnels (par rapport à la version BASE):
# - Kernel hardening (sysctl, modules)
# - SELinux/AppArmor avancé
# - Configuration PAM détaillée
# - Chiffrement disque (LUKS)
# - Protection mémoire (ASLR, NX, SMEP, SMAP)
# - Sécurité Systemd
# - Contrôles cgroups/namespaces
# - Règles auditd avancées
# - Configuration TLS/SSL
#
# Usage: sudo ./linux-compliance-enhanced.sh [options]
# Options:
#   -o, --output <fichier>  Fichier de sortie JSON (défaut: audit_results.json)
#   -v, --verbose           Mode verbeux
#   -h, --help              Afficher l'aide
#
# Licence: Propriétaire Infra Shield Tools
#===============================================================================

set -euo pipefail

# Configuration par défaut
OUTPUT_FILE="audit_enhanced_$(date +%Y%m%d_%H%M%S).json"
VERBOSE=false
VERSION="1.0.0"
SCRIPT_NAME="IST Linux Compliance Audit - ENHANCED (ANSSI-BP-028 + CIS L2)"
AUDIT_LEVEL="ENHANCED"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Compteurs de score
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Tableau des résultats JSON
declare -a RESULTS=()

#===============================================================================
# Fonctions utilitaires
#===============================================================================

log_info() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_header() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                    ║"
    echo "║   Infra Shield Tools - Audit Linux v${VERSION} (RENFORCÉ)           ║"
    echo "║          ANSSI-BP-028 + CIS Benchmark Level 2                      ║"
    echo "║              ~100 contrôles complets                               ║"
    echo "║                                                                    ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
}

print_section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

add_result() {
    local id="$1"
    local category="$2"
    local title="$3"
    local status="$4"
    local severity="$5"
    local description="$6"
    local remediation="$7"
    local reference="${8:-}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    case "$status" in
        "PASS") PASSED_CHECKS=$((PASSED_CHECKS + 1)) ;;
        "FAIL") FAILED_CHECKS=$((FAILED_CHECKS + 1)) ;;
        "WARN") WARNING_CHECKS=$((WARNING_CHECKS + 1)) ;;
    esac
    
    local timestamp
    timestamp=$(date -Iseconds 2>/dev/null || date "+%Y-%m-%dT%H:%M:%S")
    
    local result="{\"id\":\"$id\",\"category\":\"$category\",\"title\":\"$title\",\"status\":\"$status\",\"severity\":\"$severity\",\"description\":\"$description\",\"remediation\":\"$remediation\",\"reference\":\"$reference\",\"timestamp\":\"$timestamp\"}"
    RESULTS+=("$result")
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}[ERREUR]${NC} Ce script doit être exécuté en tant que root"
        echo "Usage: sudo $0"
        exit 1
    fi
}

show_help() {
    echo "Usage: sudo $0 [options]"
    echo ""
    echo "Options:"
    echo "  -o, --output <fichier>  Fichier de sortie JSON (défaut: audit_results_DATE.json)"
    echo "  -v, --verbose           Mode verbeux"
    echo "  -h, --help              Afficher cette aide"
    echo ""
    echo "Exemple:"
    echo "  sudo $0 -v -o mon_audit.json"
}

#===============================================================================
# Catégorie 1: Configuration du Système
#===============================================================================

audit_system_config() {
    print_section "1. CONFIGURATION DU SYSTÈME"
    
    # R1: Vérification du partitionnement
    log_info "Vérification du partitionnement..."
    
    local partitions_required=("/tmp" "/var" "/var/log" "/var/tmp" "/home")
    local missing_partitions=()
    
    for part in "${partitions_required[@]}"; do
        if ! mountpoint -q "$part" 2>/dev/null; then
            missing_partitions+=("$part")
        fi
    done
    
    if [[ ${#missing_partitions[@]} -eq 0 ]]; then
        log_success "Partitionnement conforme - partitions séparées détectées"
        add_result "SYS-001" "ANSSI" "Partitionnement sécurisé" "PASS" "high" \
            "Les partitions critiques sont correctement séparées" \
            "" "ANSSI R1"
    else
        log_warning "Partitions manquantes: ${missing_partitions[*]}"
        add_result "SYS-001" "ANSSI" "Partitionnement sécurisé" "WARN" "high" \
            "Partitions non séparées: ${missing_partitions[*]}" \
            "Créer des partitions séparées pour: ${missing_partitions[*]}" "ANSSI R1"
    fi
    
    # R2: Options de montage sécurisées
    log_info "Vérification des options de montage..."
    
    local mount_issues=()
    
    if mountpoint -q /tmp 2>/dev/null; then
        local tmp_opts=$(mount | grep " /tmp " | sed 's/.*(\(.*\))/\1/' 2>/dev/null || echo "")
        if [[ ! "$tmp_opts" =~ "noexec" ]]; then
            mount_issues+=("/tmp sans noexec")
        fi
        if [[ ! "$tmp_opts" =~ "nosuid" ]]; then
            mount_issues+=("/tmp sans nosuid")
        fi
    fi
    
    if [[ ${#mount_issues[@]} -eq 0 ]]; then
        log_success "Options de montage conformes"
        add_result "SYS-002" "ANSSI" "Options de montage" "PASS" "medium" \
            "Les partitions ont des options de montage sécurisées" \
            "" "ANSSI R2"
    else
        log_warning "Problèmes de montage: ${mount_issues[*]}"
        add_result "SYS-002" "ANSSI" "Options de montage" "WARN" "medium" \
            "Options manquantes: ${mount_issues[*]}" \
            "Ajouter noexec,nosuid,nodev sur /tmp, /var/tmp, /dev/shm" "ANSSI R2"
    fi
    
    # R3: Vérification des mises à jour automatiques
    log_info "Vérification des mises à jour automatiques..."
    
    local auto_update=false
    if [[ -f /etc/apt/apt.conf.d/20auto-upgrades ]]; then
        if grep -q 'APT::Periodic::Unattended-Upgrade "1"' /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null; then
            auto_update=true
        fi
    elif command -v dnf &>/dev/null && systemctl is-enabled dnf-automatic.timer &>/dev/null; then
        auto_update=true
    fi
    
    if [[ "$auto_update" == true ]]; then
        log_success "Mises à jour automatiques activées"
        add_result "SYS-003" "ANSSI" "Mises à jour automatiques" "PASS" "critical" \
            "Les mises à jour de sécurité automatiques sont activées" \
            "" "ANSSI R3"
    else
        log_error "Mises à jour automatiques non configurées"
        add_result "SYS-003" "ANSSI" "Mises à jour automatiques" "FAIL" "critical" \
            "Les mises à jour automatiques ne sont pas activées" \
            "Activer unattended-upgrades (Debian/Ubuntu) ou dnf-automatic (RHEL/CentOS)" "ANSSI R3"
    fi
    
    # R4: Vérification de la version du noyau
    log_info "Vérification de la version du noyau..."
    
    local kernel_version=$(uname -r)
    local kernel_major=$(echo "$kernel_version" | cut -d. -f1)
    local kernel_minor=$(echo "$kernel_version" | cut -d. -f2)
    
    if [[ "$kernel_major" -ge 5 ]] || [[ "$kernel_major" -eq 4 && "$kernel_minor" -ge 19 ]]; then
        log_success "Version du noyau à jour: $kernel_version"
        add_result "SYS-004" "ANSSI" "Version du noyau" "PASS" "high" \
            "Noyau Linux $kernel_version - version supportée" \
            "" "ANSSI R4"
    else
        log_warning "Version du noyau ancienne: $kernel_version"
        add_result "SYS-004" "ANSSI" "Version du noyau" "WARN" "high" \
            "Noyau Linux $kernel_version - version potentiellement non supportée" \
            "Mettre à jour vers un noyau LTS récent (4.19+ ou 5.x+)" "ANSSI R4"
    fi
    
    # R5: Protection de la mémoire (ASLR)
    log_info "Vérification de l'ASLR..."
    
    local aslr=$(cat /proc/sys/kernel/randomize_va_space 2>/dev/null || echo "0")
    if [[ "$aslr" -eq 2 ]]; then
        log_success "ASLR activé (niveau 2)"
        add_result "SYS-005" "ANSSI" "Protection mémoire ASLR" "PASS" "critical" \
            "Address Space Layout Randomization activé au niveau maximum" \
            "" "ANSSI R5"
    else
        log_error "ASLR non activé ou partiellement activé (niveau: $aslr)"
        add_result "SYS-005" "ANSSI" "Protection mémoire ASLR" "FAIL" "critical" \
            "ASLR au niveau $aslr (devrait être 2)" \
            "echo 2 > /proc/sys/kernel/randomize_va_space et ajouter dans sysctl.conf" "ANSSI R5"
    fi
    
    # R6: Protection contre l'exécution de la pile
    log_info "Vérification NX/XD bit..."
    
    if grep -q ' nx ' /proc/cpuinfo 2>/dev/null; then
        log_success "Protection NX (No-eXecute) activée"
        add_result "SYS-006" "ANSSI" "Protection NX bit" "PASS" "high" \
            "Le processeur supporte et utilise NX bit" \
            "" "ANSSI R6"
    else
        log_warning "Protection NX non détectée"
        add_result "SYS-006" "ANSSI" "Protection NX bit" "WARN" "high" \
            "NX bit non détecté - possible désactivation dans le BIOS" \
            "Activer NX/XD dans les paramètres BIOS/UEFI" "ANSSI R6"
    fi
}

#===============================================================================
# Catégorie 2: Gestion des Comptes et Authentification
#===============================================================================

audit_accounts() {
    print_section "2. GESTION DES COMPTES ET AUTHENTIFICATION"
    
    # R7: Comptes avec UID 0
    log_info "Vérification des comptes avec UID 0..."
    
    local uid0_accounts=$(awk -F: '$3 == 0 {print $1}' /etc/passwd)
    local uid0_count=$(echo "$uid0_accounts" | wc -w)
    
    if [[ "$uid0_count" -eq 1 && "$uid0_accounts" == "root" ]]; then
        log_success "Seul root a UID 0"
        add_result "ACC-001" "ANSSI" "Comptes UID 0" "PASS" "critical" \
            "Seul le compte root possède l'UID 0" \
            "" "ANSSI R7"
    else
        log_error "Plusieurs comptes avec UID 0: $uid0_accounts"
        add_result "ACC-001" "ANSSI" "Comptes UID 0" "FAIL" "critical" \
            "Comptes avec UID 0: $uid0_accounts" \
            "Supprimer ou modifier l'UID des comptes autres que root" "ANSSI R7"
    fi
    
    # R8: Mots de passe vides (! et * sont des comptes verrouillés, pas des mots de passe vides)
    log_info "Vérification des mots de passe vides..."
    
    # Only flag truly empty passwords (empty string), not locked accounts (! or *)
    local empty_pass=$(awk -F: '$2 == "" && $1 != "root" {print $1}' /etc/shadow 2>/dev/null | grep -v '^$' || true)
    
    if [[ -z "$empty_pass" ]]; then
        log_success "Aucun compte utilisateur avec mot de passe vide"
        add_result "ACC-002" "ANSSI" "Mots de passe vides" "PASS" "critical" \
            "Tous les comptes ont un mot de passe défini ou sont verrouillés" \
            "" "ANSSI R8"
    else
        log_error "Comptes sans mot de passe: $empty_pass"
        add_result "ACC-002" "ANSSI" "Mots de passe vides" "FAIL" "critical" \
            "Comptes sans mot de passe: $empty_pass" \
            "Définir un mot de passe ou verrouiller ces comptes avec passwd -l" "ANSSI R8"
    fi
    
    # R9: Politique de mots de passe
    log_info "Vérification de la politique de mots de passe..."
    
    local pass_min_days=$(grep "^PASS_MIN_DAYS" /etc/login.defs 2>/dev/null | awk '{print $2}' || echo "0")
    local pass_max_days=$(grep "^PASS_MAX_DAYS" /etc/login.defs 2>/dev/null | awk '{print $2}' || echo "99999")
    local pass_min_len=$(grep "^PASS_MIN_LEN" /etc/login.defs 2>/dev/null | awk '{print $2}' || echo "5")
    
    local pass_policy_ok=true
    local pass_issues=()
    
    if [[ "$pass_max_days" -gt 90 ]]; then
        pass_policy_ok=false
        pass_issues+=("PASS_MAX_DAYS=$pass_max_days (recommandé: 90)")
    fi
    if [[ "$pass_min_len" -lt 12 ]]; then
        pass_policy_ok=false
        pass_issues+=("PASS_MIN_LEN=$pass_min_len (recommandé: 12)")
    fi
    
    if [[ "$pass_policy_ok" == true ]]; then
        log_success "Politique de mots de passe conforme"
        add_result "ACC-003" "ANSSI" "Politique mots de passe" "PASS" "high" \
            "La politique de mots de passe respecte les recommandations" \
            "" "ANSSI R9"
    else
        log_warning "Politique de mots de passe insuffisante"
        add_result "ACC-003" "ANSSI" "Politique mots de passe" "WARN" "high" \
            "Problèmes: ${pass_issues[*]}" \
            "Modifier /etc/login.defs: PASS_MAX_DAYS 90, PASS_MIN_LEN 12" "ANSSI R9"
    fi
    
    # R10: Verrouillage après échecs
    log_info "Vérification du verrouillage après échecs..."
    
    local faillock_enabled=false
    if [[ -f /etc/pam.d/common-auth ]] && grep -q "pam_faillock\|pam_tally2" /etc/pam.d/common-auth 2>/dev/null; then
        faillock_enabled=true
    elif [[ -f /etc/pam.d/system-auth ]] && grep -q "pam_faillock\|pam_tally2" /etc/pam.d/system-auth 2>/dev/null; then
        faillock_enabled=true
    fi
    
    if [[ "$faillock_enabled" == true ]]; then
        log_success "Verrouillage après échecs d'authentification activé"
        add_result "ACC-004" "ANSSI" "Verrouillage échecs auth" "PASS" "high" \
            "Le verrouillage de compte après échecs est configuré" \
            "" "ANSSI R10"
    else
        log_error "Verrouillage après échecs non configuré"
        add_result "ACC-004" "ANSSI" "Verrouillage échecs auth" "FAIL" "high" \
            "Pas de protection contre les attaques par force brute" \
            "Configurer pam_faillock avec deny=5 et unlock_time=900" "ANSSI R10"
    fi
    
    # R11: Vérification sudo
    log_info "Vérification de la configuration sudo..."
    
    local sudo_issues=()
    
    if grep -rq "NOPASSWD" /etc/sudoers /etc/sudoers.d/ 2>/dev/null; then
        sudo_issues+=("NOPASSWD détecté")
    fi
    if grep -rq "!authenticate" /etc/sudoers /etc/sudoers.d/ 2>/dev/null; then
        sudo_issues+=("!authenticate détecté")
    fi
    
    if [[ ${#sudo_issues[@]} -eq 0 ]]; then
        log_success "Configuration sudo sécurisée"
        add_result "ACC-005" "ANSSI" "Configuration sudo" "PASS" "high" \
            "sudo est configuré de manière sécurisée" \
            "" "ANSSI R11"
    else
        log_warning "Problèmes sudo: ${sudo_issues[*]}"
        add_result "ACC-005" "ANSSI" "Configuration sudo" "WARN" "high" \
            "Problèmes détectés: ${sudo_issues[*]}" \
            "Supprimer NOPASSWD et !authenticate de la configuration sudo" "ANSSI R11"
    fi
    
    # R12: Comptes système inutilisés
    log_info "Vérification des comptes système..."
    
    local unused_shells=0
    while IFS=: read -r user _ uid _ _ _ shell; do
        if [[ "$uid" -lt 1000 && "$uid" -ne 0 ]]; then
            if [[ "$shell" != "/sbin/nologin" && "$shell" != "/bin/false" && "$shell" != "/usr/sbin/nologin" ]]; then
                unused_shells=$((unused_shells + 1))
            fi
        fi
    done < /etc/passwd
    
    if [[ "$unused_shells" -eq 0 ]]; then
        log_success "Comptes système correctement configurés"
        add_result "ACC-006" "ANSSI" "Comptes système" "PASS" "medium" \
            "Les comptes système ont des shells désactivés" \
            "" "ANSSI R12"
    else
        log_warning "$unused_shells comptes système avec shell actif"
        add_result "ACC-006" "ANSSI" "Comptes système" "WARN" "medium" \
            "$unused_shells comptes système ont un shell de connexion" \
            "Configurer /sbin/nologin pour les comptes système non utilisés" "ANSSI R12"
    fi
}

#===============================================================================
# Catégorie 3: Configuration SSH
#===============================================================================

audit_ssh() {
    print_section "3. CONFIGURATION SSH"
    
    local sshd_config="/etc/ssh/sshd_config"
    
    if [[ ! -f "$sshd_config" ]]; then
        log_warning "SSH n'est pas installé"
        add_result "SSH-001" "ANSSI" "Installation SSH" "PASS" "info" \
            "SSH n'est pas installé sur ce système" \
            "" "ANSSI R13"
        return
    fi
    
    # R13: Authentification root SSH
    log_info "Vérification de l'authentification root SSH..."
    
    local permit_root=$(grep -E "^PermitRootLogin" "$sshd_config" 2>/dev/null | awk '{print $2}' || echo "yes")
    
    if [[ "$permit_root" == "no" ]]; then
        log_success "Connexion root SSH désactivée"
        add_result "SSH-001" "ANSSI" "Connexion root" "PASS" "critical" \
            "PermitRootLogin est défini sur 'no'" \
            "" "ANSSI R13"
    elif [[ "$permit_root" == "prohibit-password" || "$permit_root" == "without-password" ]]; then
        log_success "Connexion root SSH par mot de passe désactivée"
        add_result "SSH-001" "ANSSI" "Connexion root" "PASS" "critical" \
            "PermitRootLogin = $permit_root (clés uniquement)" \
            "" "ANSSI R13"
    else
        log_error "Connexion root SSH autorisée"
        add_result "SSH-001" "ANSSI" "Connexion root" "FAIL" "critical" \
            "PermitRootLogin = $permit_root" \
            "Ajouter 'PermitRootLogin no' dans $sshd_config" "ANSSI R13"
    fi
    
    # R14: Authentification par mot de passe SSH
    log_info "Vérification de l'authentification par mot de passe SSH..."
    
    local pass_auth=$(grep -E "^PasswordAuthentication" "$sshd_config" 2>/dev/null | awk '{print $2}' || echo "yes")
    
    if [[ "$pass_auth" == "no" ]]; then
        log_success "Authentification SSH par mot de passe désactivée"
        add_result "SSH-002" "ANSSI" "Auth mot de passe" "PASS" "high" \
            "PasswordAuthentication = no (clés uniquement)" \
            "" "ANSSI R14"
    else
        log_warning "Authentification SSH par mot de passe activée"
        add_result "SSH-002" "ANSSI" "Auth mot de passe" "WARN" "high" \
            "PasswordAuthentication = $pass_auth" \
            "Préférer l'authentification par clés: PasswordAuthentication no" "ANSSI R14"
    fi
    
    # R15: Protocole SSH version 2
    log_info "Vérification du protocole SSH..."
    
    local ssh_proto=$(grep -E "^Protocol" "$sshd_config" 2>/dev/null | awk '{print $2}' || echo "2")
    
    if [[ "$ssh_proto" == "2" || -z "$ssh_proto" ]]; then
        log_success "Protocole SSH version 2 uniquement"
        add_result "SSH-003" "ANSSI" "Protocole SSH" "PASS" "critical" \
            "SSH utilise uniquement le protocole version 2" \
            "" "ANSSI R15"
    else
        log_error "Protocole SSH v1 potentiellement activé"
        add_result "SSH-003" "ANSSI" "Protocole SSH" "FAIL" "critical" \
            "Protocol = $ssh_proto (devrait être 2)" \
            "Ajouter 'Protocol 2' dans $sshd_config" "ANSSI R15"
    fi
    
    # R16: Algorithmes de chiffrement SSH
    log_info "Vérification des algorithmes SSH..."
    
    local weak_ciphers=("3des-cbc" "arcfour" "blowfish-cbc" "cast128-cbc")
    local ciphers=$(grep -E "^Ciphers" "$sshd_config" 2>/dev/null | awk '{print $2}' || echo "")
    local weak_found=()
    
    for weak in "${weak_ciphers[@]}"; do
        if [[ "$ciphers" == *"$weak"* ]]; then
            weak_found+=("$weak")
        fi
    done
    
    if [[ ${#weak_found[@]} -eq 0 ]]; then
        log_success "Algorithmes SSH sécurisés"
        add_result "SSH-004" "ANSSI" "Algorithmes SSH" "PASS" "high" \
            "Aucun algorithme faible détecté" \
            "" "ANSSI R16"
    else
        log_error "Algorithmes SSH faibles détectés: ${weak_found[*]}"
        add_result "SSH-004" "ANSSI" "Algorithmes SSH" "FAIL" "high" \
            "Algorithmes faibles: ${weak_found[*]}" \
            "Supprimer les algorithmes faibles et utiliser: chacha20-poly1305,aes256-gcm" "ANSSI R16"
    fi
    
    # R17: X11 Forwarding
    log_info "Vérification X11 Forwarding..."
    
    local x11_forward=$(grep -E "^X11Forwarding" "$sshd_config" 2>/dev/null | awk '{print $2}' || echo "yes")
    
    if [[ "$x11_forward" == "no" ]]; then
        log_success "X11 Forwarding désactivé"
        add_result "SSH-005" "ANSSI" "X11 Forwarding" "PASS" "medium" \
            "X11Forwarding = no" \
            "" "ANSSI R17"
    else
        log_warning "X11 Forwarding activé"
        add_result "SSH-005" "ANSSI" "X11 Forwarding" "WARN" "medium" \
            "X11Forwarding = $x11_forward" \
            "Désactiver si non nécessaire: X11Forwarding no" "ANSSI R17"
    fi
    
    # R18: AllowUsers/AllowGroups
    log_info "Vérification des restrictions d'accès SSH..."
    
    local allow_users=$(grep -E "^AllowUsers|^AllowGroups" "$sshd_config" 2>/dev/null || echo "")
    
    if [[ -n "$allow_users" ]]; then
        log_success "Restrictions d'accès SSH configurées"
        add_result "SSH-006" "ANSSI" "Restrictions accès" "PASS" "high" \
            "AllowUsers ou AllowGroups configuré" \
            "" "ANSSI R18"
    else
        log_warning "Pas de restrictions d'accès SSH spécifiques"
        add_result "SSH-006" "ANSSI" "Restrictions accès" "WARN" "high" \
            "Aucun AllowUsers ou AllowGroups défini" \
            "Limiter l'accès avec AllowUsers ou AllowGroups" "ANSSI R18"
    fi
}

#===============================================================================
# Catégorie 4: Configuration Réseau
#===============================================================================

audit_network() {
    print_section "4. CONFIGURATION RÉSEAU"
    
    # R19: IP Forwarding
    log_info "Vérification de l'IP Forwarding..."
    
    local ip_forward=$(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null || echo "1")
    
    if [[ "$ip_forward" -eq 0 ]]; then
        log_success "IP Forwarding désactivé"
        add_result "NET-001" "ANSSI" "IP Forwarding" "PASS" "high" \
            "net.ipv4.ip_forward = 0" \
            "" "ANSSI R19"
    else
        log_warning "IP Forwarding activé"
        add_result "NET-001" "ANSSI" "IP Forwarding" "WARN" "high" \
            "net.ipv4.ip_forward = 1" \
            "Désactiver si ce n'est pas un routeur: sysctl -w net.ipv4.ip_forward=0" "ANSSI R19"
    fi
    
    # R20: Source Routing
    log_info "Vérification du Source Routing..."
    
    local accept_source=$(cat /proc/sys/net/ipv4/conf/all/accept_source_route 2>/dev/null || echo "1")
    
    if [[ "$accept_source" -eq 0 ]]; then
        log_success "Source Routing désactivé"
        add_result "NET-002" "ANSSI" "Source Routing" "PASS" "high" \
            "accept_source_route = 0" \
            "" "ANSSI R20"
    else
        log_error "Source Routing activé"
        add_result "NET-002" "ANSSI" "Source Routing" "FAIL" "high" \
            "accept_source_route = 1" \
            "sysctl -w net.ipv4.conf.all.accept_source_route=0" "ANSSI R20"
    fi
    
    # R21: ICMP Redirects
    log_info "Vérification des ICMP Redirects..."
    
    local accept_redirects=$(cat /proc/sys/net/ipv4/conf/all/accept_redirects 2>/dev/null || echo "1")
    
    if [[ "$accept_redirects" -eq 0 ]]; then
        log_success "ICMP Redirects désactivés"
        add_result "NET-003" "ANSSI" "ICMP Redirects" "PASS" "medium" \
            "accept_redirects = 0" \
            "" "ANSSI R21"
    else
        log_warning "ICMP Redirects activés"
        add_result "NET-003" "ANSSI" "ICMP Redirects" "WARN" "medium" \
            "accept_redirects = 1" \
            "sysctl -w net.ipv4.conf.all.accept_redirects=0" "ANSSI R21"
    fi
    
    # R22: SYN Cookies
    log_info "Vérification des SYN Cookies..."
    
    local syn_cookies=$(cat /proc/sys/net/ipv4/tcp_syncookies 2>/dev/null || echo "0")
    
    if [[ "$syn_cookies" -eq 1 ]]; then
        log_success "SYN Cookies activés"
        add_result "NET-004" "ANSSI" "SYN Cookies" "PASS" "high" \
            "tcp_syncookies = 1" \
            "" "ANSSI R22"
    else
        log_error "SYN Cookies désactivés"
        add_result "NET-004" "ANSSI" "SYN Cookies" "FAIL" "high" \
            "tcp_syncookies = 0 - vulnérable aux attaques SYN flood" \
            "sysctl -w net.ipv4.tcp_syncookies=1" "ANSSI R22"
    fi
    
    # R23: Pare-feu
    log_info "Vérification du pare-feu..."
    
    local firewall_active=false
    local firewall_name=""
    
    if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
        firewall_active=true
        firewall_name="ufw"
    elif command -v firewall-cmd &>/dev/null && firewall-cmd --state 2>/dev/null | grep -q "running"; then
        firewall_active=true
        firewall_name="firewalld"
    elif command -v iptables &>/dev/null && iptables -L -n 2>/dev/null | grep -q "Chain INPUT"; then
        local rules_count=$(iptables -L -n 2>/dev/null | grep -c "ACCEPT\|DROP\|REJECT" || echo "0")
        if [[ "$rules_count" -gt 3 ]]; then
            firewall_active=true
            firewall_name="iptables"
        fi
    fi
    
    if [[ "$firewall_active" == true ]]; then
        log_success "Pare-feu actif: $firewall_name"
        add_result "NET-005" "ANSSI" "Pare-feu" "PASS" "critical" \
            "Pare-feu $firewall_name actif et configuré" \
            "" "ANSSI R23"
    else
        log_error "Aucun pare-feu actif détecté"
        add_result "NET-005" "ANSSI" "Pare-feu" "FAIL" "critical" \
            "Aucun pare-feu n'est actif" \
            "Activer et configurer ufw, firewalld ou iptables" "ANSSI R23"
    fi
    
    # R24: Ports en écoute
    log_info "Analyse des ports en écoute..."
    
    local listening_ports=$(ss -tulnp 2>/dev/null | grep LISTEN | wc -l)
    local dangerous_ports=()
    
    if ss -tulnp 2>/dev/null | grep -q ":23 "; then
        dangerous_ports+=("23/telnet")
    fi
    if ss -tulnp 2>/dev/null | grep -q ":21 "; then
        dangerous_ports+=("21/ftp")
    fi
    if ss -tulnp 2>/dev/null | grep -q ":513 "; then
        dangerous_ports+=("513/rlogin")
    fi
    if ss -tulnp 2>/dev/null | grep -q ":514 "; then
        dangerous_ports+=("514/rsh")
    fi
    
    if [[ ${#dangerous_ports[@]} -eq 0 ]]; then
        log_success "Aucun port dangereux détecté ($listening_ports ports en écoute)"
        add_result "NET-006" "ANSSI" "Ports dangereux" "PASS" "high" \
            "$listening_ports ports en écoute, aucun service dangereux" \
            "" "ANSSI R24"
    else
        log_error "Ports dangereux détectés: ${dangerous_ports[*]}"
        add_result "NET-006" "ANSSI" "Ports dangereux" "FAIL" "high" \
            "Services non sécurisés: ${dangerous_ports[*]}" \
            "Désactiver telnet, ftp, rlogin, rsh et utiliser SSH/SFTP" "ANSSI R24"
    fi
}

#===============================================================================
# Catégorie 5: Permissions et Systèmes de Fichiers
#===============================================================================

audit_filesystem() {
    print_section "5. PERMISSIONS ET SYSTÈMES DE FICHIERS"
    
    # R25: Permissions des fichiers sensibles
    log_info "Vérification des permissions des fichiers sensibles..."
    
    local perm_issues=()
    
    local shadow_perms=$(stat -c %a /etc/shadow 2>/dev/null || echo "777")
    if [[ "$shadow_perms" -gt 640 ]]; then
        perm_issues+=("/etc/shadow ($shadow_perms)")
    fi
    
    local passwd_perms=$(stat -c %a /etc/passwd 2>/dev/null || echo "777")
    if [[ "$passwd_perms" -gt 644 ]]; then
        perm_issues+=("/etc/passwd ($passwd_perms)")
    fi
    
    local gshadow_perms=$(stat -c %a /etc/gshadow 2>/dev/null || echo "777")
    if [[ "$gshadow_perms" -gt 640 ]]; then
        perm_issues+=("/etc/gshadow ($gshadow_perms)")
    fi
    
    if [[ ${#perm_issues[@]} -eq 0 ]]; then
        log_success "Permissions des fichiers d'authentification correctes"
        add_result "FS-001" "ANSSI" "Fichiers auth" "PASS" "critical" \
            "Les fichiers /etc/passwd, shadow, gshadow ont des permissions correctes" \
            "" "ANSSI R25"
    else
        log_error "Permissions incorrectes: ${perm_issues[*]}"
        add_result "FS-001" "ANSSI" "Fichiers auth" "FAIL" "critical" \
            "Permissions trop permissives: ${perm_issues[*]}" \
            "chmod 644 /etc/passwd; chmod 640 /etc/shadow /etc/gshadow" "ANSSI R25"
    fi
    
    # R26: Fichiers SUID/SGID
    log_info "Recherche des fichiers SUID/SGID..."
    
    local suid_count=$(find / -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null | wc -l)
    local unusual_suid=()
    
    local known_suid=("/usr/bin/sudo" "/usr/bin/su" "/usr/bin/passwd" "/usr/bin/chsh" "/usr/bin/chfn" "/usr/bin/newgrp" "/usr/bin/gpasswd" "/usr/sbin/unix_chkpwd" "/usr/bin/crontab")
    
    while IFS= read -r suid_file; do
        local is_known=false
        for known in "${known_suid[@]}"; do
            if [[ "$suid_file" == "$known" ]]; then
                is_known=true
                break
            fi
        done
        if [[ "$is_known" == false && -n "$suid_file" ]]; then
            unusual_suid+=("$suid_file")
        fi
    done < <(find /usr -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null | head -20)
    
    if [[ ${#unusual_suid[@]} -le 5 ]]; then
        log_success "$suid_count fichiers SUID/SGID (normal)"
        add_result "FS-002" "ANSSI" "Fichiers SUID/SGID" "PASS" "high" \
            "$suid_count fichiers SUID/SGID détectés" \
            "" "ANSSI R26"
    else
        log_warning "$suid_count fichiers SUID/SGID détectés"
        add_result "FS-002" "ANSSI" "Fichiers SUID/SGID" "WARN" "high" \
            "$suid_count fichiers SUID/SGID, vérifier les inhabituels" \
            "Auditer et supprimer les bits SUID/SGID non nécessaires" "ANSSI R26"
    fi
    
    # R27: Fichiers world-writable
    log_info "Recherche des fichiers world-writable..."
    
    local world_writable=$(find / -xdev -type f -perm -0002 2>/dev/null | head -20 | wc -l)
    
    if [[ "$world_writable" -eq 0 ]]; then
        log_success "Aucun fichier world-writable détecté"
        add_result "FS-003" "ANSSI" "World-writable" "PASS" "high" \
            "Aucun fichier accessible en écriture à tous" \
            "" "ANSSI R27"
    else
        log_error "$world_writable fichiers world-writable détectés"
        add_result "FS-003" "ANSSI" "World-writable" "FAIL" "high" \
            "$world_writable fichiers accessibles en écriture à tous" \
            "Corriger les permissions: find / -xdev -type f -perm -0002 -exec chmod o-w {} \\;" "ANSSI R27"
    fi
    
    # R28: Répertoires sans sticky bit
    log_info "Vérification du sticky bit sur les répertoires publics..."
    
    local sticky_issues=()
    local public_dirs=("/tmp" "/var/tmp")
    
    for dir in "${public_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            local perms=$(stat -c %a "$dir" 2>/dev/null || echo "0")
            if [[ ! "$perms" =~ ^1 && ! "$perms" =~ ^3 && ! "$perms" =~ ^5 && ! "$perms" =~ ^7 ]]; then
                sticky_issues+=("$dir")
            fi
        fi
    done
    
    if [[ ${#sticky_issues[@]} -eq 0 ]]; then
        log_success "Sticky bit configuré sur les répertoires publics"
        add_result "FS-004" "ANSSI" "Sticky bit" "PASS" "medium" \
            "/tmp et /var/tmp ont le sticky bit" \
            "" "ANSSI R28"
    else
        log_error "Sticky bit manquant: ${sticky_issues[*]}"
        add_result "FS-004" "ANSSI" "Sticky bit" "FAIL" "medium" \
            "Sticky bit manquant sur: ${sticky_issues[*]}" \
            "chmod +t /tmp /var/tmp" "ANSSI R28"
    fi
    
    # R29: umask
    log_info "Vérification du umask par défaut..."
    
    local umask_value=$(umask)
    
    if [[ "$umask_value" == "0027" || "$umask_value" == "027" || "$umask_value" == "0077" || "$umask_value" == "077" ]]; then
        log_success "umask restrictif: $umask_value"
        add_result "FS-005" "ANSSI" "umask" "PASS" "medium" \
            "umask = $umask_value (restrictif)" \
            "" "ANSSI R29"
    else
        log_warning "umask permissif: $umask_value"
        add_result "FS-005" "ANSSI" "umask" "WARN" "medium" \
            "umask = $umask_value (recommandé: 027 ou 077)" \
            "Configurer umask 027 dans /etc/profile et /etc/bash.bashrc" "ANSSI R29"
    fi
}

#===============================================================================
# Catégorie 6: Services et Daemons
#===============================================================================

audit_services() {
    print_section "6. SERVICES ET DAEMONS"
    
    # R30: Services inutiles
    log_info "Analyse des services actifs..."
    
    local risky_services=("avahi-daemon" "cups" "bluetooth" "rpcbind" "nfs-server" "vsftpd" "xinetd")
    local active_risky=()
    
    for svc in "${risky_services[@]}"; do
        if systemctl is-active "$svc" &>/dev/null; then
            active_risky+=("$svc")
        fi
    done
    
    if [[ ${#active_risky[@]} -eq 0 ]]; then
        log_success "Aucun service potentiellement risqué actif"
        add_result "SVC-001" "ANSSI" "Services risqués" "PASS" "medium" \
            "Pas de services non essentiels détectés" \
            "" "ANSSI R30"
    else
        log_warning "Services potentiellement inutiles: ${active_risky[*]}"
        add_result "SVC-001" "ANSSI" "Services risqués" "WARN" "medium" \
            "Services actifs à évaluer: ${active_risky[*]}" \
            "Désactiver les services non nécessaires avec systemctl disable" "ANSSI R30"
    fi
    
    # R31: NTP
    log_info "Vérification de la synchronisation NTP..."
    
    local ntp_active=false
    if systemctl is-active systemd-timesyncd &>/dev/null; then
        ntp_active=true
    elif systemctl is-active chronyd &>/dev/null; then
        ntp_active=true
    elif systemctl is-active ntpd &>/dev/null; then
        ntp_active=true
    fi
    
    if [[ "$ntp_active" == true ]]; then
        log_success "Synchronisation NTP active"
        add_result "SVC-002" "ANSSI" "Synchronisation NTP" "PASS" "medium" \
            "Le système est synchronisé avec un serveur NTP" \
            "" "ANSSI R31"
    else
        log_warning "Synchronisation NTP non active"
        add_result "SVC-002" "ANSSI" "Synchronisation NTP" "WARN" "medium" \
            "Pas de synchronisation horaire configurée" \
            "Activer systemd-timesyncd ou chrony" "ANSSI R31"
    fi
    
    # R32: Cron restrictions
    log_info "Vérification des restrictions cron..."
    
    local cron_secure=true
    
    if [[ ! -f /etc/cron.allow && ! -f /etc/cron.deny ]]; then
        cron_secure=false
    fi
    
    if [[ "$cron_secure" == true ]]; then
        log_success "Restrictions cron configurées"
        add_result "SVC-003" "ANSSI" "Restrictions cron" "PASS" "medium" \
            "cron.allow ou cron.deny configuré" \
            "" "ANSSI R32"
    else
        log_warning "Pas de restrictions cron"
        add_result "SVC-003" "ANSSI" "Restrictions cron" "WARN" "medium" \
            "Aucune restriction d'accès à cron" \
            "Créer /etc/cron.allow avec les utilisateurs autorisés" "ANSSI R32"
    fi
}

#===============================================================================
# Catégorie 7: Journalisation et Audit
#===============================================================================

audit_logging() {
    print_section "7. JOURNALISATION ET AUDIT"
    
    # R33: rsyslog/journald
    log_info "Vérification du système de journalisation..."
    
    local logging_active=false
    local logging_name=""
    
    if systemctl is-active rsyslog &>/dev/null; then
        logging_active=true
        logging_name="rsyslog"
    elif systemctl is-active systemd-journald &>/dev/null; then
        logging_active=true
        logging_name="journald"
    fi
    
    if [[ "$logging_active" == true ]]; then
        log_success "Journalisation active: $logging_name"
        add_result "LOG-001" "Journalisation" "Système de logs" "PASS" "critical" \
            "$logging_name est actif et en cours d'exécution" \
            "" "ANSSI R33"
    else
        log_error "Aucun système de journalisation actif"
        add_result "LOG-001" "Journalisation" "Système de logs" "FAIL" "critical" \
            "Pas de système de journalisation détecté" \
            "Activer rsyslog ou configurer journald" "ANSSI R33"
    fi
    
    # R34: auditd
    log_info "Vérification du système d'audit..."
    
    if systemctl is-active auditd &>/dev/null; then
        log_success "Système d'audit auditd actif"
        add_result "LOG-002" "Journalisation" "Audit système" "PASS" "high" \
            "auditd est actif pour l'audit des événements système" \
            "" "ANSSI R34"
    else
        log_warning "auditd non actif"
        add_result "LOG-002" "Journalisation" "Audit système" "WARN" "high" \
            "Le système d'audit auditd n'est pas actif" \
            "Installer et activer auditd: apt install auditd && systemctl enable auditd" "ANSSI R34"
    fi
    
    # R35: Permissions des logs
    log_info "Vérification des permissions des fichiers de logs..."
    
    local log_issues=()
    local log_dir="/var/log"
    
    if [[ -d "$log_dir" ]]; then
        local log_perms=$(stat -c %a "$log_dir" 2>/dev/null || echo "777")
        if [[ "$log_perms" -gt 755 ]]; then
            log_issues+=("/var/log ($log_perms)")
        fi
        
        if [[ -f "$log_dir/auth.log" ]]; then
            local auth_perms=$(stat -c %a "$log_dir/auth.log" 2>/dev/null || echo "777")
            if [[ "$auth_perms" -gt 640 ]]; then
                log_issues+=("auth.log ($auth_perms)")
            fi
        fi
    fi
    
    if [[ ${#log_issues[@]} -eq 0 ]]; then
        log_success "Permissions des logs correctes"
        add_result "LOG-003" "Journalisation" "Permissions logs" "PASS" "medium" \
            "Les fichiers de logs ont des permissions appropriées" \
            "" "ANSSI R35"
    else
        log_warning "Problèmes de permissions: ${log_issues[*]}"
        add_result "LOG-003" "Journalisation" "Permissions logs" "WARN" "medium" \
            "Permissions trop permissives: ${log_issues[*]}" \
            "Restreindre les permissions des fichiers de logs sensibles" "ANSSI R35"
    fi
    
    # R36: Rotation des logs
    log_info "Vérification de la rotation des logs..."
    
    if [[ -f /etc/logrotate.conf || -d /etc/logrotate.d ]]; then
        log_success "Rotation des logs configurée"
        add_result "LOG-004" "Journalisation" "Rotation logs" "PASS" "medium" \
            "logrotate est configuré" \
            "" "ANSSI R36"
    else
        log_warning "Rotation des logs non configurée"
        add_result "LOG-004" "Journalisation" "Rotation logs" "WARN" "medium" \
            "logrotate n'est pas configuré" \
            "Installer et configurer logrotate" "ANSSI R36"
    fi
}

#===============================================================================
# Catégorie 8: Sécurité Applicative
#===============================================================================

audit_security_tools() {
    print_section "8. OUTILS DE SÉCURITÉ"
    
    # R37: SELinux/AppArmor
    log_info "Vérification des MAC (Mandatory Access Control)..."
    
    local mac_active=false
    local mac_name=""
    
    if command -v getenforce &>/dev/null && [[ "$(getenforce 2>/dev/null)" != "Disabled" ]]; then
        mac_active=true
        mac_name="SELinux ($(getenforce))"
    elif command -v aa-status &>/dev/null && aa-status &>/dev/null; then
        local profiles=$(aa-status 2>/dev/null | grep "profiles are loaded" | awk '{print $1}')
        if [[ -n "$profiles" && "$profiles" -gt 0 ]]; then
            mac_active=true
            mac_name="AppArmor ($profiles profils)"
        fi
    fi
    
    if [[ "$mac_active" == true ]]; then
        log_success "MAC actif: $mac_name"
        add_result "SEC-001" "Sécurité" "MAC (SELinux/AppArmor)" "PASS" "high" \
            "$mac_name est activé" \
            "" "ANSSI R37"
    else
        log_warning "Aucun MAC actif"
        add_result "SEC-001" "Sécurité" "MAC (SELinux/AppArmor)" "WARN" "high" \
            "Ni SELinux ni AppArmor n'est actif" \
            "Activer SELinux ou AppArmor pour le contrôle d'accès obligatoire" "ANSSI R37"
    fi
    
    # R38: Antivirus
    log_info "Vérification de la présence d'un antivirus..."
    
    local av_installed=false
    local av_name=""
    
    if command -v clamscan &>/dev/null; then
        av_installed=true
        av_name="ClamAV"
    elif command -v sophos &>/dev/null; then
        av_installed=true
        av_name="Sophos"
    fi
    
    if [[ "$av_installed" == true ]]; then
        log_success "Antivirus installé: $av_name"
        add_result "SEC-002" "Sécurité" "Antivirus" "PASS" "medium" \
            "$av_name est installé" \
            "" "ANSSI R38"
    else
        log_info "Aucun antivirus détecté (optionnel selon contexte)"
        add_result "SEC-002" "Sécurité" "Antivirus" "WARN" "low" \
            "Aucun antivirus détecté" \
            "Installer ClamAV si nécessaire selon la politique de sécurité" "ANSSI R38"
    fi
    
    # R39: fail2ban
    log_info "Vérification de fail2ban..."
    
    if systemctl is-active fail2ban &>/dev/null; then
        log_success "fail2ban actif"
        add_result "SEC-003" "Sécurité" "Fail2ban" "PASS" "high" \
            "fail2ban est actif pour la protection anti-bruteforce" \
            "" "ANSSI R39"
    else
        log_warning "fail2ban non actif"
        add_result "SEC-003" "Sécurité" "Fail2ban" "WARN" "high" \
            "fail2ban n'est pas installé ou actif" \
            "Installer fail2ban: apt install fail2ban && systemctl enable fail2ban" "ANSSI R39"
    fi
    
    # R40: Vérification d'intégrité
    log_info "Vérification des outils d'intégrité..."
    
    local integrity_tool=false
    local tool_name=""
    
    if command -v aide &>/dev/null; then
        integrity_tool=true
        tool_name="AIDE"
    elif command -v tripwire &>/dev/null; then
        integrity_tool=true
        tool_name="Tripwire"
    elif command -v ossec &>/dev/null; then
        integrity_tool=true
        tool_name="OSSEC"
    fi
    
    if [[ "$integrity_tool" == true ]]; then
        log_success "Outil d'intégrité installé: $tool_name"
        add_result "SEC-004" "Sécurité" "Vérification intégrité" "PASS" "medium" \
            "$tool_name est installé pour la vérification d'intégrité" \
            "" "ANSSI R40"
    else
        log_warning "Aucun outil de vérification d'intégrité"
        add_result "SEC-004" "Sécurité" "Vérification intégrité" "WARN" "medium" \
            "Aucun outil de vérification d'intégrité détecté" \
            "Installer AIDE: apt install aide && aideinit" "ANSSI R40"
    fi
}

#===============================================================================
# CONTRÔLES RENFORCÉS - Kernel Hardening
#===============================================================================

audit_kernel_hardening() {
    print_section "KERNEL HARDENING (RENFORCÉ)"
    
    # R41: ASLR (Address Space Layout Randomization)
    log_info "Vérification ASLR..."
    local aslr_val
    aslr_val=$(cat /proc/sys/kernel/randomize_va_space 2>/dev/null || echo "0")
    if [[ "$aslr_val" == "2" ]]; then
        log_success "ASLR activé (niveau 2 - complet)"
        add_result "KRN-001" "ANSSI" "ASLR" "PASS" "high" \
            "ASLR est configuré au niveau maximal (2)" "" "ANSSI R41"
    else
        log_error "ASLR non optimal (valeur: $aslr_val)"
        add_result "KRN-001" "ANSSI" "ASLR" "FAIL" "high" \
            "ASLR n'est pas au niveau maximal" \
            "echo 2 > /proc/sys/kernel/randomize_va_space" "ANSSI R41"
    fi
    
    # R42: Protection ptrace
    log_info "Vérification protection ptrace..."
    local ptrace_val
    ptrace_val=$(cat /proc/sys/kernel/yama/ptrace_scope 2>/dev/null || echo "0")
    if [[ "$ptrace_val" -ge 1 ]]; then
        log_success "Protection ptrace activée (scope: $ptrace_val)"
        add_result "KRN-002" "ANSSI" "Protection ptrace" "PASS" "high" \
            "ptrace_scope configuré à $ptrace_val" "" "ANSSI R42"
    else
        log_error "Protection ptrace désactivée"
        add_result "KRN-002" "ANSSI" "Protection ptrace" "FAIL" "high" \
            "ptrace_scope n'est pas restreint" \
            "echo 1 > /proc/sys/kernel/yama/ptrace_scope" "ANSSI R42"
    fi
    
    # R43: Désactivation core dumps
    log_info "Vérification core dumps..."
    local core_pattern
    core_pattern=$(cat /proc/sys/kernel/core_pattern 2>/dev/null || echo "core")
    local core_limit
    core_limit=$(ulimit -c 2>/dev/null || echo "unlimited")
    if [[ "$core_limit" == "0" ]] || [[ "$core_pattern" == "|/bin/false" ]]; then
        log_success "Core dumps désactivés"
        add_result "KRN-003" "ANSSI" "Core dumps" "PASS" "medium" \
            "Core dumps correctement désactivés" "" "ANSSI R43"
    else
        log_warning "Core dumps potentiellement activés"
        add_result "KRN-003" "ANSSI" "Core dumps" "WARN" "medium" \
            "Core dumps peuvent exposer des données sensibles" \
            "Ajouter * hard core 0 dans /etc/security/limits.conf" "ANSSI R43"
    fi
    
    # R44: Kernel exec-shield / NX bit
    log_info "Vérification NX bit..."
    local nx_enabled=false
    if grep -q " nx " /proc/cpuinfo 2>/dev/null; then
        nx_enabled=true
    fi
    if [[ "$nx_enabled" == true ]]; then
        log_success "NX bit supporté par le CPU"
        add_result "KRN-004" "ANSSI" "NX Bit" "PASS" "high" \
            "Protection NX (No-Execute) active" "" "ANSSI R44"
    else
        log_warning "NX bit non détecté"
        add_result "KRN-004" "ANSSI" "NX Bit" "WARN" "high" \
            "NX bit non détecté sur ce CPU" "" "ANSSI R44"
    fi
    
    # R45: Kernel dmesg restriction
    log_info "Vérification restriction dmesg..."
    local dmesg_restrict
    dmesg_restrict=$(cat /proc/sys/kernel/dmesg_restrict 2>/dev/null || echo "0")
    if [[ "$dmesg_restrict" == "1" ]]; then
        log_success "Accès dmesg restreint"
        add_result "KRN-005" "ANSSI" "Restriction dmesg" "PASS" "medium" \
            "dmesg_restrict activé" "" "ANSSI R45"
    else
        log_warning "dmesg accessible à tous les utilisateurs"
        add_result "KRN-005" "ANSSI" "Restriction dmesg" "WARN" "medium" \
            "Logs kernel accessibles à tous" \
            "echo 1 > /proc/sys/kernel/dmesg_restrict" "ANSSI R45"
    fi
    
    # R46: Kernel pointer hiding
    log_info "Vérification masquage pointeurs kernel..."
    local kptr_restrict
    kptr_restrict=$(cat /proc/sys/kernel/kptr_restrict 2>/dev/null || echo "0")
    if [[ "$kptr_restrict" -ge 1 ]]; then
        log_success "Pointeurs kernel masqués"
        add_result "KRN-006" "ANSSI" "Masquage pointeurs" "PASS" "high" \
            "kptr_restrict configuré à $kptr_restrict" "" "ANSSI R46"
    else
        log_error "Pointeurs kernel exposés"
        add_result "KRN-006" "ANSSI" "Masquage pointeurs" "FAIL" "high" \
            "Adresses kernel visibles" \
            "echo 1 > /proc/sys/kernel/kptr_restrict" "ANSSI R46"
    fi
    
    # R47: SysRq restriction
    log_info "Vérification SysRq..."
    local sysrq_val
    sysrq_val=$(cat /proc/sys/kernel/sysrq 2>/dev/null || echo "1")
    if [[ "$sysrq_val" == "0" ]]; then
        log_success "SysRq désactivé"
        add_result "KRN-007" "ANSSI" "SysRq" "PASS" "medium" \
            "Magic SysRq désactivé" "" "ANSSI R47"
    else
        log_warning "SysRq activé (valeur: $sysrq_val)"
        add_result "KRN-007" "ANSSI" "SysRq" "WARN" "medium" \
            "Magic SysRq peut permettre des actions privilégiées" \
            "echo 0 > /proc/sys/kernel/sysrq" "ANSSI R47"
    fi
    
    # R48: Kernel modules loading
    log_info "Vérification chargement modules..."
    local modules_disabled
    modules_disabled=$(cat /proc/sys/kernel/modules_disabled 2>/dev/null || echo "0")
    if [[ "$modules_disabled" == "1" ]]; then
        log_success "Chargement de modules désactivé"
        add_result "KRN-008" "ANSSI" "Chargement modules" "PASS" "high" \
            "Chargement de nouveaux modules kernel bloqué" "" "ANSSI R48"
    else
        log_warning "Chargement de modules autorisé"
        add_result "KRN-008" "ANSSI" "Chargement modules" "WARN" "high" \
            "Nouveaux modules kernel peuvent être chargés" \
            "Configurer après le boot: echo 1 > /proc/sys/kernel/modules_disabled" "ANSSI R48"
    fi
    
    # R49: Unprivileged BPF
    log_info "Vérification BPF non privilégié..."
    local bpf_disabled
    bpf_disabled=$(cat /proc/sys/kernel/unprivileged_bpf_disabled 2>/dev/null || echo "0")
    if [[ "$bpf_disabled" == "1" ]] || [[ "$bpf_disabled" == "2" ]]; then
        log_success "BPF non privilégié désactivé"
        add_result "KRN-009" "ANSSI" "BPF non privilégié" "PASS" "high" \
            "unprivileged_bpf_disabled=$bpf_disabled" "" "ANSSI R49"
    else
        log_warning "BPF accessible aux utilisateurs non privilégiés"
        add_result "KRN-009" "ANSSI" "BPF non privilégié" "WARN" "high" \
            "BPF peut être utilisé pour des exploits" \
            "echo 1 > /proc/sys/kernel/unprivileged_bpf_disabled" "ANSSI R49"
    fi
    
    # R50: Perf event restriction
    log_info "Vérification perf events..."
    local perf_paranoid
    perf_paranoid=$(cat /proc/sys/kernel/perf_event_paranoid 2>/dev/null || echo "0")
    if [[ "$perf_paranoid" -ge 2 ]]; then
        log_success "Perf events restreints"
        add_result "KRN-010" "ANSSI" "Perf events" "PASS" "medium" \
            "perf_event_paranoid=$perf_paranoid" "" "ANSSI R50"
    else
        log_warning "Perf events accessibles"
        add_result "KRN-010" "ANSSI" "Perf events" "WARN" "medium" \
            "Perf events peuvent leak des informations" \
            "echo 3 > /proc/sys/kernel/perf_event_paranoid" "ANSSI R50"
    fi
}

#===============================================================================
# CONTRÔLES RENFORCÉS - SELinux/AppArmor Avancé
#===============================================================================

audit_mandatory_access_control() {
    print_section "CONTRÔLE D'ACCÈS MANDATAIRE (RENFORCÉ)"
    
    # R51: SELinux mode
    log_info "Vérification SELinux détaillée..."
    if command -v getenforce &>/dev/null; then
        local selinux_status
        selinux_status=$(getenforce 2>/dev/null || echo "Disabled")
        if [[ "$selinux_status" == "Enforcing" ]]; then
            log_success "SELinux en mode Enforcing"
            add_result "MAC-001" "MAC" "SELinux mode" "PASS" "critical" \
                "SELinux en mode Enforcing (protection maximale)" "" "ANSSI R51"
                
            # Vérifier les booléens SELinux critiques
            log_info "Vérification booléens SELinux..."
            local sebool_issues=0
            if command -v getsebool &>/dev/null; then
                if getsebool httpd_can_network_connect 2>/dev/null | grep -q "on"; then
                    sebool_issues=$((sebool_issues + 1))
                fi
            fi
            if [[ $sebool_issues -eq 0 ]]; then
                add_result "MAC-002" "MAC" "SELinux booléens" "PASS" "medium" \
                    "Booléens SELinux correctement configurés" "" "ANSSI R51"
            else
                add_result "MAC-002" "MAC" "SELinux booléens" "WARN" "medium" \
                    "Certains booléens SELinux sont permissifs" \
                    "Réviser les booléens avec getsebool -a" "ANSSI R51"
            fi
        elif [[ "$selinux_status" == "Permissive" ]]; then
            log_warning "SELinux en mode Permissive"
            add_result "MAC-001" "MAC" "SELinux mode" "WARN" "critical" \
                "SELinux en mode Permissive (journalise mais n'applique pas)" \
                "Passer en Enforcing: setenforce 1" "ANSSI R51"
        else
            log_error "SELinux désactivé"
            add_result "MAC-001" "MAC" "SELinux mode" "FAIL" "critical" \
                "SELinux désactivé ou non installé" \
                "Activer SELinux dans /etc/selinux/config" "ANSSI R51"
        fi
    elif command -v aa-status &>/dev/null; then
        log_info "Vérification AppArmor détaillée..."
        local aa_profiles
        aa_profiles=$(aa-status 2>/dev/null | grep "profiles are loaded" | head -1 | awk '{print $1}' || echo "0")
        local aa_enforced
        aa_enforced=$(aa-status 2>/dev/null | grep "profiles are in enforce" | head -1 | awk '{print $1}' || echo "0")
        
        if [[ "$aa_profiles" -gt 0 ]]; then
            log_success "AppArmor actif: $aa_profiles profils chargés, $aa_enforced en enforce"
            add_result "MAC-001" "MAC" "ANSSI" "PASS" "critical" \
                "$aa_profiles profils chargés, $aa_enforced en mode enforce" "" "ANSSI R51"
                
            local complain_profiles
            complain_profiles=$(aa-status 2>/dev/null | grep "profiles are in complain" | head -1 | awk '{print $1}' || echo "0")
            if [[ "$complain_profiles" -gt 0 ]]; then
                add_result "MAC-002" "MAC" "AppArmor profils complain" "WARN" "medium" \
                    "$complain_profiles profils en mode complain" \
                    "Passer les profils critiques en enforce" "ANSSI R51"
            else
                add_result "MAC-002" "MAC" "AppArmor profils" "PASS" "medium" \
                    "Tous les profils sont en mode enforce" "" "ANSSI R51"
            fi
        else
            log_warning "AppArmor sans profils actifs"
            add_result "MAC-001" "MAC" "ANSSI" "WARN" "critical" \
                "AppArmor installé mais aucun profil actif" \
                "Activer les profils par défaut" "ANSSI R51"
        fi
    else
        log_error "Aucun MAC (SELinux/AppArmor) détecté"
        add_result "MAC-001" "MAC" "Contrôle accès mandataire" "FAIL" "critical" \
            "Aucun système MAC installé" \
            "Installer SELinux ou AppArmor" "ANSSI R51"
    fi
}

#===============================================================================
# CONTRÔLES RENFORCÉS - PAM Configuration
#===============================================================================

audit_pam_advanced() {
    print_section "CONFIGURATION PAM (RENFORCÉ)"
    
    # R52: pam_pwquality
    log_info "Vérification pam_pwquality..."
    if grep -rq "pam_pwquality" /etc/pam.d/ 2>/dev/null; then
        log_success "pam_pwquality configuré"
        add_result "PAM-001" "PAM" "Qualité mots de passe" "PASS" "high" \
            "pam_pwquality est configuré pour la complexité" "" "ANSSI R52"
    else
        log_warning "pam_pwquality non détecté"
        add_result "PAM-001" "PAM" "Qualité mots de passe" "WARN" "high" \
            "pam_pwquality non configuré" \
            "Configurer dans /etc/pam.d/common-password" "ANSSI R52"
    fi
    
    # R53: pam_faillock
    log_info "Vérification pam_faillock/pam_tally2..."
    if grep -rqE "pam_faillock|pam_tally2" /etc/pam.d/ 2>/dev/null; then
        log_success "Verrouillage de compte configuré"
        add_result "PAM-002" "PAM" "Verrouillage compte" "PASS" "high" \
            "Verrouillage après échecs d'authentification configuré" "" "ANSSI R53"
    else
        log_warning "Pas de verrouillage de compte"
        add_result "PAM-002" "PAM" "Verrouillage compte" "WARN" "high" \
            "Aucun verrouillage après échecs d'authentification" \
            "Configurer pam_faillock dans /etc/pam.d" "ANSSI R53"
    fi
    
    # R54: pam_unix sha512
    log_info "Vérification algorithme de hachage..."
    if grep -rq "sha512" /etc/pam.d/ 2>/dev/null || grep -q "ENCRYPT_METHOD SHA512" /etc/login.defs 2>/dev/null; then
        log_success "SHA512 utilisé pour les mots de passe"
        add_result "PAM-003" "PAM" "Hachage SHA512" "PASS" "high" \
            "Algorithme SHA512 pour le hachage des mots de passe" "" "ANSSI R54"
    else
        log_warning "SHA512 non confirmé"
        add_result "PAM-003" "PAM" "Hachage SHA512" "WARN" "high" \
            "SHA512 non explicitement configuré" \
            "Ajouter ENCRYPT_METHOD SHA512 dans /etc/login.defs" "ANSSI R54"
    fi
    
    # R55: pam_limits
    log_info "Vérification limites ressources..."
    if [[ -f /etc/security/limits.conf ]]; then
        local has_limits=false
        if grep -qE "^[^#].*\s+(nofile|nproc|maxlogins)" /etc/security/limits.conf 2>/dev/null; then
            has_limits=true
        fi
        if [[ -d /etc/security/limits.d ]]; then
            if ls /etc/security/limits.d/*.conf &>/dev/null; then
                has_limits=true
            fi
        fi
        if [[ "$has_limits" == true ]]; then
            log_success "Limites ressources configurées"
            add_result "PAM-004" "PAM" "Limites ressources" "PASS" "medium" \
                "Limites utilisateur configurées dans limits.conf" "" "ANSSI R55"
        else
            log_warning "Limites ressources par défaut"
            add_result "PAM-004" "PAM" "Limites ressources" "WARN" "medium" \
                "Limites ressources non personnalisées" \
                "Configurer /etc/security/limits.conf" "ANSSI R55"
        fi
    fi
    
    # R56: pam_wheel pour su
    log_info "Vérification restriction su..."
    if grep -qE "^[^#].*pam_wheel" /etc/pam.d/su 2>/dev/null; then
        log_success "su restreint au groupe wheel"
        add_result "PAM-005" "PAM" "Restriction su" "PASS" "high" \
            "Commande su limitée au groupe wheel" "" "ANSSI R56"
    else
        log_warning "su accessible à tous"
        add_result "PAM-005" "PAM" "Restriction su" "WARN" "high" \
            "La commande su n'est pas restreinte" \
            "Activer pam_wheel dans /etc/pam.d/su" "ANSSI R56"
    fi
}

#===============================================================================
# CONTRÔLES RENFORCÉS - Chiffrement et Intégrité
#===============================================================================

audit_encryption() {
    print_section "CHIFFREMENT ET INTÉGRITÉ (RENFORCÉ)"
    
    # R57: Chiffrement disque LUKS
    log_info "Vérification chiffrement disque..."
    local luks_found=false
    if command -v lsblk &>/dev/null; then
        if lsblk -o TYPE 2>/dev/null | grep -q "crypt"; then
            luks_found=true
        fi
    fi
    if command -v dmsetup &>/dev/null; then
        if dmsetup ls --target crypt 2>/dev/null | grep -q "."; then
            luks_found=true
        fi
    fi
    
    if [[ "$luks_found" == true ]]; then
        log_success "Chiffrement LUKS détecté"
        add_result "ENC-001" "ANSSI" "LUKS disque" "PASS" "critical" \
            "Au moins une partition chiffrée LUKS détectée" "" "ANSSI R57"
    else
        log_warning "Pas de chiffrement disque détecté"
        add_result "ENC-001" "ANSSI" "LUKS disque" "WARN" "critical" \
            "Aucun chiffrement de disque détecté" \
            "Chiffrer les partitions sensibles avec LUKS" "ANSSI R57"
    fi
    
    # R58: dm-verity / dm-integrity
    log_info "Vérification intégrité disque..."
    local verity_found=false
    if command -v dmsetup &>/dev/null; then
        if dmsetup ls --target verity 2>/dev/null | grep -q "." || \
           dmsetup ls --target integrity 2>/dev/null | grep -q "."; then
            verity_found=true
        fi
    fi
    
    if [[ "$verity_found" == true ]]; then
        log_success "dm-verity/dm-integrity actif"
        add_result "ENC-002" "ANSSI" "Intégrité disque" "PASS" "high" \
            "Protection d'intégrité de disque active" "" "ANSSI R58"
    else
        log_info "dm-verity/dm-integrity non détecté"
        add_result "ENC-002" "ANSSI" "Intégrité disque" "WARN" "high" \
            "Pas de protection d'intégrité de disque" \
            "Considérer dm-verity pour les systèmes critiques" "ANSSI R58"
    fi
    
    # R59: GPG/SSL clés
    log_info "Vérification configuration TLS..."
    local weak_ciphers=false
    if [[ -f /etc/ssl/openssl.cnf ]]; then
        if grep -qiE "(RC4|DES|MD5|SSLv2|SSLv3)" /etc/ssl/openssl.cnf 2>/dev/null; then
            weak_ciphers=true
        fi
    fi
    
    if [[ "$weak_ciphers" == false ]]; then
        log_success "Configuration OpenSSL sans chiffrement faible"
        add_result "ENC-003" "ANSSI" "Configuration TLS" "PASS" "high" \
            "Pas de chiffrement faible détecté dans OpenSSL" "" "ANSSI R59"
    else
        log_warning "Chiffrements faibles possibles"
        add_result "ENC-003" "ANSSI" "Configuration TLS" "WARN" "high" \
            "Chiffrements faibles présents dans la configuration" \
            "Réviser /etc/ssl/openssl.cnf" "ANSSI R59"
    fi
}

#===============================================================================
# CONTRÔLES RENFORCÉS - Systemd Security
#===============================================================================

audit_systemd_security() {
    print_section "SÉCURITÉ SYSTEMD (RENFORCÉ)"
    
    # R60: Analyse services systemd
    log_info "Analyse sécurité services systemd..."
    
    if command -v systemd-analyze &>/dev/null; then
        local insecure_services=0
        local services_checked=0
        
        for service in sshd nginx apache2 httpd postgresql mysql mariadb docker; do
            if systemctl is-active "$service" &>/dev/null; then
                services_checked=$((services_checked + 1))
                local score
                score=$(systemd-analyze security "$service" 2>/dev/null | tail -1 | awk '{print $2}' | sed 's/[^0-9.]//g' || echo "10")
                if [[ -n "$score" ]] && [[ $(echo "$score > 7" | bc 2>/dev/null || echo "1") == "1" ]]; then
                    insecure_services=$((insecure_services + 1))
                fi
            fi
        done
        
        if [[ $services_checked -gt 0 ]]; then
            if [[ $insecure_services -eq 0 ]]; then
                log_success "Services systemd correctement sécurisés"
                add_result "SYS-001" "Systemd" "Sécurité services" "PASS" "medium" \
                    "Tous les services analysés ont un bon score de sécurité" "" "ANSSI R60"
            else
                log_warning "$insecure_services services avec score de sécurité faible"
                add_result "SYS-001" "Systemd" "Sécurité services" "WARN" "medium" \
                    "$insecure_services services ont un score > 7 (moins sécurisé)" \
                    "Utiliser systemd-analyze security pour identifier les problèmes" "ANSSI R60"
            fi
        fi
    fi
    
    # R61: ProtectSystem/ProtectHome
    log_info "Vérification options de sandboxing..."
    local sandbox_count=0
    for service_file in /etc/systemd/system/*.service /lib/systemd/system/*.service; do
        if [[ -f "$service_file" ]]; then
            if grep -qE "(ProtectSystem|ProtectHome|NoNewPrivileges)" "$service_file" 2>/dev/null; then
                sandbox_count=$((sandbox_count + 1))
            fi
        fi
    done 2>/dev/null
    
    if [[ $sandbox_count -gt 5 ]]; then
        log_success "Sandboxing systemd utilisé ($sandbox_count services)"
        add_result "SYS-002" "Systemd" "Sandboxing" "PASS" "medium" \
            "$sandbox_count services utilisent le sandboxing systemd" "" "ANSSI R61"
    else
        log_info "Sandboxing systemd peu utilisé"
        add_result "SYS-002" "Systemd" "Sandboxing" "WARN" "medium" \
            "Peu de services utilisent les options de sandboxing" \
            "Ajouter ProtectSystem, ProtectHome, NoNewPrivileges aux services" "ANSSI R61"
    fi
    
    # R62: Coredump systemd
    log_info "Vérification gestion coredump systemd..."
    if [[ -f /etc/systemd/coredump.conf ]]; then
        if grep -q "Storage=none" /etc/systemd/coredump.conf 2>/dev/null; then
            log_success "Coredumps systemd désactivés"
            add_result "SYS-003" "Systemd" "Coredumps" "PASS" "medium" \
                "Stockage des coredumps désactivé" "" "ANSSI R62"
        else
            log_warning "Coredumps systemd activés"
            add_result "SYS-003" "Systemd" "Coredumps" "WARN" "medium" \
                "Coredumps peuvent contenir des données sensibles" \
                "Ajouter Storage=none dans /etc/systemd/coredump.conf" "ANSSI R62"
        fi
    fi
}

#===============================================================================
# CONTRÔLES RENFORCÉS - Audit Avancé
#===============================================================================

audit_advanced_logging() {
    print_section "AUDIT AVANCÉ (RENFORCÉ)"
    
    # R63: Règles auditd détaillées
    log_info "Vérification règles auditd..."
    if [[ -d /etc/audit/rules.d ]]; then
        local rules_count
        rules_count=$(find /etc/audit/rules.d -name "*.rules" -exec cat {} + 2>/dev/null | grep -c "^-" || echo "0")
        
        if [[ $rules_count -ge 20 ]]; then
            log_success "Nombreuses règles audit ($rules_count)"
            add_result "AUD-001" "ANSSI" "Règles auditd" "PASS" "high" \
                "$rules_count règles d'audit configurées" "" "ANSSI R63"
        elif [[ $rules_count -ge 5 ]]; then
            log_warning "Règles audit basiques ($rules_count)"
            add_result "AUD-001" "ANSSI" "Règles auditd" "WARN" "high" \
                "Seulement $rules_count règles d'audit" \
                "Ajouter les règles ANSSI recommandées" "ANSSI R63"
        else
            log_error "Très peu de règles audit"
            add_result "AUD-001" "ANSSI" "Règles auditd" "FAIL" "high" \
                "Moins de 5 règles d'audit configurées" \
                "Configurer les règles d'audit ANSSI" "ANSSI R63"
        fi
    fi
    
    # R64: Audit des fichiers sensibles
    log_info "Vérification audit fichiers sensibles..."
    local sensitive_audit=false
    if auditctl -l 2>/dev/null | grep -qE "(/etc/passwd|/etc/shadow|/etc/sudoers)"; then
        sensitive_audit=true
    fi
    
    if [[ "$sensitive_audit" == true ]]; then
        log_success "Fichiers sensibles audités"
        add_result "AUD-002" "ANSSI" "Fichiers sensibles" "PASS" "high" \
            "Les fichiers critiques sont sous surveillance audit" "" "ANSSI R64"
    else
        log_warning "Fichiers sensibles non audités"
        add_result "AUD-002" "ANSSI" "Fichiers sensibles" "WARN" "high" \
            "/etc/passwd, shadow, sudoers non audités" \
            "Ajouter règles: -w /etc/passwd -p wa -k identity" "ANSSI R64"
    fi
    
    # R65: Audit des commandes privilégiées
    log_info "Vérification audit commandes privilégiées..."
    local priv_audit=false
    if auditctl -l 2>/dev/null | grep -qE "(sudo|su|passwd|useradd)"; then
        priv_audit=true
    fi
    
    if [[ "$priv_audit" == true ]]; then
        log_success "Commandes privilégiées auditées"
        add_result "AUD-003" "ANSSI" "Commandes privilégiées" "PASS" "high" \
            "Utilisation de sudo/su/passwd sous audit" "" "ANSSI R65"
    else
        log_warning "Commandes privilégiées non auditées"
        add_result "AUD-003" "ANSSI" "Commandes privilégiées" "WARN" "high" \
            "L'utilisation de commandes privilégiées n'est pas auditée" \
            "Ajouter règles pour /usr/bin/sudo, /bin/su, etc." "ANSSI R65"
    fi
    
    # R66: Immutabilité des règles
    log_info "Vérification immutabilité règles audit..."
    if auditctl -l 2>/dev/null | grep -q "^-e 2"; then
        log_success "Règles audit immutables"
        add_result "AUD-004" "ANSSI" "Immutabilité règles" "PASS" "high" \
            "Les règles audit ne peuvent être modifiées sans reboot" "" "ANSSI R66"
    else
        log_warning "Règles audit modifiables"
        add_result "AUD-004" "ANSSI" "Immutabilité règles" "WARN" "high" \
            "Les règles audit peuvent être modifiées à chaud" \
            "Ajouter -e 2 à la fin des règles audit" "ANSSI R66"
    fi
}

#===============================================================================
# CONTRÔLES RENFORCÉS - Réseau Avancé
#===============================================================================

audit_network_advanced() {
    print_section "RÉSEAU AVANCÉ (RENFORCÉ)"
    
    # R67: Synproxy / SYN cookies
    log_info "Vérification protection SYN flood..."
    local syncookies
    syncookies=$(cat /proc/sys/net/ipv4/tcp_syncookies 2>/dev/null || echo "0")
    if [[ "$syncookies" == "1" ]]; then
        log_success "SYN cookies activés"
        add_result "NET-ADV-001" "ANSSI" "SYN cookies" "PASS" "high" \
            "Protection contre SYN flood active" "" "ANSSI R67"
    else
        log_warning "SYN cookies désactivés"
        add_result "NET-ADV-001" "ANSSI" "SYN cookies" "WARN" "high" \
            "Vulnérable aux attaques SYN flood" \
            "echo 1 > /proc/sys/net/ipv4/tcp_syncookies" "ANSSI R67"
    fi
    
    # R68: Reverse path filtering
    log_info "Vérification reverse path filtering..."
    local rpf
    rpf=$(cat /proc/sys/net/ipv4/conf/all/rp_filter 2>/dev/null || echo "0")
    if [[ "$rpf" == "1" ]] || [[ "$rpf" == "2" ]]; then
        log_success "Reverse path filtering actif"
        add_result "NET-ADV-002" "ANSSI" "Reverse path filter" "PASS" "medium" \
            "rp_filter=$rpf (protection anti-spoofing)" "" "ANSSI R68"
    else
        log_warning "Reverse path filtering désactivé"
        add_result "NET-ADV-002" "ANSSI" "Reverse path filter" "WARN" "medium" \
            "Anti-spoofing désactivé" \
            "echo 1 > /proc/sys/net/ipv4/conf/all/rp_filter" "ANSSI R68"
    fi
    
    # R69: TCP timestamps
    log_info "Vérification TCP timestamps..."
    local timestamps
    timestamps=$(cat /proc/sys/net/ipv4/tcp_timestamps 2>/dev/null || echo "1")
    if [[ "$timestamps" == "0" ]]; then
        log_success "TCP timestamps désactivés"
        add_result "NET-ADV-003" "ANSSI" "TCP timestamps" "PASS" "low" \
            "TCP timestamps désactivés (anti-fingerprinting)" "" "ANSSI R69"
    else
        log_info "TCP timestamps activés"
        add_result "NET-ADV-003" "ANSSI" "TCP timestamps" "WARN" "low" \
            "TCP timestamps peuvent révéler l'uptime" \
            "Désactiver si nécessaire: sysctl -w net.ipv4.tcp_timestamps=0" "ANSSI R69"
    fi
    
    # R70: Ports privilégiés
    log_info "Vérification ports privilégiés..."
    local unprivileged_ports
    unprivileged_ports=$(cat /proc/sys/net/ipv4/ip_unprivileged_port_start 2>/dev/null || echo "1024")
    if [[ "$unprivileged_ports" -ge 1024 ]]; then
        log_success "Ports < 1024 réservés à root"
        add_result "NET-ADV-004" "ANSSI" "Ports privilégiés" "PASS" "medium" \
            "Seulement root peut écouter sur les ports < $unprivileged_ports" "" "ANSSI R70"
    else
        log_warning "Ports non privilégiés étendus"
        add_result "NET-ADV-004" "ANSSI" "Ports privilégiés" "WARN" "medium" \
            "Utilisateurs non-root peuvent écouter sur des ports bas" "" "ANSSI R70"
    fi
}

#===============================================================================
# CONTRÔLES RENFORCÉS - Conteneurs et Isolation
#===============================================================================

audit_containers() {
    print_section "CONTENEURS ET ISOLATION (RENFORCÉ)"
    
    # R71: Docker daemon
    log_info "Vérification sécurité Docker..."
    if command -v docker &>/dev/null; then
        if systemctl is-active docker &>/dev/null; then
            # Vérifier les options de sécurité Docker
            local docker_issues=0
            
            # Vérifier userns-remap
            if ! docker info 2>/dev/null | grep -q "userns"; then
                docker_issues=$((docker_issues + 1))
            fi
            
            if [[ $docker_issues -eq 0 ]]; then
                log_success "Docker configuré avec options de sécurité"
                add_result "CNT-001" "ANSSI" "Docker sécurité" "PASS" "high" \
                    "Docker configuré avec userns-remap" "" "ANSSI R71"
            else
                log_warning "Docker sans isolation user namespace"
                add_result "CNT-001" "ANSSI" "Docker sécurité" "WARN" "high" \
                    "Docker sans userns-remap activé" \
                    "Activer userns-remap dans /etc/docker/daemon.json" "ANSSI R71"
            fi
            
            # R72: Conteneurs privileged
            log_info "Vérification conteneurs privilégiés..."
            local priv_containers
            priv_containers=$(docker ps --format '{{.ID}}' 2>/dev/null | xargs -I {} docker inspect {} 2>/dev/null | grep -c '"Privileged": true' || echo "0")
            
            if [[ "$priv_containers" == "0" ]]; then
                log_success "Aucun conteneur privilégié en cours"
                add_result "CNT-002" "ANSSI" "Conteneurs privilégiés" "PASS" "critical" \
                    "Aucun conteneur en mode privileged" "" "ANSSI R72"
            else
                log_error "$priv_containers conteneurs privilégiés détectés"
                add_result "CNT-002" "ANSSI" "Conteneurs privilégiés" "FAIL" "critical" \
                    "$priv_containers conteneurs tournent en mode privileged" \
                    "Revoir les conteneurs et retirer --privileged" "ANSSI R72"
            fi
        fi
    else
        log_info "Docker non installé"
        add_result "CNT-001" "ANSSI" "ANSSI" "PASS" "low" \
            "Docker non installé (non applicable)" "" "ANSSI R71"
    fi
    
    # R73: Cgroups v2
    log_info "Vérification cgroups v2..."
    if [[ -f /sys/fs/cgroup/cgroup.controllers ]]; then
        log_success "Cgroups v2 (unified) actif"
        add_result "CNT-003" "ANSSI" "Cgroups v2" "PASS" "medium" \
            "Cgroups v2 offre une meilleure isolation" "" "ANSSI R73"
    else
        log_info "Cgroups v1 (legacy)"
        add_result "CNT-003" "ANSSI" "Cgroups v2" "WARN" "medium" \
            "Système utilise cgroups v1" \
            "Migrer vers cgroups v2 pour une meilleure sécurité" "ANSSI R73"
    fi
    
    # R74: Namespace isolation
    log_info "Vérification support namespaces..."
    local ns_support=0
    for ns in user pid net mnt uts ipc; do
        if [[ -d /proc/1/ns ]]; then
            if [[ -L "/proc/1/ns/$ns" ]]; then
                ns_support=$((ns_support + 1))
            fi
        fi
    done
    
    if [[ $ns_support -ge 6 ]]; then
        log_success "Tous les namespaces supportés"
        add_result "CNT-004" "ANSSI" "Namespaces" "PASS" "medium" \
            "Support complet des namespaces Linux" "" "ANSSI R74"
    else
        log_warning "Support namespaces incomplet"
        add_result "CNT-004" "ANSSI" "Namespaces" "WARN" "medium" \
            "Certains namespaces non disponibles" "" "ANSSI R74"
    fi
}

#===============================================================================
# CONTRÔLES RENFORCÉS - Divers
#===============================================================================

audit_miscellaneous() {
    print_section "CONTRÔLES DIVERS (RENFORCÉ)"
    
    # R75: USB storage
    log_info "Vérification stockage USB..."
    local usb_disabled=false
    if lsmod 2>/dev/null | grep -q "usb-storage"; then
        usb_disabled=false
    else
        usb_disabled=true
    fi
    if [[ -f /etc/modprobe.d/blacklist.conf ]] && grep -q "usb-storage" /etc/modprobe.d/blacklist.conf 2>/dev/null; then
        usb_disabled=true
    fi
    
    if [[ "$usb_disabled" == true ]]; then
        log_success "Stockage USB désactivé"
        add_result "MSC-001" "Divers" "Stockage USB" "PASS" "medium" \
            "Module usb-storage non chargé ou blacklisté" "" "ANSSI R75"
    else
        log_info "Stockage USB activé"
        add_result "MSC-001" "Divers" "Stockage USB" "WARN" "medium" \
            "Stockage USB autorisé" \
            "Blacklister usb-storage si non nécessaire" "ANSSI R75"
    fi
    
    # R76: Firewire
    log_info "Vérification Firewire/Thunderbolt..."
    local firewire_disabled=true
    if lsmod 2>/dev/null | grep -qE "(firewire|ohci1394|sbp2|thunderbolt)"; then
        firewire_disabled=false
    fi
    
    if [[ "$firewire_disabled" == true ]]; then
        log_success "Firewire/Thunderbolt désactivé"
        add_result "MSC-002" "Divers" "Firewire DMA" "PASS" "high" \
            "Modules DMA dangereux non chargés" "" "ANSSI R76"
    else
        log_warning "Firewire/Thunderbolt actif (risque DMA)"
        add_result "MSC-002" "Divers" "Firewire DMA" "WARN" "high" \
            "Modules DMA actifs (attaque possible)" \
            "Blacklister firewire_ohci, thunderbolt" "ANSSI R76"
    fi
    
    # R77: Bluetooth
    log_info "Vérification Bluetooth..."
    local bt_disabled=true
    if systemctl is-active bluetooth &>/dev/null; then
        bt_disabled=false
    fi
    if lsmod 2>/dev/null | grep -q "bluetooth"; then
        bt_disabled=false
    fi
    
    if [[ "$bt_disabled" == true ]]; then
        log_success "Bluetooth désactivé"
        add_result "MSC-003" "Divers" "Bluetooth" "PASS" "medium" \
            "Service Bluetooth inactif" "" "ANSSI R77"
    else
        log_info "Bluetooth actif"
        add_result "MSC-003" "Divers" "Bluetooth" "WARN" "medium" \
            "Bluetooth actif (surface d'attaque)" \
            "Désactiver si non nécessaire: systemctl disable bluetooth" "ANSSI R77"
    fi
    
    # R78: Webcam/microphone
    log_info "Vérification périphériques multimédia..."
    local multimedia_info=""
    if lsmod 2>/dev/null | grep -q "uvcvideo"; then
        multimedia_info="webcam active"
    fi
    if [[ -n "$multimedia_info" ]]; then
        log_info "Périphériques: $multimedia_info"
        add_result "MSC-004" "Divers" "Multimédia" "WARN" "low" \
            "Périphériques multimédia détectés: $multimedia_info" \
            "Blacklister uvcvideo si webcam non nécessaire" "ANSSI R78"
    else
        log_success "Pas de périphériques multimédia actifs"
        add_result "MSC-004" "Divers" "Multimédia" "PASS" "low" \
            "Aucun périphérique multimédia détecté" "" "ANSSI R78"
    fi
    
    # R79: Compte root direct
    log_info "Vérification accès root direct..."
    local root_login_disabled=true
    if [[ -f /etc/securetty ]]; then
        if [[ -s /etc/securetty ]]; then
            root_login_disabled=false
        fi
    fi
    if grep -q "^root:" /etc/passwd && [[ $(grep "^root:" /etc/shadow | cut -d: -f2) != "!" ]] && [[ $(grep "^root:" /etc/shadow | cut -d: -f2) != "*" ]]; then
        if grep -q "PermitRootLogin no" /etc/ssh/sshd_config 2>/dev/null; then
            root_login_disabled=true
        fi
    fi
    
    if [[ "$root_login_disabled" == true ]]; then
        log_success "Connexion root directe restreinte"
        add_result "MSC-005" "Divers" "Connexion root" "PASS" "high" \
            "Connexion directe en root limitée" "" "ANSSI R79"
    else
        log_warning "Connexion root possible"
        add_result "MSC-005" "Divers" "Connexion root" "WARN" "high" \
            "Root peut se connecter directement" \
            "Utiliser sudo et désactiver le login root" "ANSSI R79"
    fi
    
    # R80: Bannières légales
    log_info "Vérification bannières légales..."
    local has_banner=false
    if [[ -s /etc/issue ]] || [[ -s /etc/issue.net ]] || [[ -s /etc/motd ]]; then
        if grep -qiE "(authorized|warning|legal|avertissement)" /etc/issue /etc/issue.net /etc/motd 2>/dev/null; then
            has_banner=true
        fi
    fi
    
    if [[ "$has_banner" == true ]]; then
        log_success "Bannières légales configurées"
        add_result "MSC-006" "Divers" "Bannières légales" "PASS" "low" \
            "Message d'avertissement légal présent" "" "ANSSI R80"
    else
        log_info "Pas de bannière légale"
        add_result "MSC-006" "Divers" "Bannières légales" "WARN" "low" \
            "Aucun avertissement légal configuré" \
            "Configurer /etc/issue et /etc/motd" "ANSSI R80"
    fi
}

#===============================================================================
# Catégorie 10: Contrôles CIS Benchmark Level 2
#===============================================================================

audit_cis_level2() {
    print_section "10. CONTRÔLES CIS BENCHMARK LEVEL 2"
    
    # CIS 1.4.1: Synchronisation temps
    log_info "Vérification synchronisation temps..."
    local time_sync=false
    if systemctl is-active chronyd &>/dev/null || systemctl is-active chrony &>/dev/null; then
        time_sync=true
        add_result "CIS-001" "CIS L2" "Synchronisation temps" "PASS" "medium" \
            "chrony est actif" "" "CIS 1.4.1"
    elif systemctl is-active systemd-timesyncd &>/dev/null; then
        time_sync=true
        add_result "CIS-001" "CIS L2" "Synchronisation temps" "PASS" "medium" \
            "systemd-timesyncd est actif" "" "CIS 1.4.1"
    fi
    if [[ "$time_sync" == false ]]; then
        add_result "CIS-001" "CIS L2" "Synchronisation temps" "FAIL" "medium" \
            "Aucun service de synchronisation temps actif" \
            "Installer chrony" "CIS 1.4.1"
    fi
    
    # CIS 1.5.1: Core dumps
    log_info "Vérification core dumps..."
    local core_sysctl="2"
    if [[ -f /proc/sys/fs/suid_dumpable ]]; then
        core_sysctl=$(cat /proc/sys/fs/suid_dumpable) || true
    fi
    local core_limit_conf=0
    if [[ -f /etc/security/limits.conf ]] && grep -qE "^\*.*hard.*core.*0" /etc/security/limits.conf 2>/dev/null; then
        core_limit_conf=1
    fi
    if [[ -d /etc/security/limits.d ]] && grep -rqE "^\*.*hard.*core.*0" /etc/security/limits.d/ 2>/dev/null; then
        core_limit_conf=1
    fi
    
    if [[ "$core_sysctl" == "0" ]] && [[ "$core_limit_conf" -gt 0 ]]; then
        log_success "Core dumps entièrement restreints"
        add_result "CIS-002" "CIS L2" "Core dumps" "PASS" "high" \
            "Core dumps désactivés (sysctl + limits)" "" "CIS 1.5.1"
    else
        log_warning "Core dumps partiellement restreints"
        add_result "CIS-002" "CIS L2" "Core dumps" "WARN" "high" \
            "Core dumps non entièrement désactivés" \
            "Ajouter '* hard core 0' dans limits.conf et fs.suid_dumpable=0" "CIS 1.5.1"
    fi
    
    # CIS 1.6.1: Prelink désactivé
    log_info "Vérification prelink..."
    if ! command -v prelink &>/dev/null; then
        log_success "prelink non installé"
        add_result "CIS-003" "CIS L2" "Prelink" "PASS" "medium" \
            "prelink n'est pas installé (sécurisé)" "" "CIS 1.6.1"
    else
        log_warning "prelink installé"
        add_result "CIS-003" "CIS L2" "Prelink" "WARN" "medium" \
            "prelink est installé (affaiblit ASLR)" \
            "Désinstaller prelink: apt remove prelink" "CIS 1.6.1"
    fi
    
    # CIS 2.2.5: DHCP Server
    log_info "Vérification serveur DHCP..."
    if ! systemctl is-active isc-dhcp-server &>/dev/null && ! systemctl is-active dhcpd &>/dev/null; then
        log_success "Serveur DHCP non actif"
        add_result "CIS-004" "CIS L2" "Serveur DHCP" "PASS" "medium" \
            "Aucun serveur DHCP actif" "" "CIS 2.2.5"
    else
        log_warning "Serveur DHCP actif"
        add_result "CIS-004" "CIS L2" "Serveur DHCP" "WARN" "medium" \
            "Un serveur DHCP est actif" \
            "Désactiver si non nécessaire" "CIS 2.2.5"
    fi
    
    # CIS 2.2.6: LDAP Server
    log_info "Vérification serveur LDAP..."
    if ! systemctl is-active slapd &>/dev/null; then
        log_success "Serveur LDAP non actif"
        add_result "CIS-005" "CIS L2" "Serveur LDAP" "PASS" "medium" \
            "slapd n'est pas actif" "" "CIS 2.2.6"
    else
        log_info "Serveur LDAP actif"
        add_result "CIS-005" "CIS L2" "Serveur LDAP" "WARN" "medium" \
            "Serveur LDAP (slapd) actif" \
            "Sécuriser ou désactiver si non nécessaire" "CIS 2.2.6"
    fi
    
    # CIS 2.2.7: NFS Server
    log_info "Vérification serveur NFS..."
    if ! systemctl is-active nfs-server &>/dev/null && ! systemctl is-active nfs-kernel-server &>/dev/null; then
        log_success "Serveur NFS non actif"
        add_result "CIS-006" "CIS L2" "Serveur NFS" "PASS" "medium" \
            "Aucun serveur NFS actif" "" "CIS 2.2.7"
    else
        log_warning "Serveur NFS actif"
        add_result "CIS-006" "CIS L2" "Serveur NFS" "WARN" "medium" \
            "Serveur NFS actif (risque réseau)" \
            "Sécuriser ou désactiver" "CIS 2.2.7"
    fi
    
    # CIS 2.2.8: DNS Server
    log_info "Vérification serveur DNS..."
    if ! systemctl is-active named &>/dev/null && ! systemctl is-active bind9 &>/dev/null; then
        log_success "Serveur DNS non actif"
        add_result "CIS-007" "CIS L2" "Serveur DNS" "PASS" "medium" \
            "Aucun serveur DNS local actif" "" "CIS 2.2.8"
    else
        log_info "Serveur DNS actif"
        add_result "CIS-007" "CIS L2" "Serveur DNS" "WARN" "medium" \
            "Serveur DNS (BIND) actif" \
            "Sécuriser la configuration BIND" "CIS 2.2.8"
    fi
    
    # CIS 2.2.9: FTP Server
    log_info "Vérification serveur FTP..."
    if ! systemctl is-active vsftpd &>/dev/null && ! systemctl is-active proftpd &>/dev/null; then
        log_success "Serveur FTP non actif"
        add_result "CIS-008" "CIS L2" "Serveur FTP" "PASS" "high" \
            "Aucun serveur FTP actif" "" "CIS 2.2.9"
    else
        log_warning "Serveur FTP actif (protocole non sécurisé)"
        add_result "CIS-008" "CIS L2" "Serveur FTP" "WARN" "high" \
            "Serveur FTP actif - protocole non chiffré" \
            "Utiliser SFTP/SCP à la place" "CIS 2.2.9"
    fi
    
    # CIS 2.2.10: HTTP Server
    log_info "Vérification serveur HTTP..."
    if ! systemctl is-active apache2 &>/dev/null && ! systemctl is-active httpd &>/dev/null && ! systemctl is-active nginx &>/dev/null; then
        log_success "Serveur HTTP non actif"
        add_result "CIS-009" "CIS L2" "Serveur HTTP" "PASS" "low" \
            "Aucun serveur web actif" "" "CIS 2.2.10"
    else
        log_info "Serveur HTTP actif"
        add_result "CIS-009" "CIS L2" "Serveur HTTP" "WARN" "low" \
            "Serveur web actif - vérifier la sécurisation" \
            "Configurer TLS, headers de sécurité" "CIS 2.2.10"
    fi
    
    # CIS 2.2.11: IMAP/POP3 Server
    log_info "Vérification serveur mail..."
    if ! systemctl is-active dovecot &>/dev/null && ! systemctl is-active courier-imap &>/dev/null; then
        log_success "Serveur IMAP/POP3 non actif"
        add_result "CIS-010" "CIS L2" "Serveur Mail" "PASS" "medium" \
            "Aucun serveur IMAP/POP3 actif" "" "CIS 2.2.11"
    else
        log_info "Serveur mail actif"
        add_result "CIS-010" "CIS L2" "Serveur Mail" "WARN" "medium" \
            "Serveur IMAP/POP3 actif" \
            "Vérifier la configuration TLS" "CIS 2.2.11"
    fi
    
    # CIS 2.2.12: Samba
    log_info "Vérification Samba..."
    if ! systemctl is-active smbd &>/dev/null; then
        log_success "Samba non actif"
        add_result "CIS-011" "CIS L2" "Samba" "PASS" "medium" \
            "Samba (smbd) n'est pas actif" "" "CIS 2.2.12"
    else
        log_warning "Samba actif"
        add_result "CIS-011" "CIS L2" "Samba" "WARN" "medium" \
            "Samba est actif" \
            "Vérifier les partages et la sécurité SMB" "CIS 2.2.12"
    fi
    
    # CIS 2.2.14: SNMP Server
    log_info "Vérification SNMP..."
    if ! systemctl is-active snmpd &>/dev/null; then
        log_success "SNMP non actif"
        add_result "CIS-012" "CIS L2" "SNMP" "PASS" "medium" \
            "Service SNMP non actif" "" "CIS 2.2.14"
    else
        log_warning "SNMP actif"
        add_result "CIS-012" "CIS L2" "SNMP" "WARN" "medium" \
            "SNMP est actif - vérifier communautés" \
            "Utiliser SNMPv3 avec authentification" "CIS 2.2.14"
    fi
    
    # CIS 2.2.16: rsync
    log_info "Vérification rsync daemon..."
    if ! systemctl is-active rsync &>/dev/null && ! systemctl is-active rsyncd &>/dev/null; then
        log_success "rsync daemon non actif"
        add_result "CIS-013" "CIS L2" "rsync daemon" "PASS" "medium" \
            "rsync daemon n'est pas actif" "" "CIS 2.2.16"
    else
        log_warning "rsync daemon actif"
        add_result "CIS-013" "CIS L2" "rsync daemon" "WARN" "medium" \
            "rsync daemon est actif" \
            "Désactiver si non nécessaire" "CIS 2.2.16"
    fi
    
    # CIS 2.3.1: NIS Client
    log_info "Vérification client NIS..."
    local nis_installed=false
    if command -v dpkg &>/dev/null && dpkg -l nis 2>/dev/null | grep -q "^ii"; then
        nis_installed=true
    fi
    if command -v rpm &>/dev/null && rpm -q ypbind &>/dev/null 2>&1; then
        nis_installed=true
    fi
    
    if [[ "$nis_installed" == false ]]; then
        log_success "Client NIS non installé"
        add_result "CIS-014" "CIS L2" "Client NIS" "PASS" "high" \
            "Client NIS (ypbind) non installé" "" "CIS 2.3.1"
    else
        log_error "Client NIS installé (obsolète)"
        add_result "CIS-014" "CIS L2" "Client NIS" "FAIL" "high" \
            "Client NIS installé - protocole non sécurisé" \
            "Retirer le client NIS et utiliser LDAP/Kerberos" "CIS 2.3.1"
    fi
    
    # CIS 2.3.2: rsh Client
    log_info "Vérification client rsh..."
    if ! command -v rsh &>/dev/null && ! command -v rlogin &>/dev/null; then
        log_success "Client rsh non installé"
        add_result "CIS-015" "CIS L2" "Client rsh" "PASS" "high" \
            "Clients rsh/rlogin non installés" "" "CIS 2.3.2"
    else
        log_error "Client rsh installé (non sécurisé)"
        add_result "CIS-015" "CIS L2" "Client rsh" "FAIL" "high" \
            "rsh/rlogin installé - protocole non chiffré" \
            "Désinstaller et utiliser SSH" "CIS 2.3.2"
    fi
    
    # CIS 2.3.3: talk Client
    log_info "Vérification talk..."
    if ! command -v talk &>/dev/null; then
        log_success "talk non installé"
        add_result "CIS-016" "CIS L2" "talk" "PASS" "low" \
            "Client talk non installé" "" "CIS 2.3.3"
    else
        log_warning "talk installé"
        add_result "CIS-016" "CIS L2" "talk" "WARN" "low" \
            "Client talk installé (obsolète)" \
            "Désinstaller talk" "CIS 2.3.3"
    fi
    
    # CIS 2.3.4: telnet Client
    log_info "Vérification telnet..."
    if ! command -v telnet &>/dev/null; then
        log_success "telnet non installé"
        add_result "CIS-017" "CIS L2" "telnet" "PASS" "high" \
            "Client telnet non installé" "" "CIS 2.3.4"
    else
        log_warning "telnet installé"
        add_result "CIS-017" "CIS L2" "telnet" "WARN" "high" \
            "telnet installé - protocole non chiffré" \
            "Utiliser SSH à la place" "CIS 2.3.4"
    fi
    
    # CIS 4.1.1.2: auditd activé au boot
    log_info "Vérification auditd au démarrage..."
    if systemctl is-enabled auditd &>/dev/null; then
        log_success "auditd activé au boot"
        add_result "CIS-018" "CIS L2" "auditd boot" "PASS" "high" \
            "auditd est activé au démarrage" "" "CIS 4.1.1.2"
    else
        log_error "auditd non activé au boot"
        add_result "CIS-018" "CIS L2" "auditd boot" "FAIL" "high" \
            "auditd n'est pas activé au démarrage" \
            "systemctl enable auditd" "CIS 4.1.1.2"
    fi
    
    # CIS 5.2.4: SSH MaxAuthTries
    log_info "Vérification SSH MaxAuthTries..."
    local max_auth=$(grep -E "^MaxAuthTries" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' || echo "6")
    if [[ "$max_auth" -le 4 ]]; then
        log_success "SSH MaxAuthTries configuré ($max_auth)"
        add_result "CIS-019" "CIS L2" "SSH MaxAuthTries" "PASS" "medium" \
            "MaxAuthTries = $max_auth" "" "CIS 5.2.4"
    else
        log_warning "SSH MaxAuthTries trop élevé"
        add_result "CIS-019" "CIS L2" "SSH MaxAuthTries" "WARN" "medium" \
            "MaxAuthTries = $max_auth (recommandé: 4)" \
            "Ajouter 'MaxAuthTries 4' dans sshd_config" "CIS 5.2.4"
    fi
    
    # CIS 5.2.5: SSH IgnoreRhosts
    log_info "Vérification SSH IgnoreRhosts..."
    local ignore_rhosts=$(grep -E "^IgnoreRhosts" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' || echo "yes")
    if [[ "$ignore_rhosts" == "yes" ]]; then
        log_success "SSH IgnoreRhosts activé"
        add_result "CIS-020" "CIS L2" "SSH IgnoreRhosts" "PASS" "high" \
            "IgnoreRhosts = yes" "" "CIS 5.2.5"
    else
        log_error "SSH IgnoreRhosts désactivé"
        add_result "CIS-020" "CIS L2" "SSH IgnoreRhosts" "FAIL" "high" \
            "IgnoreRhosts non configuré" \
            "Ajouter 'IgnoreRhosts yes' dans sshd_config" "CIS 5.2.5"
    fi
}

#===============================================================================
# Génération du rapport
#===============================================================================

generate_html_report() {
    local score="$1"
    local grade="$2"
    local html_file="${OUTPUT_FILE%.json}.html"
    
    local hostname_val
    hostname_val=$(hostname)
    local os_val
    os_val=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo 'Unknown')
    local kernel_val
    kernel_val=$(uname -r)
    local arch_val
    arch_val=$(uname -m)
    local date_val
    date_val=$(date "+%d/%m/%Y %H:%M:%S")
    
    local grade_color=""
    case "$grade" in
        "A") grade_color="#22c55e" ;;
        "B") grade_color="#84cc16" ;;
        "C") grade_color="#eab308" ;;
        "D") grade_color="#f97316" ;;
        "F") grade_color="#ef4444" ;;
    esac
    
    cat > "$html_file" << 'HTMLHEAD'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'Audit Sécurité Linux - Infra Shield Tools</title>
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
        .score-circle { width: 150px; height: 150px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .score-value { font-size: 48px; font-weight: bold; color: white; }
        .score-label { font-size: 14px; color: rgba(255,255,255,0.8); }
        .grade { font-size: 24px; font-weight: bold; margin-top: 10px; }
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
HTMLHEAD

    cat >> "$html_file" << HTMLHEADER
        <div class="header">
            <h1>Rapport d'Audit de Sécurité Linux (RENFORCÉ)</h1>
            <div class="subtitle">Généré par Infra Shield Tools - ~80 contrôles complets</div>
            <div class="framework">Référentiel ANSSI-BP-028 v2.0</div>
        </div>

        <div class="summary-grid">
            <div class="card score-card">
                <div class="score-circle" style="background: ${grade_color};">
                    <div class="score-value">${score}%</div>
                    <div class="score-label">Score</div>
                </div>
                <div class="grade" style="color: ${grade_color};">Note: ${grade}</div>
                <div class="stats">
                    <div class="stat pass">
                        <div class="stat-value">${PASSED_CHECKS}</div>
                        <div class="stat-label">Réussis</div>
                    </div>
                    <div class="stat warn">
                        <div class="stat-value">${WARNING_CHECKS}</div>
                        <div class="stat-label">Alertes</div>
                    </div>
                    <div class="stat fail">
                        <div class="stat-value">${FAILED_CHECKS}</div>
                        <div class="stat-label">Échecs</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-bottom: 15px;">Informations Système</h3>
                <div class="info-grid">
                    <div class="info-item"><span class="info-label">Hostname</span><span class="info-value">${hostname_val}</span></div>
                    <div class="info-item"><span class="info-label">Date</span><span class="info-value">${date_val}</span></div>
                    <div class="info-item"><span class="info-label">Système</span><span class="info-value">${os_val}</span></div>
                    <div class="info-item"><span class="info-label">Noyau</span><span class="info-value">${kernel_val}</span></div>
                    <div class="info-item"><span class="info-label">Architecture</span><span class="info-value">${arch_val}</span></div>
                    <div class="info-item"><span class="info-label">Version Script</span><span class="info-value">${VERSION}</span></div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Résultats Détaillés</h2>
HTMLHEADER

    for result in "${RESULTS[@]}"; do
        local id title status severity category description remediation
        id=$(echo "$result" | sed 's/.*"id":"\([^"]*\)".*/\1/')
        title=$(echo "$result" | sed 's/.*"title":"\([^"]*\)".*/\1/')
        status=$(echo "$result" | sed 's/.*"status":"\([^"]*\)".*/\1/')
        severity=$(echo "$result" | sed 's/.*"severity":"\([^"]*\)".*/\1/')
        category=$(echo "$result" | sed 's/.*"category":"\([^"]*\)".*/\1/')
        description=$(echo "$result" | sed 's/.*"description":"\([^"]*\)".*/\1/')
        remediation=$(echo "$result" | sed 's/.*"remediation":"\([^"]*\)".*/\1/')
        
        local status_class
        case "$status" in
            "PASS") status_class="pass"; status_icon="✓" ;;
            "WARN") status_class="warn"; status_icon="!" ;;
            "FAIL") status_class="fail"; status_icon="✗" ;;
        esac
        
        cat >> "$html_file" << HTMLRESULT
            <div class="result-item">
                <div class="result-status ${status_class}">${status_icon}</div>
                <div class="result-content">
                    <h4>${title}</h4>
                    <p>${description}</p>
HTMLRESULT
        
        if [[ -n "$remediation" && "$status" != "PASS" ]]; then
            echo "                    <div class=\"remediation\"><strong>Recommandation:</strong> ${remediation}</div>" >> "$html_file"
        fi
        
        cat >> "$html_file" << HTMLRESULTEND
                </div>
                <div class="result-meta">
                    <div class="result-category">${category}</div>
                    <div class="result-severity">${severity}</div>
                </div>
            </div>
HTMLRESULTEND
    done

    cat >> "$html_file" << 'HTMLFOOTER'
        </div>

        <div class="footer">
            <p>Rapport généré par <strong>Infra Shield Tools</strong></p>
            <p>Basé sur les recommandations ANSSI pour la sécurisation des systèmes GNU/Linux</p>
        </div>
    </div>
</body>
</html>
HTMLFOOTER

    echo -e "${GREEN}[OK]${NC} Rapport HTML généré: $html_file"
}

generate_report() {
    print_section "GÉNÉRATION DU RAPPORT"
    
    local score=0
    if [[ $TOTAL_CHECKS -gt 0 ]]; then
        score=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
    fi
    
    local grade=""
    if [[ $score -ge 90 ]]; then grade="A"
    elif [[ $score -ge 80 ]]; then grade="B"
    elif [[ $score -ge 70 ]]; then grade="C"
    elif [[ $score -ge 60 ]]; then grade="D"
    else grade="F"
    fi
    
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                       RÉSUMÉ DE L'AUDIT                            ║"
    echo "╠════════════════════════════════════════════════════════════════════╣"
    printf "║  Score Global: %-3d%%                                    Note: %-1s   ║\n" "$score" "$grade"
    echo "╠════════════════════════════════════════════════════════════════════╣"
    printf "║  ✓ Contrôles réussis:    %-3d                                      ║\n" "$PASSED_CHECKS"
    printf "║  ⚠ Avertissements:       %-3d                                      ║\n" "$WARNING_CHECKS"
    printf "║  ✗ Contrôles échoués:    %-3d                                      ║\n" "$FAILED_CHECKS"
    printf "║  Total:                  %-3d                                      ║\n" "$TOTAL_CHECKS"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    
    local hostname_val
    hostname_val=$(hostname)
    local os_val
    os_val=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo 'Unknown')
    local kernel_val
    kernel_val=$(uname -r)
    local arch_val
    arch_val=$(uname -m)
    local date_val
    date_val=$(date -Iseconds 2>/dev/null || date "+%Y-%m-%dT%H:%M:%S")
    
    local results_json="["
    local first=true
    for result in "${RESULTS[@]}"; do
        if [[ "$first" == true ]]; then
            first=false
        else
            results_json+=","
        fi
        results_json+="$result"
    done
    results_json+="]"
    
    cat > "$OUTPUT_FILE" << JSONREPORT
{
    "report_type": "linux_security_audit",
    "framework": "ANSSI-BP-028 + CIS Benchmark L2",
    "system_info": {
        "hostname": "${hostname_val}",
        "os": "${os_val}",
        "kernel": "${kernel_val}",
        "architecture": "${arch_val}",
        "audit_date": "${date_val}",
        "script_version": "${VERSION}"
    },
    "summary": {
        "total_checks": ${TOTAL_CHECKS},
        "passed": ${PASSED_CHECKS},
        "warnings": ${WARNING_CHECKS},
        "failed": ${FAILED_CHECKS},
        "score": ${score},
        "grade": "${grade}"
    },
    "results": ${results_json}
}
JSONREPORT
    
    echo ""
    echo -e "${GREEN}[OK]${NC} Rapport JSON généré: $OUTPUT_FILE"
    
    generate_html_report "$score" "$grade"
    
    echo ""
    if [[ $FAILED_CHECKS -gt 0 ]]; then
        echo -e "${RED}[ATTENTION]${NC} $FAILED_CHECKS contrôles critiques nécessitent une action immédiate."
    fi
    
    if [[ $WARNING_CHECKS -gt 0 ]]; then
        echo -e "${YELLOW}[INFO]${NC} $WARNING_CHECKS points d'amélioration identifiés."
    fi
    
    echo ""
    echo "Ouvrez le fichier HTML dans un navigateur pour visualiser le rapport."
    echo "Pour créer un PDF: Fichier > Imprimer > Enregistrer en PDF"
}

#===============================================================================
# Point d'entrée principal
#===============================================================================

main() {
    # Parsing des arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -o|--output)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Option inconnue: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Vérifications préliminaires
    check_root
    
    # Affichage du header
    print_header
    
    echo "Démarrage de l'audit de sécurité RENFORCÉ (~100 contrôles)..."
    echo "Fichier de sortie: $OUTPUT_FILE"
    echo ""
    
    # Exécution des audits ANSSI BASE
    audit_system_config
    audit_accounts
    audit_ssh
    audit_network
    audit_filesystem
    audit_services
    audit_logging
    audit_security_tools
    
    # Exécution des audits ANSSI RENFORCÉS
    audit_kernel_hardening
    audit_mandatory_access_control
    audit_pam_advanced
    audit_encryption
    audit_systemd_security
    audit_advanced_logging
    audit_network_advanced
    audit_containers
    audit_miscellaneous
    
    # Exécution des audits CIS Level 2
    audit_cis_level2
    
    # Génération du rapport
    generate_report
}

# Exécution
main "$@"
