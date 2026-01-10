#!/bin/bash
#===============================================================================
# InfraGuard Security - Script d'Audit de Sécurité Linux
# Basé sur les recommandations ANSSI (Agence nationale de la sécurité des SI)
# Version: 1.0.0
# 
# Ce script effectue un audit de sécurité complet d'un système Linux
# en suivant les recommandations du guide ANSSI pour la sécurisation GNU/Linux
#
# Usage: sudo ./linux-security-audit-anssi.sh [options]
# Options:
#   -o, --output <fichier>  Fichier de sortie JSON (défaut: audit_results.json)
#   -v, --verbose           Mode verbeux
#   -h, --help              Afficher l'aide
#
# Licence: Propriétaire InfraGuard Security
#===============================================================================

set -euo pipefail

# Configuration par défaut
OUTPUT_FILE="audit_results_$(date +%Y%m%d_%H%M%S).json"
VERBOSE=false
VERSION="1.0.0"
SCRIPT_NAME="InfraGuard Linux Security Audit"

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
    echo "║       InfraGuard Security - Audit Linux ANSSI v${VERSION}             ║"
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
        add_result "SYS-001" "Système" "Partitionnement sécurisé" "PASS" "high" \
            "Les partitions critiques sont correctement séparées" \
            "" "ANSSI R1"
    else
        log_warning "Partitions manquantes: ${missing_partitions[*]}"
        add_result "SYS-001" "Système" "Partitionnement sécurisé" "WARN" "high" \
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
        add_result "SYS-002" "Système" "Options de montage" "PASS" "medium" \
            "Les partitions ont des options de montage sécurisées" \
            "" "ANSSI R2"
    else
        log_warning "Problèmes de montage: ${mount_issues[*]}"
        add_result "SYS-002" "Système" "Options de montage" "WARN" "medium" \
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
        add_result "SYS-003" "Système" "Mises à jour automatiques" "PASS" "critical" \
            "Les mises à jour de sécurité automatiques sont activées" \
            "" "ANSSI R3"
    else
        log_error "Mises à jour automatiques non configurées"
        add_result "SYS-003" "Système" "Mises à jour automatiques" "FAIL" "critical" \
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
        add_result "SYS-004" "Système" "Version du noyau" "PASS" "high" \
            "Noyau Linux $kernel_version - version supportée" \
            "" "ANSSI R4"
    else
        log_warning "Version du noyau ancienne: $kernel_version"
        add_result "SYS-004" "Système" "Version du noyau" "WARN" "high" \
            "Noyau Linux $kernel_version - version potentiellement non supportée" \
            "Mettre à jour vers un noyau LTS récent (4.19+ ou 5.x+)" "ANSSI R4"
    fi
    
    # R5: Protection de la mémoire (ASLR)
    log_info "Vérification de l'ASLR..."
    
    local aslr=$(cat /proc/sys/kernel/randomize_va_space 2>/dev/null || echo "0")
    if [[ "$aslr" -eq 2 ]]; then
        log_success "ASLR activé (niveau 2)"
        add_result "SYS-005" "Système" "Protection mémoire ASLR" "PASS" "critical" \
            "Address Space Layout Randomization activé au niveau maximum" \
            "" "ANSSI R5"
    else
        log_error "ASLR non activé ou partiellement activé (niveau: $aslr)"
        add_result "SYS-005" "Système" "Protection mémoire ASLR" "FAIL" "critical" \
            "ASLR au niveau $aslr (devrait être 2)" \
            "echo 2 > /proc/sys/kernel/randomize_va_space et ajouter dans sysctl.conf" "ANSSI R5"
    fi
    
    # R6: Protection contre l'exécution de la pile
    log_info "Vérification NX/XD bit..."
    
    if grep -q ' nx ' /proc/cpuinfo 2>/dev/null; then
        log_success "Protection NX (No-eXecute) activée"
        add_result "SYS-006" "Système" "Protection NX bit" "PASS" "high" \
            "Le processeur supporte et utilise NX bit" \
            "" "ANSSI R6"
    else
        log_warning "Protection NX non détectée"
        add_result "SYS-006" "Système" "Protection NX bit" "WARN" "high" \
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
        add_result "ACC-001" "Comptes" "Comptes UID 0" "PASS" "critical" \
            "Seul le compte root possède l'UID 0" \
            "" "ANSSI R7"
    else
        log_error "Plusieurs comptes avec UID 0: $uid0_accounts"
        add_result "ACC-001" "Comptes" "Comptes UID 0" "FAIL" "critical" \
            "Comptes avec UID 0: $uid0_accounts" \
            "Supprimer ou modifier l'UID des comptes autres que root" "ANSSI R7"
    fi
    
    # R8: Mots de passe vides (! et * sont des comptes verrouillés, pas des mots de passe vides)
    log_info "Vérification des mots de passe vides..."
    
    # Only flag truly empty passwords (empty string), not locked accounts (! or *)
    local empty_pass=$(awk -F: '$2 == "" && $1 != "root" {print $1}' /etc/shadow 2>/dev/null | grep -v '^$' || true)
    
    if [[ -z "$empty_pass" ]]; then
        log_success "Aucun compte utilisateur avec mot de passe vide"
        add_result "ACC-002" "Comptes" "Mots de passe vides" "PASS" "critical" \
            "Tous les comptes ont un mot de passe défini ou sont verrouillés" \
            "" "ANSSI R8"
    else
        log_error "Comptes sans mot de passe: $empty_pass"
        add_result "ACC-002" "Comptes" "Mots de passe vides" "FAIL" "critical" \
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
        add_result "ACC-003" "Comptes" "Politique mots de passe" "PASS" "high" \
            "La politique de mots de passe respecte les recommandations" \
            "" "ANSSI R9"
    else
        log_warning "Politique de mots de passe insuffisante"
        add_result "ACC-003" "Comptes" "Politique mots de passe" "WARN" "high" \
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
        add_result "ACC-004" "Comptes" "Verrouillage échecs auth" "PASS" "high" \
            "Le verrouillage de compte après échecs est configuré" \
            "" "ANSSI R10"
    else
        log_error "Verrouillage après échecs non configuré"
        add_result "ACC-004" "Comptes" "Verrouillage échecs auth" "FAIL" "high" \
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
        add_result "ACC-005" "Comptes" "Configuration sudo" "PASS" "high" \
            "sudo est configuré de manière sécurisée" \
            "" "ANSSI R11"
    else
        log_warning "Problèmes sudo: ${sudo_issues[*]}"
        add_result "ACC-005" "Comptes" "Configuration sudo" "WARN" "high" \
            "Problèmes détectés: ${sudo_issues[*]}" \
            "Supprimer NOPASSWD et !authenticate de la configuration sudo" "ANSSI R11"
    fi
    
    # R12: Comptes système inutilisés
    log_info "Vérification des comptes système..."
    
    local unused_shells=0
    while IFS=: read -r user _ uid _ _ _ shell; do
        if [[ "$uid" -lt 1000 && "$uid" -ne 0 ]]; then
            if [[ "$shell" != "/sbin/nologin" && "$shell" != "/bin/false" && "$shell" != "/usr/sbin/nologin" ]]; then
                ((unused_shells++))
            fi
        fi
    done < /etc/passwd
    
    if [[ "$unused_shells" -eq 0 ]]; then
        log_success "Comptes système correctement configurés"
        add_result "ACC-006" "Comptes" "Comptes système" "PASS" "medium" \
            "Les comptes système ont des shells désactivés" \
            "" "ANSSI R12"
    else
        log_warning "$unused_shells comptes système avec shell actif"
        add_result "ACC-006" "Comptes" "Comptes système" "WARN" "medium" \
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
        add_result "SSH-001" "SSH" "Installation SSH" "PASS" "info" \
            "SSH n'est pas installé sur ce système" \
            "" "ANSSI R13"
        return
    fi
    
    # R13: Authentification root SSH
    log_info "Vérification de l'authentification root SSH..."
    
    local permit_root=$(grep -E "^PermitRootLogin" "$sshd_config" 2>/dev/null | awk '{print $2}' || echo "yes")
    
    if [[ "$permit_root" == "no" ]]; then
        log_success "Connexion root SSH désactivée"
        add_result "SSH-001" "SSH" "Connexion root" "PASS" "critical" \
            "PermitRootLogin est défini sur 'no'" \
            "" "ANSSI R13"
    elif [[ "$permit_root" == "prohibit-password" || "$permit_root" == "without-password" ]]; then
        log_success "Connexion root SSH par mot de passe désactivée"
        add_result "SSH-001" "SSH" "Connexion root" "PASS" "critical" \
            "PermitRootLogin = $permit_root (clés uniquement)" \
            "" "ANSSI R13"
    else
        log_error "Connexion root SSH autorisée"
        add_result "SSH-001" "SSH" "Connexion root" "FAIL" "critical" \
            "PermitRootLogin = $permit_root" \
            "Ajouter 'PermitRootLogin no' dans $sshd_config" "ANSSI R13"
    fi
    
    # R14: Authentification par mot de passe SSH
    log_info "Vérification de l'authentification par mot de passe SSH..."
    
    local pass_auth=$(grep -E "^PasswordAuthentication" "$sshd_config" 2>/dev/null | awk '{print $2}' || echo "yes")
    
    if [[ "$pass_auth" == "no" ]]; then
        log_success "Authentification SSH par mot de passe désactivée"
        add_result "SSH-002" "SSH" "Auth mot de passe" "PASS" "high" \
            "PasswordAuthentication = no (clés uniquement)" \
            "" "ANSSI R14"
    else
        log_warning "Authentification SSH par mot de passe activée"
        add_result "SSH-002" "SSH" "Auth mot de passe" "WARN" "high" \
            "PasswordAuthentication = $pass_auth" \
            "Préférer l'authentification par clés: PasswordAuthentication no" "ANSSI R14"
    fi
    
    # R15: Protocole SSH version 2
    log_info "Vérification du protocole SSH..."
    
    local ssh_proto=$(grep -E "^Protocol" "$sshd_config" 2>/dev/null | awk '{print $2}' || echo "2")
    
    if [[ "$ssh_proto" == "2" || -z "$ssh_proto" ]]; then
        log_success "Protocole SSH version 2 uniquement"
        add_result "SSH-003" "SSH" "Protocole SSH" "PASS" "critical" \
            "SSH utilise uniquement le protocole version 2" \
            "" "ANSSI R15"
    else
        log_error "Protocole SSH v1 potentiellement activé"
        add_result "SSH-003" "SSH" "Protocole SSH" "FAIL" "critical" \
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
        add_result "SSH-004" "SSH" "Algorithmes SSH" "PASS" "high" \
            "Aucun algorithme faible détecté" \
            "" "ANSSI R16"
    else
        log_error "Algorithmes SSH faibles détectés: ${weak_found[*]}"
        add_result "SSH-004" "SSH" "Algorithmes SSH" "FAIL" "high" \
            "Algorithmes faibles: ${weak_found[*]}" \
            "Supprimer les algorithmes faibles et utiliser: chacha20-poly1305,aes256-gcm" "ANSSI R16"
    fi
    
    # R17: X11 Forwarding
    log_info "Vérification X11 Forwarding..."
    
    local x11_forward=$(grep -E "^X11Forwarding" "$sshd_config" 2>/dev/null | awk '{print $2}' || echo "yes")
    
    if [[ "$x11_forward" == "no" ]]; then
        log_success "X11 Forwarding désactivé"
        add_result "SSH-005" "SSH" "X11 Forwarding" "PASS" "medium" \
            "X11Forwarding = no" \
            "" "ANSSI R17"
    else
        log_warning "X11 Forwarding activé"
        add_result "SSH-005" "SSH" "X11 Forwarding" "WARN" "medium" \
            "X11Forwarding = $x11_forward" \
            "Désactiver si non nécessaire: X11Forwarding no" "ANSSI R17"
    fi
    
    # R18: AllowUsers/AllowGroups
    log_info "Vérification des restrictions d'accès SSH..."
    
    local allow_users=$(grep -E "^AllowUsers|^AllowGroups" "$sshd_config" 2>/dev/null || echo "")
    
    if [[ -n "$allow_users" ]]; then
        log_success "Restrictions d'accès SSH configurées"
        add_result "SSH-006" "SSH" "Restrictions accès" "PASS" "high" \
            "AllowUsers ou AllowGroups configuré" \
            "" "ANSSI R18"
    else
        log_warning "Pas de restrictions d'accès SSH spécifiques"
        add_result "SSH-006" "SSH" "Restrictions accès" "WARN" "high" \
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
        add_result "NET-001" "Réseau" "IP Forwarding" "PASS" "high" \
            "net.ipv4.ip_forward = 0" \
            "" "ANSSI R19"
    else
        log_warning "IP Forwarding activé"
        add_result "NET-001" "Réseau" "IP Forwarding" "WARN" "high" \
            "net.ipv4.ip_forward = 1" \
            "Désactiver si ce n'est pas un routeur: sysctl -w net.ipv4.ip_forward=0" "ANSSI R19"
    fi
    
    # R20: Source Routing
    log_info "Vérification du Source Routing..."
    
    local accept_source=$(cat /proc/sys/net/ipv4/conf/all/accept_source_route 2>/dev/null || echo "1")
    
    if [[ "$accept_source" -eq 0 ]]; then
        log_success "Source Routing désactivé"
        add_result "NET-002" "Réseau" "Source Routing" "PASS" "high" \
            "accept_source_route = 0" \
            "" "ANSSI R20"
    else
        log_error "Source Routing activé"
        add_result "NET-002" "Réseau" "Source Routing" "FAIL" "high" \
            "accept_source_route = 1" \
            "sysctl -w net.ipv4.conf.all.accept_source_route=0" "ANSSI R20"
    fi
    
    # R21: ICMP Redirects
    log_info "Vérification des ICMP Redirects..."
    
    local accept_redirects=$(cat /proc/sys/net/ipv4/conf/all/accept_redirects 2>/dev/null || echo "1")
    
    if [[ "$accept_redirects" -eq 0 ]]; then
        log_success "ICMP Redirects désactivés"
        add_result "NET-003" "Réseau" "ICMP Redirects" "PASS" "medium" \
            "accept_redirects = 0" \
            "" "ANSSI R21"
    else
        log_warning "ICMP Redirects activés"
        add_result "NET-003" "Réseau" "ICMP Redirects" "WARN" "medium" \
            "accept_redirects = 1" \
            "sysctl -w net.ipv4.conf.all.accept_redirects=0" "ANSSI R21"
    fi
    
    # R22: SYN Cookies
    log_info "Vérification des SYN Cookies..."
    
    local syn_cookies=$(cat /proc/sys/net/ipv4/tcp_syncookies 2>/dev/null || echo "0")
    
    if [[ "$syn_cookies" -eq 1 ]]; then
        log_success "SYN Cookies activés"
        add_result "NET-004" "Réseau" "SYN Cookies" "PASS" "high" \
            "tcp_syncookies = 1" \
            "" "ANSSI R22"
    else
        log_error "SYN Cookies désactivés"
        add_result "NET-004" "Réseau" "SYN Cookies" "FAIL" "high" \
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
        add_result "NET-005" "Réseau" "Pare-feu" "PASS" "critical" \
            "Pare-feu $firewall_name actif et configuré" \
            "" "ANSSI R23"
    else
        log_error "Aucun pare-feu actif détecté"
        add_result "NET-005" "Réseau" "Pare-feu" "FAIL" "critical" \
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
        add_result "NET-006" "Réseau" "Ports dangereux" "PASS" "high" \
            "$listening_ports ports en écoute, aucun service dangereux" \
            "" "ANSSI R24"
    else
        log_error "Ports dangereux détectés: ${dangerous_ports[*]}"
        add_result "NET-006" "Réseau" "Ports dangereux" "FAIL" "high" \
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
        add_result "FS-001" "Fichiers" "Fichiers auth" "PASS" "critical" \
            "Les fichiers /etc/passwd, shadow, gshadow ont des permissions correctes" \
            "" "ANSSI R25"
    else
        log_error "Permissions incorrectes: ${perm_issues[*]}"
        add_result "FS-001" "Fichiers" "Fichiers auth" "FAIL" "critical" \
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
        add_result "FS-002" "Fichiers" "Fichiers SUID/SGID" "PASS" "high" \
            "$suid_count fichiers SUID/SGID détectés" \
            "" "ANSSI R26"
    else
        log_warning "$suid_count fichiers SUID/SGID détectés"
        add_result "FS-002" "Fichiers" "Fichiers SUID/SGID" "WARN" "high" \
            "$suid_count fichiers SUID/SGID, vérifier les inhabituels" \
            "Auditer et supprimer les bits SUID/SGID non nécessaires" "ANSSI R26"
    fi
    
    # R27: Fichiers world-writable
    log_info "Recherche des fichiers world-writable..."
    
    local world_writable=$(find / -xdev -type f -perm -0002 2>/dev/null | head -20 | wc -l)
    
    if [[ "$world_writable" -eq 0 ]]; then
        log_success "Aucun fichier world-writable détecté"
        add_result "FS-003" "Fichiers" "World-writable" "PASS" "high" \
            "Aucun fichier accessible en écriture à tous" \
            "" "ANSSI R27"
    else
        log_error "$world_writable fichiers world-writable détectés"
        add_result "FS-003" "Fichiers" "World-writable" "FAIL" "high" \
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
        add_result "FS-004" "Fichiers" "Sticky bit" "PASS" "medium" \
            "/tmp et /var/tmp ont le sticky bit" \
            "" "ANSSI R28"
    else
        log_error "Sticky bit manquant: ${sticky_issues[*]}"
        add_result "FS-004" "Fichiers" "Sticky bit" "FAIL" "medium" \
            "Sticky bit manquant sur: ${sticky_issues[*]}" \
            "chmod +t /tmp /var/tmp" "ANSSI R28"
    fi
    
    # R29: umask
    log_info "Vérification du umask par défaut..."
    
    local umask_value=$(umask)
    
    if [[ "$umask_value" == "0027" || "$umask_value" == "027" || "$umask_value" == "0077" || "$umask_value" == "077" ]]; then
        log_success "umask restrictif: $umask_value"
        add_result "FS-005" "Fichiers" "umask" "PASS" "medium" \
            "umask = $umask_value (restrictif)" \
            "" "ANSSI R29"
    else
        log_warning "umask permissif: $umask_value"
        add_result "FS-005" "Fichiers" "umask" "WARN" "medium" \
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
        add_result "SVC-001" "Services" "Services risqués" "PASS" "medium" \
            "Pas de services non essentiels détectés" \
            "" "ANSSI R30"
    else
        log_warning "Services potentiellement inutiles: ${active_risky[*]}"
        add_result "SVC-001" "Services" "Services risqués" "WARN" "medium" \
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
        add_result "SVC-002" "Services" "Synchronisation NTP" "PASS" "medium" \
            "Le système est synchronisé avec un serveur NTP" \
            "" "ANSSI R31"
    else
        log_warning "Synchronisation NTP non active"
        add_result "SVC-002" "Services" "Synchronisation NTP" "WARN" "medium" \
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
        add_result "SVC-003" "Services" "Restrictions cron" "PASS" "medium" \
            "cron.allow ou cron.deny configuré" \
            "" "ANSSI R32"
    else
        log_warning "Pas de restrictions cron"
        add_result "SVC-003" "Services" "Restrictions cron" "WARN" "medium" \
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
# Génération du rapport
#===============================================================================

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
    
    # Construction du JSON
    local system_info=$(cat <<EOF
{
    "hostname": "$(hostname)",
    "os": "$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo 'Unknown')",
    "kernel": "$(uname -r)",
    "architecture": "$(uname -m)",
    "audit_date": "$(date -Iseconds)",
    "script_version": "$VERSION"
}
EOF
)
    
    local summary=$(cat <<EOF
{
    "total_checks": $TOTAL_CHECKS,
    "passed": $PASSED_CHECKS,
    "warnings": $WARNING_CHECKS,
    "failed": $FAILED_CHECKS,
    "score": $score,
    "grade": "$grade"
}
EOF
)
    
    # Assembler les résultats
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
    
    # Rapport final
    local report=$(cat <<EOF
{
    "report_type": "linux_security_audit",
    "framework": "ANSSI",
    "system_info": $system_info,
    "summary": $summary,
    "results": $results_json
}
EOF
)
    
    echo "$report" > "$OUTPUT_FILE"
    
    echo ""
    echo "Rapport généré: $OUTPUT_FILE"
    echo ""
    
    if [[ $FAILED_CHECKS -gt 0 ]]; then
        echo -e "${RED}[ATTENTION]${NC} $FAILED_CHECKS contrôles critiques nécessitent une action immédiate."
    fi
    
    if [[ $WARNING_CHECKS -gt 0 ]]; then
        echo -e "${YELLOW}[INFO]${NC} $WARNING_CHECKS points d'amélioration identifiés."
    fi
    
    echo ""
    echo "Pour générer un rapport PDF/HTML, utilisez les outils InfraGuard Security."
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
    
    echo "Démarrage de l'audit de sécurité..."
    echo "Fichier de sortie: $OUTPUT_FILE"
    echo ""
    
    # Exécution des audits
    audit_system_config
    audit_accounts
    audit_ssh
    audit_network
    audit_filesystem
    audit_services
    audit_logging
    audit_security_tools
    
    # Génération du rapport
    generate_report
}

# Exécution
main "$@"
