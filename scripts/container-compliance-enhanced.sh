#!/bin/bash
#===============================================================================
# Container & Orchestration Compliance Toolkit - Enhanced
# Version: 1.0.0
# Standards: CIS Docker Benchmark 1.6 + CIS Kubernetes Benchmark 1.8 (Level 1+2)
# Compatibilité: Docker 20.10+, Podman 4.0+, Kubernetes 1.25+
#===============================================================================

set -euo pipefail

VERSION="1.0.0"
SCRIPT_NAME="Container Compliance Enhanced"
OUTPUT_FILE="${1:-container-compliance-enhanced-$(date +%Y%m%d_%H%M%S).json}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Résultats
declare -a RESULTS=()
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

#===============================================================================
# Fonctions utilitaires
#===============================================================================

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║   Container & Orchestration Compliance Toolkit - Enhanced         ║"
    echo "║                      Version $VERSION                               ║"
    echo "║        CIS Docker & Kubernetes Benchmark Level 1 + 2              ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

write_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS_COUNT++)); }
write_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL_COUNT++)); }
write_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; ((WARN_COUNT++)); }
write_info() { echo -e "${BLUE}[INFO]${NC} $1"; }

add_result() {
    local id="$1"
    local category="$2"
    local title="$3"
    local status="$4"
    local severity="$5"
    local description="$6"
    local remediation="${7:-}"
    local reference="${8:-}"
    
    RESULTS+=("{\"id\":\"$id\",\"category\":\"$category\",\"title\":\"$title\",\"status\":\"$status\",\"severity\":\"$severity\",\"description\":\"$description\",\"remediation\":\"$remediation\",\"reference\":\"$reference\"}")
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}Ce script doit être exécuté en tant que root${NC}"
        exit 1
    fi
}

detect_container_runtime() {
    DOCKER_AVAILABLE=false
    PODMAN_AVAILABLE=false
    KUBERNETES_AVAILABLE=false
    CONTAINERD_AVAILABLE=false
    CONTAINER_CMD=""
    CONTAINER_RUNTIME=""
    
    if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
        DOCKER_AVAILABLE=true
        CONTAINER_CMD="docker"
        CONTAINER_RUNTIME="docker"
        write_info "Docker détecté"
    fi
    
    if command -v podman &>/dev/null && podman info &>/dev/null 2>&1; then
        PODMAN_AVAILABLE=true
        if [[ -z "$CONTAINER_CMD" ]]; then
            CONTAINER_CMD="podman"
            CONTAINER_RUNTIME="podman"
        fi
        write_info "Podman détecté"
    fi
    
    if command -v kubectl &>/dev/null && kubectl cluster-info &>/dev/null 2>&1; then
        KUBERNETES_AVAILABLE=true
        write_info "Kubernetes détecté"
    fi
    
    if command -v oc &>/dev/null && oc whoami &>/dev/null 2>&1; then
        OPENSHIFT_AVAILABLE=true
        write_info "OpenShift détecté"
    else
        OPENSHIFT_AVAILABLE=false
    fi
    
    if command -v ctr &>/dev/null || [[ -S /run/containerd/containerd.sock ]]; then
        CONTAINERD_AVAILABLE=true
        write_info "Containerd détecté"
    fi
    
    if [[ -z "$CONTAINER_CMD" ]] && ! $KUBERNETES_AVAILABLE; then
        write_warn "Aucun runtime de conteneur détecté"
    else
        write_info "Runtime principal: $CONTAINER_RUNTIME"
    fi
}

container_exec() {
    if [[ -n "$CONTAINER_CMD" ]]; then
        $CONTAINER_CMD "$@" 2>/dev/null
    else
        return 1
    fi
}

container_available() {
    [[ -n "$CONTAINER_CMD" ]]
}

#===============================================================================
# Docker Host Configuration (CIS Section 1) - Level 1+2
#===============================================================================

check_docker_host_configuration() {
    if ! container_available; then return; fi
    
    echo -e "\n${CYAN}=== Docker Host Configuration (CIS Section 1) ===${NC}\n"
    
    # 1.1.1 - Partition séparée pour /var/lib/docker
    write_info "Vérification partition Docker..."
    if mount | grep -q "/var/lib/docker"; then
        write_pass "Partition séparée pour /var/lib/docker"
        add_result "CIS-DOCKER-1.1.1" "Docker-Host" "Partition Docker" "PASS" "medium" \
            "/var/lib/docker sur partition séparée" "" "CIS Docker 1.1.1"
    else
        write_warn "/var/lib/docker pas sur partition séparée"
        add_result "CIS-DOCKER-1.1.1" "Docker-Host" "Partition Docker" "WARN" "medium" \
            "/var/lib/docker partage la partition système" \
            "Créer une partition séparée pour /var/lib/docker" "CIS Docker 1.1.1"
    fi
    
    # 1.1.2 - Hardening du kernel Docker
    write_info "Vérification hardening kernel..."
    local kernel_params=("net.ipv4.conf.all.send_redirects" "net.ipv4.conf.default.send_redirects")
    local hardened=true
    for param in "${kernel_params[@]}"; do
        local val
        val=$(sysctl -n "$param" 2>/dev/null || echo "1")
        if [[ "$val" != "0" ]]; then
            hardened=false
        fi
    done
    
    if $hardened; then
        write_pass "Paramètres kernel sécurisés"
        add_result "CIS-DOCKER-1.1.2" "Docker-Host" "Kernel Hardening" "PASS" "high" \
            "Paramètres kernel conformes" "" "CIS Docker 1.1.2"
    else
        write_warn "Paramètres kernel à durcir"
        add_result "CIS-DOCKER-1.1.2" "Docker-Host" "Kernel Hardening" "WARN" "high" \
            "Paramètres kernel non optimaux" \
            "Désactiver send_redirects" "CIS Docker 1.1.2"
    fi
    
    # 1.1.3-1.1.18 - Audit rules
    local audit_paths=(
        "/usr/bin/docker:/usr/bin/docker"
        "/var/lib/docker:/var/lib/docker"
        "/etc/docker:/etc/docker"
        "/usr/bin/containerd:/usr/bin/containerd"
        "/usr/bin/runc:/usr/bin/runc"
    )
    
    for audit_path in "${audit_paths[@]}"; do
        local path name
        path="${audit_path%%:*}"
        name="${audit_path##*/}"
        
        write_info "Vérification audit $name..."
        if command -v auditctl &>/dev/null && auditctl -l 2>/dev/null | grep -q "$path"; then
            write_pass "Audit $name configuré"
            add_result "CIS-DOCKER-1.1-$name" "Docker-Host" "Audit $name" "PASS" "medium" \
                "Surveillance $name active" "" "CIS Docker 1.1.x"
        else
            write_warn "Audit $name non configuré"
            add_result "CIS-DOCKER-1.1-$name" "Docker-Host" "Audit $name" "WARN" "medium" \
                "$name non surveillé" \
                "Ajouter règle audit pour $path" "CIS Docker 1.1.x"
        fi
    done
}

#===============================================================================
# Docker Daemon Configuration (CIS Section 2) - Level 1+2
#===============================================================================

check_docker_daemon_configuration() {
    if ! container_available; then return; fi
    
    echo -e "\n${CYAN}=== Docker Daemon Configuration (CIS Section 2) ===${NC}\n"
    
    local docker_info
    docker_info=$(container_exec info 2>/dev/null)
    
    # 2.1 - Network traffic entre containers
    write_info "Vérification trafic inter-conteneurs..."
    if container_exec network inspect bridge 2>/dev/null | grep -q '"com.docker.network.bridge.enable_icc": "false"'; then
        write_pass "ICC désactivé sur bridge"
        add_result "CIS-DOCKER-2.1" "Docker-Daemon" "Inter-container Communication" "PASS" "high" \
            "Communication inter-conteneurs restreinte" "" "CIS Docker 2.1"
    else
        write_warn "ICC activé sur bridge par défaut"
        add_result "CIS-DOCKER-2.1" "Docker-Daemon" "Inter-container Communication" "WARN" "high" \
            "Les conteneurs peuvent communiquer entre eux" \
            "Désactiver ICC: --icc=false" "CIS Docker 2.1"
    fi
    
    # 2.2 - Logging level
    write_info "Vérification niveau de log..."
    if echo "$docker_info" | grep -qi "Logging Driver: json-file\|Logging Driver: syslog\|Logging Driver: journald"; then
        write_pass "Driver de logging configuré"
        add_result "CIS-DOCKER-2.2" "Docker-Daemon" "Logging Driver" "PASS" "medium" \
            "Logging configuré correctement" "" "CIS Docker 2.2"
    else
        write_warn "Logging driver à vérifier"
        add_result "CIS-DOCKER-2.2" "Docker-Daemon" "Logging Driver" "WARN" "medium" \
            "Driver de logging non standard" \
            "Configurer json-file, syslog ou journald" "CIS Docker 2.2"
    fi
    
    # 2.3 - Iptables
    write_info "Vérification iptables Docker..."
    if echo "$docker_info" | grep -q "iptables: true"; then
        write_pass "Docker gère iptables"
        add_result "CIS-DOCKER-2.3" "Docker-Daemon" "Docker iptables" "PASS" "high" \
            "Docker configure automatiquement iptables" "" "CIS Docker 2.3"
    else
        write_warn "Docker ne gère pas iptables"
        add_result "CIS-DOCKER-2.3" "Docker-Daemon" "Docker iptables" "WARN" "high" \
            "Configuration iptables manuelle requise" \
            "Activer --iptables=true" "CIS Docker 2.3"
    fi
    
    # 2.4 - Insecure registries
    write_info "Vérification registres non sécurisés..."
    if ! echo "$docker_info" | grep -qi "Insecure Registries:" || echo "$docker_info" | grep -A1 "Insecure Registries:" | grep -q "127.0.0.0/8"; then
        write_pass "Pas de registre insécure externe"
        add_result "CIS-DOCKER-2.4" "Docker-Daemon" "Insecure Registries" "PASS" "critical" \
            "Aucun registre non sécurisé configuré" "" "CIS Docker 2.4"
    else
        write_fail "Registres non sécurisés détectés"
        add_result "CIS-DOCKER-2.4" "Docker-Daemon" "Insecure Registries" "FAIL" "critical" \
            "Registres sans TLS configurés" \
            "Supprimer les registres insécures de la configuration" "CIS Docker 2.4"
    fi
    
    # 2.5 - aufs storage driver
    write_info "Vérification storage driver..."
    local storage_driver
    storage_driver=$(echo "$docker_info" | grep "Storage Driver:" | awk '{print $3}')
    if [[ "$storage_driver" != "aufs" ]]; then
        write_pass "Storage driver: $storage_driver (non-aufs)"
        add_result "CIS-DOCKER-2.5" "Docker-Daemon" "Storage Driver" "PASS" "medium" \
            "Driver $storage_driver utilisé" "" "CIS Docker 2.5"
    else
        write_fail "Storage driver aufs obsolète"
        add_result "CIS-DOCKER-2.5" "Docker-Daemon" "Storage Driver" "FAIL" "medium" \
            "AUFS est obsolète et non maintenu" \
            "Migrer vers overlay2" "CIS Docker 2.5"
    fi
    
    # 2.6 - TLS authentication
    write_info "Vérification TLS Docker..."
    if [[ -f /etc/docker/daemon.json ]] && grep -q '"tlsverify"' /etc/docker/daemon.json 2>/dev/null; then
        write_pass "TLS configuré pour Docker daemon"
        add_result "CIS-DOCKER-2.6" "Docker-Daemon" "TLS Authentication" "PASS" "critical" \
            "Authentification TLS activée" "" "CIS Docker 2.6"
    else
        write_warn "TLS non configuré pour Docker daemon"
        add_result "CIS-DOCKER-2.6" "Docker-Daemon" "TLS Authentication" "WARN" "critical" \
            "Docker daemon sans TLS" \
            "Configurer --tlsverify avec certificats" "CIS Docker 2.6"
    fi
    
    # 2.7 - Default ulimit
    write_info "Vérification ulimits par défaut..."
    if [[ -f /etc/docker/daemon.json ]] && grep -q '"default-ulimits"' /etc/docker/daemon.json 2>/dev/null; then
        write_pass "Ulimits par défaut configurés"
        add_result "CIS-DOCKER-2.7" "Docker-Daemon" "Default Ulimits" "PASS" "medium" \
            "Limites de ressources définies" "" "CIS Docker 2.7"
    else
        write_warn "Ulimits par défaut non configurés"
        add_result "CIS-DOCKER-2.7" "Docker-Daemon" "Default Ulimits" "WARN" "medium" \
            "Pas de limites par défaut" \
            "Configurer default-ulimits dans daemon.json" "CIS Docker 2.7"
    fi
    
    # 2.8 - User namespace
    write_info "Vérification user namespace..."
    if echo "$docker_info" | grep -qi "userns"; then
        write_pass "User namespace activé"
        add_result "CIS-DOCKER-2.8" "Docker-Daemon" "User Namespace" "PASS" "high" \
            "Isolation user namespace active" "" "CIS Docker 2.8"
    else
        write_warn "User namespace non activé"
        add_result "CIS-DOCKER-2.8" "Docker-Daemon" "User Namespace" "WARN" "high" \
            "Conteneurs exécutés en tant que root" \
            "Activer --userns-remap" "CIS Docker 2.8"
    fi
    
    # 2.9 - Default cgroup
    write_info "Vérification cgroup par défaut..."
    if echo "$docker_info" | grep -qi "Cgroup Driver: systemd"; then
        write_pass "Cgroup driver: systemd"
        add_result "CIS-DOCKER-2.9" "Docker-Daemon" "Cgroup Driver" "PASS" "medium" \
            "Utilisation du driver systemd" "" "CIS Docker 2.9"
    else
        write_warn "Cgroup driver non-systemd"
        add_result "CIS-DOCKER-2.9" "Docker-Daemon" "Cgroup Driver" "WARN" "medium" \
            "Driver cgroupfs utilisé" \
            "Configurer --exec-opt native.cgroupdriver=systemd" "CIS Docker 2.9"
    fi
    
    # 2.10 - Base device size (Level 2)
    write_info "Vérification taille device par défaut..."
    if [[ -f /etc/docker/daemon.json ]] && grep -q '"storage-opts"' /etc/docker/daemon.json 2>/dev/null; then
        write_pass "Options de stockage configurées"
        add_result "CIS-DOCKER-2.10" "Docker-Daemon" "Storage Options" "PASS" "low" \
            "Limites de stockage définies" "" "CIS Docker 2.10"
    else
        write_warn "Options de stockage par défaut"
        add_result "CIS-DOCKER-2.10" "Docker-Daemon" "Storage Options" "WARN" "low" \
            "Pas de limite de taille par conteneur" \
            "Configurer storage-opts avec dm.basesize" "CIS Docker 2.10"
    fi
    
    # 2.11 - Authorization plugin (Level 2)
    write_info "Vérification plugin d'autorisation..."
    if echo "$docker_info" | grep -qi "Authorization"; then
        write_pass "Plugin d'autorisation configuré"
        add_result "CIS-DOCKER-2.11" "Docker-Daemon" "Authorization Plugin" "PASS" "high" \
            "Contrôle d'accès granulaire actif" "" "CIS Docker 2.11"
    else
        write_warn "Pas de plugin d'autorisation"
        add_result "CIS-DOCKER-2.11" "Docker-Daemon" "Authorization Plugin" "WARN" "high" \
            "Pas de contrôle d'accès granulaire" \
            "Configurer un plugin d'autorisation" "CIS Docker 2.11"
    fi
    
    # 2.12 - Centralized logging (Level 2)
    write_info "Vérification logging centralisé..."
    if echo "$docker_info" | grep -qi "Logging Driver: syslog\|Logging Driver: splunk\|Logging Driver: fluentd"; then
        write_pass "Logging centralisé configuré"
        add_result "CIS-DOCKER-2.12" "Docker-Daemon" "Centralized Logging" "PASS" "medium" \
            "Logs envoyés vers système centralisé" "" "CIS Docker 2.12"
    else
        write_warn "Logging local uniquement"
        add_result "CIS-DOCKER-2.12" "Docker-Daemon" "Centralized Logging" "WARN" "medium" \
            "Logs stockés localement" \
            "Configurer syslog, splunk ou fluentd" "CIS Docker 2.12"
    fi
    
    # 2.13 - Live restore
    write_info "Vérification live restore..."
    if echo "$docker_info" | grep -qi "Live Restore Enabled: true"; then
        write_pass "Live restore activé"
        add_result "CIS-DOCKER-2.13" "Docker-Daemon" "Live Restore" "PASS" "medium" \
            "Conteneurs survivent au redémarrage du daemon" "" "CIS Docker 2.13"
    else
        write_warn "Live restore non activé"
        add_result "CIS-DOCKER-2.13" "Docker-Daemon" "Live Restore" "WARN" "medium" \
            "Conteneurs arrêtés si daemon redémarre" \
            "Activer --live-restore" "CIS Docker 2.13"
    fi
    
    # 2.14 - Userland proxy (Level 2)
    write_info "Vérification userland proxy..."
    if [[ -f /etc/docker/daemon.json ]] && grep -q '"userland-proxy": false' /etc/docker/daemon.json 2>/dev/null; then
        write_pass "Userland proxy désactivé"
        add_result "CIS-DOCKER-2.14" "Docker-Daemon" "Userland Proxy" "PASS" "medium" \
            "Hairpin NAT utilisé" "" "CIS Docker 2.14"
    else
        write_warn "Userland proxy activé"
        add_result "CIS-DOCKER-2.14" "Docker-Daemon" "Userland Proxy" "WARN" "medium" \
            "Proxy userland moins performant" \
            "Désactiver avec --userland-proxy=false" "CIS Docker 2.14"
    fi
    
    # 2.15 - Seccomp profile
    write_info "Vérification profil Seccomp..."
    if echo "$docker_info" | grep -qi "seccomp"; then
        write_pass "Seccomp supporté"
        add_result "CIS-DOCKER-2.15" "Docker-Daemon" "Seccomp Support" "PASS" "high" \
            "Profil Seccomp par défaut actif" "" "CIS Docker 2.15"
    else
        write_fail "Seccomp non supporté"
        add_result "CIS-DOCKER-2.15" "Docker-Daemon" "Seccomp Support" "FAIL" "high" \
            "Filtrage syscall non disponible" \
            "Activer le support Seccomp dans le kernel" "CIS Docker 2.15"
    fi
    
    # 2.16 - Experimental features (Level 2)
    write_info "Vérification fonctionnalités expérimentales..."
    if echo "$docker_info" | grep -qi "Experimental: false"; then
        write_pass "Fonctionnalités expérimentales désactivées"
        add_result "CIS-DOCKER-2.16" "Docker-Daemon" "Experimental Features" "PASS" "low" \
            "Mode production" "" "CIS Docker 2.16"
    else
        write_warn "Fonctionnalités expérimentales activées"
        add_result "CIS-DOCKER-2.16" "Docker-Daemon" "Experimental Features" "WARN" "low" \
            "Mode expérimental actif" \
            "Désactiver experimental en production" "CIS Docker 2.16"
    fi
    
    # 2.17 - No new privileges (Level 2)
    write_info "Vérification no-new-privileges..."
    if [[ -f /etc/docker/daemon.json ]] && grep -q '"no-new-privileges"' /etc/docker/daemon.json 2>/dev/null; then
        write_pass "no-new-privileges configuré par défaut"
        add_result "CIS-DOCKER-2.17" "Docker-Daemon" "No New Privileges" "PASS" "high" \
            "Élévation de privilèges bloquée" "" "CIS Docker 2.17"
    else
        write_warn "no-new-privileges non configuré par défaut"
        add_result "CIS-DOCKER-2.17" "Docker-Daemon" "No New Privileges" "WARN" "high" \
            "Conteneurs peuvent élever leurs privilèges" \
            "Ajouter no-new-privileges: true" "CIS Docker 2.17"
    fi
}

#===============================================================================
# Docker Daemon Files (CIS Section 3) - Level 1+2
#===============================================================================

check_docker_daemon_files() {
    if ! container_available; then return; fi
    
    echo -e "\n${CYAN}=== Docker Daemon Files (CIS Section 3) ===${NC}\n"
    
    # Check file permissions and ownership
    local files_to_check=(
        "/usr/lib/systemd/system/docker.service:644:root:root"
        "/usr/lib/systemd/system/docker.socket:644:root:root"
        "/etc/docker:755:root:root"
        "/var/run/docker.sock:660:root:docker"
        "/etc/docker/daemon.json:644:root:root"
        "/etc/docker/certs.d:444:root:root"
        "/var/lib/docker:710:root:root"
    )
    
    for file_spec in "${files_to_check[@]}"; do
        IFS=':' read -r path expected_perm expected_user expected_group <<< "$file_spec"
        
        if [[ ! -e "$path" ]]; then
            continue
        fi
        
        local name
        name=$(basename "$path")
        write_info "Vérification $name..."
        
        local actual_perm actual_owner
        actual_perm=$(stat -c "%a" "$path" 2>/dev/null)
        actual_owner=$(stat -c "%U:%G" "$path" 2>/dev/null)
        
        # Check permissions
        if [[ "$actual_perm" -le "$expected_perm" ]]; then
            write_pass "$name permissions: $actual_perm"
            add_result "CIS-DOCKER-3-$name-perm" "Docker-Files" "$name Permissions" "PASS" "high" \
                "Permissions correctes: $actual_perm" "" "CIS Docker 3.x"
        else
            write_fail "$name trop permissif: $actual_perm"
            add_result "CIS-DOCKER-3-$name-perm" "Docker-Files" "$name Permissions" "FAIL" "high" \
                "Permissions trop larges: $actual_perm" \
                "chmod $expected_perm $path" "CIS Docker 3.x"
        fi
        
        # Check ownership
        if [[ "$actual_owner" == "$expected_user:$expected_group" ]] || [[ "$actual_owner" == "root:root" ]]; then
            write_pass "$name propriétaire: $actual_owner"
            add_result "CIS-DOCKER-3-$name-own" "Docker-Files" "$name Ownership" "PASS" "high" \
                "Propriétaire correct: $actual_owner" "" "CIS Docker 3.x"
        else
            write_fail "$name mauvais propriétaire: $actual_owner"
            add_result "CIS-DOCKER-3-$name-own" "Docker-Files" "$name Ownership" "FAIL" "high" \
                "Propriétaire incorrect: $actual_owner" \
                "chown $expected_user:$expected_group $path" "CIS Docker 3.x"
        fi
    done
    
    # 3.7 - TLS certificates (Level 2)
    write_info "Vérification certificats TLS..."
    if [[ -d /etc/docker/certs.d ]]; then
        local cert_count
        cert_count=$(find /etc/docker/certs.d -name "*.crt" -o -name "*.pem" 2>/dev/null | wc -l)
        if [[ $cert_count -gt 0 ]]; then
            write_pass "Certificats TLS présents: $cert_count"
            add_result "CIS-DOCKER-3.7" "Docker-Files" "TLS Certificates" "PASS" "critical" \
                "$cert_count certificats configurés" "" "CIS Docker 3.7"
        else
            write_warn "Aucun certificat TLS trouvé"
            add_result "CIS-DOCKER-3.7" "Docker-Files" "TLS Certificates" "WARN" "critical" \
                "Certificats TLS manquants" \
                "Configurer les certificats dans /etc/docker/certs.d" "CIS Docker 3.7"
        fi
    fi
}

#===============================================================================
# Container Images (CIS Section 4) - Level 1+2
#===============================================================================

check_container_images() {
    if ! container_available; then return; fi
    
    echo -e "\n${CYAN}=== Container Images (CIS Section 4) ===${NC}\n"
    
    # 4.1 - Conteneurs utilisent user non-root
    write_info "Vérification utilisateurs conteneurs..."
    local root_containers=0
    local total_containers=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total_containers++))
            local user
            user=$(container_exec inspect --format '{{.Config.User}}' "$container_id" 2>/dev/null)
            if [[ -z "$user" || "$user" == "root" || "$user" == "0" ]]; then
                ((root_containers++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total_containers -eq 0 ]]; then
        add_result "CIS-DOCKER-4.1" "Container-Images" "Non-root Users" "PASS" "high" \
            "Aucun conteneur actif" "" "CIS Docker 4.1"
    elif [[ $root_containers -eq 0 ]]; then
        write_pass "Tous les conteneurs utilisent un user non-root"
        add_result "CIS-DOCKER-4.1" "Container-Images" "Non-root Users" "PASS" "high" \
            "0/$total_containers conteneurs en root" "" "CIS Docker 4.1"
    else
        write_warn "$root_containers/$total_containers conteneurs en root"
        add_result "CIS-DOCKER-4.1" "Container-Images" "Non-root Users" "WARN" "high" \
            "$root_containers conteneurs exécutés en root" \
            "Configurer USER dans les Dockerfiles" "CIS Docker 4.1"
    fi
    
    # 4.2 - Content trust
    write_info "Vérification content trust..."
    if [[ "${DOCKER_CONTENT_TRUST:-0}" == "1" ]]; then
        write_pass "Docker Content Trust activé"
        add_result "CIS-DOCKER-4.2" "Container-Images" "Content Trust" "PASS" "high" \
            "Signature des images activée" "" "CIS Docker 4.2"
    else
        write_warn "Docker Content Trust non activé"
        add_result "CIS-DOCKER-4.2" "Container-Images" "Content Trust" "WARN" "high" \
            "Images non signées acceptées" \
            "export DOCKER_CONTENT_TRUST=1" "CIS Docker 4.2"
    fi
    
    # 4.3 - HEALTHCHECK
    write_info "Vérification HEALTHCHECK..."
    local no_healthcheck=0
    total_containers=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total_containers++))
            local healthcheck
            healthcheck=$(container_exec inspect --format '{{.Config.Healthcheck}}' "$container_id" 2>/dev/null)
            if [[ -z "$healthcheck" || "$healthcheck" == "<nil>" ]]; then
                ((no_healthcheck++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total_containers -gt 0 && $no_healthcheck -gt 0 ]]; then
        write_warn "$no_healthcheck/$total_containers sans HEALTHCHECK"
        add_result "CIS-DOCKER-4.3" "Container-Images" "HEALTHCHECK" "WARN" "medium" \
            "$no_healthcheck conteneurs sans surveillance santé" \
            "Ajouter HEALTHCHECK dans les Dockerfiles" "CIS Docker 4.3"
    else
        add_result "CIS-DOCKER-4.3" "Container-Images" "HEALTHCHECK" "PASS" "medium" \
            "Tous les conteneurs surveillés" "" "CIS Docker 4.3"
    fi
    
    # 4.4 - Docker image scan (Level 2)
    write_info "Vérification scan images..."
    if command -v trivy &>/dev/null || command -v grype &>/dev/null || command -v snyk &>/dev/null; then
        write_pass "Outil de scan d'images disponible"
        add_result "CIS-DOCKER-4.4" "Container-Images" "Image Scanning" "PASS" "high" \
            "Scanner de vulnérabilités installé" "" "CIS Docker 4.4"
    else
        write_warn "Aucun scanner d'images détecté"
        add_result "CIS-DOCKER-4.4" "Container-Images" "Image Scanning" "WARN" "high" \
            "Pas de scanner de vulnérabilités" \
            "Installer trivy, grype ou snyk" "CIS Docker 4.4"
    fi
    
    # 4.5 - Setuid/Setgid in images (Level 2)
    write_info "Vérification setuid/setgid dans images..."
    local setuid_found=0
    while IFS= read -r image_id; do
        if [[ -n "$image_id" ]]; then
            local setuid_count
            setuid_count=$(docker run --rm --entrypoint="" "$image_id" find / -perm /6000 -type f 2>/dev/null | wc -l || echo "0")
            if [[ $setuid_count -gt 10 ]]; then
                ((setuid_found++))
            fi
        fi
    done < <(container_exec images -q 2>/dev/null | head -5)
    
    if [[ $setuid_found -eq 0 ]]; then
        write_pass "Pas de binaires setuid/setgid excessifs"
        add_result "CIS-DOCKER-4.5" "Container-Images" "Setuid/Setgid" "PASS" "medium" \
            "Binaires privilégiés minimisés" "" "CIS Docker 4.5"
    else
        write_warn "$setuid_found images avec setuid/setgid"
        add_result "CIS-DOCKER-4.5" "Container-Images" "Setuid/Setgid" "WARN" "medium" \
            "Images avec binaires privilégiés" \
            "Réduire les binaires setuid/setgid" "CIS Docker 4.5"
    fi
    
    # 4.6 - Copy instead of ADD (Level 2)
    write_info "Note: Vérifier utilisation COPY vs ADD dans Dockerfiles"
    add_result "CIS-DOCKER-4.6" "Container-Images" "COPY vs ADD" "WARN" "low" \
        "Vérification manuelle requise" \
        "Préférer COPY à ADD dans les Dockerfiles" "CIS Docker 4.6"
    
    # 4.7 - Trusted base images (Level 2)
    write_info "Vérification images officielles..."
    local unofficial=0
    while IFS= read -r repo; do
        if [[ -n "$repo" && ! "$repo" =~ ^(docker\.io/)?library/ && ! "$repo" =~ ^gcr\.io/ && ! "$repo" =~ ^registry\.k8s\.io/ ]]; then
            ((unofficial++))
        fi
    done < <(container_exec images --format '{{.Repository}}' 2>/dev/null | head -20)
    
    if [[ $unofficial -lt 5 ]]; then
        write_pass "Majorité d'images officielles/vérifiées"
        add_result "CIS-DOCKER-4.7" "Container-Images" "Trusted Images" "PASS" "high" \
            "Images de sources fiables" "" "CIS Docker 4.7"
    else
        write_warn "$unofficial images non officielles"
        add_result "CIS-DOCKER-4.7" "Container-Images" "Trusted Images" "WARN" "high" \
            "Images de sources non vérifiées" \
            "Utiliser des images officielles" "CIS Docker 4.7"
    fi
    
    # 4.8 - Package installation in images (Level 2)
    write_info "Note: Vérifier installation minimale de packages"
    add_result "CIS-DOCKER-4.8" "Container-Images" "Minimal Packages" "WARN" "medium" \
        "Vérification manuelle requise" \
        "Minimiser les packages dans les images" "CIS Docker 4.8"
    
    # 4.9 - Latest tag (Level 2)
    write_info "Vérification utilisation tag latest..."
    local latest_count=0
    while IFS= read -r tag; do
        if [[ "$tag" == "latest" ]]; then
            ((latest_count++))
        fi
    done < <(container_exec images --format '{{.Tag}}' 2>/dev/null)
    
    if [[ $latest_count -lt 3 ]]; then
        write_pass "Peu d'images avec tag latest"
        add_result "CIS-DOCKER-4.9" "Container-Images" "Latest Tag" "PASS" "medium" \
            "Tags explicites utilisés" "" "CIS Docker 4.9"
    else
        write_warn "$latest_count images avec tag latest"
        add_result "CIS-DOCKER-4.9" "Container-Images" "Latest Tag" "WARN" "medium" \
            "Tag latest non recommandé en production" \
            "Utiliser des tags de version explicites" "CIS Docker 4.9"
    fi
}

#===============================================================================
# Container Runtime (CIS Section 5) - Level 1+2
#===============================================================================

check_container_runtime() {
    if ! container_available; then return; fi
    
    echo -e "\n${CYAN}=== Container Runtime (CIS Section 5) ===${NC}\n"
    
    local total=0
    
    # Count running containers
    while IFS= read -r container_id; do
        [[ -n "$container_id" ]] && ((total++))
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total -eq 0 ]]; then
        write_info "Aucun conteneur en cours d'exécution"
        add_result "CIS-DOCKER-5.0" "Container-Runtime" "Running Containers" "PASS" "low" \
            "Aucun conteneur actif à vérifier" "" "CIS Docker 5.x"
        return
    fi
    
    # 5.1 - AppArmor
    write_info "Vérification profils AppArmor..."
    local no_apparmor=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local apparmor
            apparmor=$(container_exec inspect --format '{{.AppArmorProfile}}' "$container_id" 2>/dev/null)
            if [[ -z "$apparmor" || "$apparmor" == "unconfined" ]]; then
                ((no_apparmor++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $no_apparmor -eq 0 ]]; then
        write_pass "Tous les conteneurs ont AppArmor"
        add_result "CIS-DOCKER-5.1" "Container-Runtime" "AppArmor Profile" "PASS" "high" \
            "Profils AppArmor actifs" "" "CIS Docker 5.1"
    else
        write_warn "$no_apparmor/$total conteneurs sans AppArmor"
        add_result "CIS-DOCKER-5.1" "Container-Runtime" "AppArmor Profile" "WARN" "high" \
            "Conteneurs sans confinement AppArmor" \
            "Activer --security-opt apparmor=docker-default" "CIS Docker 5.1"
    fi
    
    # 5.2 - SELinux
    write_info "Vérification SELinux..."
    if command -v getenforce &>/dev/null && [[ "$(getenforce 2>/dev/null)" == "Enforcing" ]]; then
        write_pass "SELinux en mode Enforcing"
        add_result "CIS-DOCKER-5.2" "Container-Runtime" "SELinux" "PASS" "high" \
            "SELinux actif et enforce" "" "CIS Docker 5.2"
    elif command -v getenforce &>/dev/null; then
        write_warn "SELinux non enforcing"
        add_result "CIS-DOCKER-5.2" "Container-Runtime" "SELinux" "WARN" "high" \
            "SELinux disponible mais pas en enforcing" \
            "setenforce 1" "CIS Docker 5.2"
    else
        add_result "CIS-DOCKER-5.2" "Container-Runtime" "SELinux" "PASS" "high" \
            "SELinux non applicable sur ce système" "" "CIS Docker 5.2"
    fi
    
    # 5.3 - Capabilities
    write_info "Vérification capabilities..."
    local elevated_caps=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local caps
            caps=$(container_exec inspect --format '{{.HostConfig.CapAdd}}' "$container_id" 2>/dev/null)
            if [[ -n "$caps" && "$caps" != "[]" && "$caps" != "<nil>" ]]; then
                ((elevated_caps++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $elevated_caps -eq 0 ]]; then
        write_pass "Aucun conteneur avec capabilities additionnelles"
        add_result "CIS-DOCKER-5.3" "Container-Runtime" "Linux Capabilities" "PASS" "high" \
            "Capabilities par défaut uniquement" "" "CIS Docker 5.3"
    else
        write_warn "$elevated_caps/$total conteneurs avec capabilities élevées"
        add_result "CIS-DOCKER-5.3" "Container-Runtime" "Linux Capabilities" "WARN" "high" \
            "Conteneurs avec privilèges étendus" \
            "Réviser les capabilities requises" "CIS Docker 5.3"
    fi
    
    # 5.4 - Privileged containers
    write_info "Vérification conteneurs privilégiés..."
    local privileged=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local priv
            priv=$(container_exec inspect --format '{{.HostConfig.Privileged}}' "$container_id" 2>/dev/null)
            if [[ "$priv" == "true" ]]; then
                ((privileged++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $privileged -eq 0 ]]; then
        write_pass "Aucun conteneur privilégié"
        add_result "CIS-DOCKER-5.4" "Container-Runtime" "Privileged Containers" "PASS" "critical" \
            "Mode privilégié non utilisé" "" "CIS Docker 5.4"
    else
        write_fail "$privileged conteneurs privilégiés détectés"
        add_result "CIS-DOCKER-5.4" "Container-Runtime" "Privileged Containers" "FAIL" "critical" \
            "$privileged conteneurs avec accès total à l'hôte" \
            "Éviter --privileged, utiliser capabilities spécifiques" "CIS Docker 5.4"
    fi
    
    # 5.5 - SSH in containers
    write_info "Vérification SSH dans conteneurs..."
    local ssh_found=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            if docker exec "$container_id" pgrep sshd &>/dev/null 2>&1; then
                ((ssh_found++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $ssh_found -eq 0 ]]; then
        write_pass "Aucun serveur SSH dans les conteneurs"
        add_result "CIS-DOCKER-5.5" "Container-Runtime" "SSH in Containers" "PASS" "high" \
            "SSH non présent" "" "CIS Docker 5.5"
    else
        write_fail "$ssh_found conteneurs avec SSH"
        add_result "CIS-DOCKER-5.5" "Container-Runtime" "SSH in Containers" "FAIL" "high" \
            "SSH détecté dans $ssh_found conteneurs" \
            "Utiliser docker exec au lieu de SSH" "CIS Docker 5.5"
    fi
    
    # 5.6 - Ports privilégiés
    write_info "Vérification ports privilégiés..."
    local priv_ports=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local ports
            ports=$(docker port "$container_id" 2>/dev/null | grep -oP ':\K[0-9]+' | head -5)
            for port in $ports; do
                if [[ $port -lt 1024 ]]; then
                    ((priv_ports++))
                    break
                fi
            done
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $priv_ports -eq 0 ]]; then
        write_pass "Aucun port privilégié mappé"
        add_result "CIS-DOCKER-5.6" "Container-Runtime" "Privileged Ports" "PASS" "medium" \
            "Ports > 1024 uniquement" "" "CIS Docker 5.6"
    else
        write_warn "$priv_ports conteneurs avec ports < 1024"
        add_result "CIS-DOCKER-5.6" "Container-Runtime" "Privileged Ports" "WARN" "medium" \
            "Ports privilégiés mappés" \
            "Utiliser des ports > 1024" "CIS Docker 5.6"
    fi
    
    # 5.7 - Host network mode
    write_info "Vérification mode réseau host..."
    local host_net=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local netmode
            netmode=$(container_exec inspect --format '{{.HostConfig.NetworkMode}}' "$container_id" 2>/dev/null)
            if [[ "$netmode" == "host" ]]; then
                ((host_net++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $host_net -eq 0 ]]; then
        write_pass "Aucun conteneur en mode host network"
        add_result "CIS-DOCKER-5.7" "Container-Runtime" "Host Network Mode" "PASS" "high" \
            "Isolation réseau maintenue" "" "CIS Docker 5.7"
    else
        write_fail "$host_net conteneurs en mode host network"
        add_result "CIS-DOCKER-5.7" "Container-Runtime" "Host Network Mode" "FAIL" "high" \
            "Conteneurs partageant le réseau hôte" \
            "Éviter --network=host" "CIS Docker 5.7"
    fi
    
    # 5.8 - Memory limits
    write_info "Vérification limites mémoire..."
    local no_mem_limit=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local mem
            mem=$(container_exec inspect --format '{{.HostConfig.Memory}}' "$container_id" 2>/dev/null)
            if [[ "$mem" == "0" ]]; then
                ((no_mem_limit++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $no_mem_limit -eq 0 ]]; then
        write_pass "Tous les conteneurs ont une limite mémoire"
        add_result "CIS-DOCKER-5.8" "Container-Runtime" "Memory Limits" "PASS" "medium" \
            "Limites mémoire configurées" "" "CIS Docker 5.8"
    else
        write_warn "$no_mem_limit/$total conteneurs sans limite mémoire"
        add_result "CIS-DOCKER-5.8" "Container-Runtime" "Memory Limits" "WARN" "medium" \
            "Conteneurs pouvant consommer toute la RAM" \
            "Configurer -m ou --memory" "CIS Docker 5.8"
    fi
    
    # 5.9 - CPU limits
    write_info "Vérification limites CPU..."
    local no_cpu_limit=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local cpu
            cpu=$(container_exec inspect --format '{{.HostConfig.NanoCpus}}' "$container_id" 2>/dev/null)
            if [[ "$cpu" == "0" ]]; then
                ((no_cpu_limit++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $no_cpu_limit -eq 0 ]]; then
        write_pass "Tous les conteneurs ont une limite CPU"
        add_result "CIS-DOCKER-5.9" "Container-Runtime" "CPU Limits" "PASS" "medium" \
            "Limites CPU configurées" "" "CIS Docker 5.9"
    else
        write_warn "$no_cpu_limit/$total conteneurs sans limite CPU"
        add_result "CIS-DOCKER-5.9" "Container-Runtime" "CPU Limits" "WARN" "medium" \
            "Conteneurs pouvant monopoliser le CPU" \
            "Configurer --cpus ou --cpu-shares" "CIS Docker 5.9"
    fi
    
    # 5.10 - Read-only root filesystem
    write_info "Vérification filesystem read-only..."
    local rw_root=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local readonly_fs
            readonly_fs=$(container_exec inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$container_id" 2>/dev/null)
            if [[ "$readonly_fs" != "true" ]]; then
                ((rw_root++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $rw_root -eq 0 ]]; then
        write_pass "Tous les conteneurs ont un FS root read-only"
        add_result "CIS-DOCKER-5.10" "Container-Runtime" "Read-only Root FS" "PASS" "medium" \
            "Filesystem immutable" "" "CIS Docker 5.10"
    else
        write_warn "$rw_root/$total conteneurs avec FS root en écriture"
        add_result "CIS-DOCKER-5.10" "Container-Runtime" "Read-only Root FS" "WARN" "medium" \
            "Filesystem modifiable" \
            "Utiliser --read-only" "CIS Docker 5.10"
    fi
    
    # 5.11 - Host IPC (Level 2)
    write_info "Vérification mode IPC host..."
    local host_ipc=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local ipcmode
            ipcmode=$(container_exec inspect --format '{{.HostConfig.IpcMode}}' "$container_id" 2>/dev/null)
            if [[ "$ipcmode" == "host" ]]; then
                ((host_ipc++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $host_ipc -eq 0 ]]; then
        write_pass "Aucun conteneur en mode IPC host"
        add_result "CIS-DOCKER-5.11" "Container-Runtime" "Host IPC Mode" "PASS" "high" \
            "Isolation IPC maintenue" "" "CIS Docker 5.11"
    else
        write_fail "$host_ipc conteneurs en mode IPC host"
        add_result "CIS-DOCKER-5.11" "Container-Runtime" "Host IPC Mode" "FAIL" "high" \
            "Conteneurs partageant IPC hôte" \
            "Éviter --ipc=host" "CIS Docker 5.11"
    fi
    
    # 5.12 - Host PID (Level 2)
    write_info "Vérification mode PID host..."
    local host_pid=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local pidmode
            pidmode=$(container_exec inspect --format '{{.HostConfig.PidMode}}' "$container_id" 2>/dev/null)
            if [[ "$pidmode" == "host" ]]; then
                ((host_pid++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $host_pid -eq 0 ]]; then
        write_pass "Aucun conteneur en mode PID host"
        add_result "CIS-DOCKER-5.12" "Container-Runtime" "Host PID Mode" "PASS" "high" \
            "Isolation PID maintenue" "" "CIS Docker 5.12"
    else
        write_fail "$host_pid conteneurs en mode PID host"
        add_result "CIS-DOCKER-5.12" "Container-Runtime" "Host PID Mode" "FAIL" "high" \
            "Conteneurs voyant processus hôte" \
            "Éviter --pid=host" "CIS Docker 5.12"
    fi
    
    # 5.13 - Host UTS (Level 2)
    write_info "Vérification mode UTS host..."
    local host_uts=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local utsmode
            utsmode=$(container_exec inspect --format '{{.HostConfig.UTSMode}}' "$container_id" 2>/dev/null)
            if [[ "$utsmode" == "host" ]]; then
                ((host_uts++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $host_uts -eq 0 ]]; then
        write_pass "Aucun conteneur en mode UTS host"
        add_result "CIS-DOCKER-5.13" "Container-Runtime" "Host UTS Mode" "PASS" "medium" \
            "Isolation UTS maintenue" "" "CIS Docker 5.13"
    else
        write_warn "$host_uts conteneurs en mode UTS host"
        add_result "CIS-DOCKER-5.13" "Container-Runtime" "Host UTS Mode" "WARN" "medium" \
            "Conteneurs partageant hostname hôte" \
            "Éviter --uts=host" "CIS Docker 5.13"
    fi
    
    # 5.14 - Seccomp profile (Level 2)
    write_info "Vérification profils Seccomp..."
    local no_seccomp=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local seccomp
            seccomp=$(container_exec inspect --format '{{.HostConfig.SecurityOpt}}' "$container_id" 2>/dev/null)
            if echo "$seccomp" | grep -q "seccomp=unconfined"; then
                ((no_seccomp++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $no_seccomp -eq 0 ]]; then
        write_pass "Tous les conteneurs ont Seccomp actif"
        add_result "CIS-DOCKER-5.14" "Container-Runtime" "Seccomp Profile" "PASS" "high" \
            "Profils Seccomp appliqués" "" "CIS Docker 5.14"
    else
        write_fail "$no_seccomp conteneurs sans Seccomp"
        add_result "CIS-DOCKER-5.14" "Container-Runtime" "Seccomp Profile" "FAIL" "high" \
            "Conteneurs sans filtrage syscall" \
            "Retirer seccomp=unconfined" "CIS Docker 5.14"
    fi
    
    # 5.15 - PIDs limit (Level 2)
    write_info "Vérification limite PIDs..."
    local no_pids_limit=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local pids_limit
            pids_limit=$(container_exec inspect --format '{{.HostConfig.PidsLimit}}' "$container_id" 2>/dev/null)
            if [[ "$pids_limit" == "0" || "$pids_limit" == "-1" || "$pids_limit" == "<nil>" ]]; then
                ((no_pids_limit++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $no_pids_limit -eq 0 ]]; then
        write_pass "Tous les conteneurs ont une limite PIDs"
        add_result "CIS-DOCKER-5.15" "Container-Runtime" "PIDs Limit" "PASS" "medium" \
            "Fork bomb protection active" "" "CIS Docker 5.15"
    else
        write_warn "$no_pids_limit/$total conteneurs sans limite PIDs"
        add_result "CIS-DOCKER-5.15" "Container-Runtime" "PIDs Limit" "WARN" "medium" \
            "Vulnérable aux fork bombs" \
            "Configurer --pids-limit" "CIS Docker 5.15"
    fi
    
    # 5.16 - Docker socket mount (Level 2)
    write_info "Vérification montage docker.sock..."
    local docker_sock_mounted=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local mounts
            mounts=$(container_exec inspect --format '{{range .Mounts}}{{.Source}} {{end}}' "$container_id" 2>/dev/null)
            if echo "$mounts" | grep -q "docker.sock"; then
                ((docker_sock_mounted++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $docker_sock_mounted -eq 0 ]]; then
        write_pass "Aucun conteneur n'a accès au socket Docker"
        add_result "CIS-DOCKER-5.16" "Container-Runtime" "Docker Socket Mount" "PASS" "critical" \
            "Socket Docker non exposé" "" "CIS Docker 5.16"
    else
        write_fail "$docker_sock_mounted conteneurs avec accès au socket Docker"
        add_result "CIS-DOCKER-5.16" "Container-Runtime" "Docker Socket Mount" "FAIL" "critical" \
            "Conteneurs peuvent contrôler Docker" \
            "Éviter le montage de docker.sock" "CIS Docker 5.16"
    fi
    
    # 5.17 - cgroup usage (Level 2)
    write_info "Vérification cgroup parent..."
    local custom_cgroup=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local cgroup
            cgroup=$(container_exec inspect --format '{{.HostConfig.CgroupParent}}' "$container_id" 2>/dev/null)
            if [[ -n "$cgroup" && "$cgroup" != "" ]]; then
                ((custom_cgroup++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    write_pass "Configuration cgroup vérifiée"
    add_result "CIS-DOCKER-5.17" "Container-Runtime" "Cgroup Parent" "PASS" "low" \
        "Cgroups configurés" "" "CIS Docker 5.17"
    
    # 5.18 - No new privileges (Level 2)
    write_info "Vérification no-new-privileges..."
    local allows_new_priv=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            local secopt
            secopt=$(container_exec inspect --format '{{.HostConfig.SecurityOpt}}' "$container_id" 2>/dev/null)
            if ! echo "$secopt" | grep -q "no-new-privileges"; then
                ((allows_new_priv++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $allows_new_priv -eq 0 ]]; then
        write_pass "Tous les conteneurs ont no-new-privileges"
        add_result "CIS-DOCKER-5.18" "Container-Runtime" "No New Privileges" "PASS" "high" \
            "Élévation de privilèges bloquée" "" "CIS Docker 5.18"
    else
        write_warn "$allows_new_priv/$total conteneurs sans no-new-privileges"
        add_result "CIS-DOCKER-5.18" "Container-Runtime" "No New Privileges" "WARN" "high" \
            "Conteneurs peuvent élever leurs privilèges" \
            "Ajouter --security-opt=no-new-privileges" "CIS Docker 5.18"
    fi
}

#===============================================================================
# Kubernetes Checks - Level 1+2
#===============================================================================

check_kubernetes_control_plane() {
    if ! $KUBERNETES_AVAILABLE; then return; fi
    
    echo -e "\n${CYAN}=== Kubernetes Control Plane (CIS Section 1) ===${NC}\n"
    
    # Control plane manifest permissions
    local manifests=(
        "/etc/kubernetes/manifests/kube-apiserver.yaml"
        "/etc/kubernetes/manifests/kube-controller-manager.yaml"
        "/etc/kubernetes/manifests/kube-scheduler.yaml"
        "/etc/kubernetes/manifests/etcd.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        local name
        name=$(basename "$manifest" .yaml)
        
        if [[ -f "$manifest" ]]; then
            write_info "Vérification permissions $name..."
            local perms
            perms=$(stat -c "%a" "$manifest" 2>/dev/null)
            if [[ "$perms" -le 600 ]]; then
                write_pass "$name permissions: $perms"
                add_result "CIS-K8S-1.1-$name" "K8s-ControlPlane" "$name Manifest" "PASS" "high" \
                    "Permissions correctes: $perms" "" "CIS Kubernetes 1.1.x"
            else
                write_fail "$name trop permissif: $perms"
                add_result "CIS-K8S-1.1-$name" "K8s-ControlPlane" "$name Manifest" "FAIL" "high" \
                    "Permissions trop larges" \
                    "chmod 600 $manifest" "CIS Kubernetes 1.1.x"
            fi
        fi
    done
    
    # 1.2.1 - Anonymous auth
    write_info "Vérification authentification anonyme..."
    if kubectl get --raw /api 2>&1 | grep -qi "forbidden\|unauthorized"; then
        write_pass "Authentification anonyme désactivée"
        add_result "CIS-K8S-1.2.1" "K8s-ControlPlane" "Anonymous Auth" "PASS" "critical" \
            "Accès anonyme refusé" "" "CIS Kubernetes 1.2.1"
    else
        write_warn "Authentification anonyme potentiellement active"
        add_result "CIS-K8S-1.2.1" "K8s-ControlPlane" "Anonymous Auth" "WARN" "critical" \
            "Vérifier --anonymous-auth=false" \
            "Configurer --anonymous-auth=false" "CIS Kubernetes 1.2.1"
    fi
    
    # 1.2.2 - Token auth file
    write_info "Vérification token auth file..."
    if ! pgrep -a kube-apiserver 2>/dev/null | grep -q "token-auth-file"; then
        write_pass "Token auth file non utilisé"
        add_result "CIS-K8S-1.2.2" "K8s-ControlPlane" "Token Auth File" "PASS" "high" \
            "Authentification statique désactivée" "" "CIS Kubernetes 1.2.2"
    else
        write_fail "Token auth file utilisé"
        add_result "CIS-K8S-1.2.2" "K8s-ControlPlane" "Token Auth File" "FAIL" "high" \
            "Authentification statique non sécurisée" \
            "Retirer --token-auth-file" "CIS Kubernetes 1.2.2"
    fi
    
    # 1.2.3 - Basic auth file (Level 2)
    write_info "Vérification basic auth file..."
    if ! pgrep -a kube-apiserver 2>/dev/null | grep -q "basic-auth-file"; then
        write_pass "Basic auth file non utilisé"
        add_result "CIS-K8S-1.2.3" "K8s-ControlPlane" "Basic Auth File" "PASS" "high" \
            "Authentification basique désactivée" "" "CIS Kubernetes 1.2.3"
    else
        write_fail "Basic auth file utilisé"
        add_result "CIS-K8S-1.2.3" "K8s-ControlPlane" "Basic Auth File" "FAIL" "high" \
            "Authentification basique non sécurisée" \
            "Retirer --basic-auth-file" "CIS Kubernetes 1.2.3"
    fi
    
    # 1.2.4 - Kubelet HTTPS
    write_info "Vérification kubelet HTTPS..."
    if pgrep -a kube-apiserver 2>/dev/null | grep -q "kubelet-https=true" || ! pgrep -a kube-apiserver 2>/dev/null | grep -q "kubelet-https=false"; then
        write_pass "Communication kubelet en HTTPS"
        add_result "CIS-K8S-1.2.4" "K8s-ControlPlane" "Kubelet HTTPS" "PASS" "critical" \
            "TLS pour kubelet actif" "" "CIS Kubernetes 1.2.4"
    else
        write_fail "Kubelet sans HTTPS"
        add_result "CIS-K8S-1.2.4" "K8s-ControlPlane" "Kubelet HTTPS" "FAIL" "critical" \
            "Communication kubelet non chiffrée" \
            "Retirer --kubelet-https=false" "CIS Kubernetes 1.2.4"
    fi
    
    # 1.2.5 - Authorization mode (Level 2)
    write_info "Vérification mode autorisation..."
    local auth_mode
    auth_mode=$(pgrep -a kube-apiserver 2>/dev/null | grep -oP "authorization-mode=\K[^ ]+" || echo "")
    if [[ "$auth_mode" == *"AlwaysAllow"* ]]; then
        write_fail "Mode AlwaysAllow activé"
        add_result "CIS-K8S-1.2.5" "K8s-ControlPlane" "Authorization Mode" "FAIL" "critical" \
            "Aucune autorisation requise" \
            "Configurer RBAC, Node" "CIS Kubernetes 1.2.5"
    elif [[ -n "$auth_mode" ]]; then
        write_pass "Mode autorisation: $auth_mode"
        add_result "CIS-K8S-1.2.5" "K8s-ControlPlane" "Authorization Mode" "PASS" "critical" \
            "Autorisation $auth_mode configurée" "" "CIS Kubernetes 1.2.5"
    else
        write_warn "Mode autorisation à vérifier"
        add_result "CIS-K8S-1.2.5" "K8s-ControlPlane" "Authorization Mode" "WARN" "critical" \
            "Vérifier la configuration" \
            "Configurer --authorization-mode" "CIS Kubernetes 1.2.5"
    fi
    
    # 1.2.6 - Audit logging (Level 2)
    write_info "Vérification audit logging..."
    if pgrep -a kube-apiserver 2>/dev/null | grep -q "audit-log-path"; then
        write_pass "Audit logging configuré"
        add_result "CIS-K8S-1.2.6" "K8s-ControlPlane" "Audit Logging" "PASS" "high" \
            "Journalisation des audits active" "" "CIS Kubernetes 1.2.6"
    else
        write_warn "Audit logging non configuré"
        add_result "CIS-K8S-1.2.6" "K8s-ControlPlane" "Audit Logging" "WARN" "high" \
            "Pas de journalisation des audits" \
            "Configurer --audit-log-path" "CIS Kubernetes 1.2.6"
    fi
    
    # 1.2.7 - Profiling (Level 2)
    write_info "Vérification profiling..."
    if pgrep -a kube-apiserver 2>/dev/null | grep -q "profiling=false"; then
        write_pass "Profiling désactivé"
        add_result "CIS-K8S-1.2.7" "K8s-ControlPlane" "Profiling" "PASS" "medium" \
            "Profiling API server désactivé" "" "CIS Kubernetes 1.2.7"
    else
        write_warn "Profiling potentiellement actif"
        add_result "CIS-K8S-1.2.7" "K8s-ControlPlane" "Profiling" "WARN" "medium" \
            "Profiling peut exposer des informations" \
            "Configurer --profiling=false" "CIS Kubernetes 1.2.7"
    fi
}

check_kubernetes_etcd() {
    if ! $KUBERNETES_AVAILABLE; then return; fi
    
    echo -e "\n${CYAN}=== Kubernetes etcd (CIS Section 2) ===${NC}\n"
    
    # 2.1 - etcd cert auth
    write_info "Vérification authentification client etcd..."
    if pgrep -a etcd 2>/dev/null | grep -q "client-cert-auth=true"; then
        write_pass "Authentification client etcd activée"
        add_result "CIS-K8S-2.1" "K8s-etcd" "Client Cert Auth" "PASS" "critical" \
            "Certificats clients requis" "" "CIS Kubernetes 2.1"
    else
        write_warn "Authentification client etcd à vérifier"
        add_result "CIS-K8S-2.1" "K8s-etcd" "Client Cert Auth" "WARN" "critical" \
            "Vérifier --client-cert-auth=true" \
            "Activer l'authentification par certificat" "CIS Kubernetes 2.1"
    fi
    
    # 2.2 - etcd peer cert auth
    write_info "Vérification authentification peer etcd..."
    if pgrep -a etcd 2>/dev/null | grep -q "peer-client-cert-auth=true"; then
        write_pass "Authentification peer etcd activée"
        add_result "CIS-K8S-2.2" "K8s-etcd" "Peer Cert Auth" "PASS" "critical" \
            "Communication peer sécurisée" "" "CIS Kubernetes 2.2"
    else
        write_warn "Authentification peer etcd à vérifier"
        add_result "CIS-K8S-2.2" "K8s-etcd" "Peer Cert Auth" "WARN" "critical" \
            "Vérifier --peer-client-cert-auth=true" \
            "Activer l'authentification peer" "CIS Kubernetes 2.2"
    fi
    
    # 2.3 - etcd data encryption (Level 2)
    write_info "Vérification chiffrement données etcd..."
    if pgrep -a kube-apiserver 2>/dev/null | grep -q "encryption-provider-config"; then
        write_pass "Chiffrement etcd configuré"
        add_result "CIS-K8S-2.3" "K8s-etcd" "Data Encryption" "PASS" "critical" \
            "Données chiffrées at rest" "" "CIS Kubernetes 2.3"
    else
        write_warn "Chiffrement etcd non configuré"
        add_result "CIS-K8S-2.3" "K8s-etcd" "Data Encryption" "WARN" "critical" \
            "Données non chiffrées at rest" \
            "Configurer encryption-provider-config" "CIS Kubernetes 2.3"
    fi
    
    # 2.4 - etcd directory permissions
    write_info "Vérification permissions répertoire etcd..."
    local etcd_dir="/var/lib/etcd"
    if [[ -d "$etcd_dir" ]]; then
        local perms
        perms=$(stat -c "%a" "$etcd_dir" 2>/dev/null)
        if [[ "$perms" -le 700 ]]; then
            write_pass "Permissions etcd data: $perms"
            add_result "CIS-K8S-2.4" "K8s-etcd" "Data Directory" "PASS" "critical" \
                "Permissions correctes" "" "CIS Kubernetes 2.4"
        else
            write_fail "Permissions etcd trop larges: $perms"
            add_result "CIS-K8S-2.4" "K8s-etcd" "Data Directory" "FAIL" "critical" \
                "Données etcd exposées" \
                "chmod 700 $etcd_dir" "CIS Kubernetes 2.4"
        fi
    fi
}

check_kubernetes_worker() {
    if ! $KUBERNETES_AVAILABLE; then return; fi
    
    echo -e "\n${CYAN}=== Kubernetes Worker Nodes (CIS Section 4) ===${NC}\n"
    
    # 4.1.1 - Kubelet service permissions
    write_info "Vérification permissions kubelet..."
    local kubelet_service="/usr/lib/systemd/system/kubelet.service"
    if [[ -f "$kubelet_service" ]]; then
        local perms
        perms=$(stat -c "%a" "$kubelet_service" 2>/dev/null)
        if [[ "$perms" -le 644 ]]; then
            write_pass "kubelet.service permissions: $perms"
            add_result "CIS-K8S-4.1.1" "K8s-Worker" "Kubelet Service" "PASS" "high" \
                "Permissions correctes" "" "CIS Kubernetes 4.1.1"
        else
            write_fail "kubelet.service trop permissif"
            add_result "CIS-K8S-4.1.1" "K8s-Worker" "Kubelet Service" "FAIL" "high" \
                "Permissions trop larges" \
                "chmod 644 $kubelet_service" "CIS Kubernetes 4.1.1"
        fi
    fi
    
    # 4.2.1 - Kubelet anonymous auth
    write_info "Vérification authentification anonyme kubelet..."
    if pgrep -a kubelet 2>/dev/null | grep -q "anonymous-auth=false"; then
        write_pass "Auth anonyme kubelet désactivée"
        add_result "CIS-K8S-4.2.1" "K8s-Worker" "Kubelet Anonymous Auth" "PASS" "critical" \
            "Accès anonyme refusé" "" "CIS Kubernetes 4.2.1"
    else
        write_warn "Auth anonyme kubelet à vérifier"
        add_result "CIS-K8S-4.2.1" "K8s-Worker" "Kubelet Anonymous Auth" "WARN" "critical" \
            "Vérifier --anonymous-auth=false" \
            "Désactiver l'authentification anonyme" "CIS Kubernetes 4.2.1"
    fi
    
    # 4.2.2 - Authorization mode Webhook
    write_info "Vérification mode autorisation kubelet..."
    if pgrep -a kubelet 2>/dev/null | grep -q "authorization-mode=Webhook"; then
        write_pass "Kubelet utilise Webhook authorization"
        add_result "CIS-K8S-4.2.2" "K8s-Worker" "Kubelet Authorization" "PASS" "high" \
            "Mode Webhook actif" "" "CIS Kubernetes 4.2.2"
    else
        write_warn "Mode autorisation kubelet à vérifier"
        add_result "CIS-K8S-4.2.2" "K8s-Worker" "Kubelet Authorization" "WARN" "high" \
            "Vérifier --authorization-mode=Webhook" \
            "Configurer mode Webhook" "CIS Kubernetes 4.2.2"
    fi
    
    # 4.2.3 - Certificate rotation
    write_info "Vérification rotation certificats..."
    if pgrep -a kubelet 2>/dev/null | grep -q "rotate-certificates=true"; then
        write_pass "Rotation certificats kubelet activée"
        add_result "CIS-K8S-4.2.3" "K8s-Worker" "Certificate Rotation" "PASS" "high" \
            "Rotation automatique des certificats" "" "CIS Kubernetes 4.2.3"
    else
        write_warn "Rotation certificats à vérifier"
        add_result "CIS-K8S-4.2.3" "K8s-Worker" "Certificate Rotation" "WARN" "high" \
            "Vérifier --rotate-certificates=true" \
            "Activer la rotation des certificats" "CIS Kubernetes 4.2.3"
    fi
    
    # 4.2.4 - Read-only port disabled (Level 2)
    write_info "Vérification port read-only kubelet..."
    if pgrep -a kubelet 2>/dev/null | grep -q "read-only-port=0"; then
        write_pass "Port read-only kubelet désactivé"
        add_result "CIS-K8S-4.2.4" "K8s-Worker" "Read-only Port" "PASS" "high" \
            "Port non authentifié fermé" "" "CIS Kubernetes 4.2.4"
    else
        write_warn "Port read-only kubelet potentiellement actif"
        add_result "CIS-K8S-4.2.4" "K8s-Worker" "Read-only Port" "WARN" "high" \
            "Port 10255 peut être exposé" \
            "Configurer --read-only-port=0" "CIS Kubernetes 4.2.4"
    fi
    
    # 4.2.5 - Streaming connections (Level 2)
    write_info "Vérification timeout connexions streaming..."
    if pgrep -a kubelet 2>/dev/null | grep -q "streaming-connection-idle-timeout"; then
        write_pass "Timeout streaming configuré"
        add_result "CIS-K8S-4.2.5" "K8s-Worker" "Streaming Timeout" "PASS" "medium" \
            "Timeout connexions défini" "" "CIS Kubernetes 4.2.5"
    else
        write_warn "Timeout streaming non configuré explicitement"
        add_result "CIS-K8S-4.2.5" "K8s-Worker" "Streaming Timeout" "WARN" "medium" \
            "Utilisation du timeout par défaut" \
            "Configurer --streaming-connection-idle-timeout" "CIS Kubernetes 4.2.5"
    fi
    
    # 4.2.6 - Protect kernel defaults (Level 2)
    write_info "Vérification protection kernel defaults..."
    if pgrep -a kubelet 2>/dev/null | grep -q "protect-kernel-defaults=true"; then
        write_pass "Protection kernel defaults activée"
        add_result "CIS-K8S-4.2.6" "K8s-Worker" "Protect Kernel Defaults" "PASS" "high" \
            "Paramètres kernel protégés" "" "CIS Kubernetes 4.2.6"
    else
        write_warn "Protection kernel defaults non activée"
        add_result "CIS-K8S-4.2.6" "K8s-Worker" "Protect Kernel Defaults" "WARN" "high" \
            "Conteneurs peuvent modifier sysctl" \
            "Configurer --protect-kernel-defaults=true" "CIS Kubernetes 4.2.6"
    fi
}

check_kubernetes_policies() {
    if ! $KUBERNETES_AVAILABLE; then return; fi
    
    echo -e "\n${CYAN}=== Kubernetes Policies (CIS Section 5) ===${NC}\n"
    
    # 5.1.1 - Cluster-admin role
    write_info "Vérification utilisation cluster-admin..."
    local admin_bindings
    admin_bindings=$(kubectl get clusterrolebindings -o json 2>/dev/null | grep -c '"cluster-admin"' || echo "0")
    if [[ "$admin_bindings" -le 2 ]]; then
        write_pass "Utilisation cluster-admin limitée: $admin_bindings"
        add_result "CIS-K8S-5.1.1" "K8s-Policies" "Cluster-Admin Usage" "PASS" "high" \
            "Nombre limité de cluster-admin" "" "CIS Kubernetes 5.1.1"
    else
        write_warn "$admin_bindings bindings cluster-admin"
        add_result "CIS-K8S-5.1.1" "K8s-Policies" "Cluster-Admin Usage" "WARN" "high" \
            "Trop de comptes cluster-admin" \
            "Réduire les bindings cluster-admin" "CIS Kubernetes 5.1.1"
    fi
    
    # 5.1.2 - Pod Security
    write_info "Vérification Pod Security..."
    if kubectl get podsecuritypolicies 2>/dev/null | grep -q "restricted\|baseline"; then
        write_pass "Pod Security Policies configurées"
        add_result "CIS-K8S-5.1.2" "K8s-Policies" "Pod Security" "PASS" "high" \
            "PSP en place" "" "CIS Kubernetes 5.1.2"
    elif kubectl get ns default -o jsonpath='{.metadata.labels}' 2>/dev/null | grep -q "pod-security"; then
        write_pass "Pod Security Standards configurées"
        add_result "CIS-K8S-5.1.2" "K8s-Policies" "Pod Security" "PASS" "high" \
            "PSS labels en place" "" "CIS Kubernetes 5.1.2"
    else
        write_warn "Pod Security non configurée"
        add_result "CIS-K8S-5.1.2" "K8s-Policies" "Pod Security" "WARN" "high" \
            "Pas de politique de sécurité des pods" \
            "Configurer Pod Security Standards" "CIS Kubernetes 5.1.2"
    fi
    
    # 5.1.3 - Service Account tokens (Level 2)
    write_info "Vérification automount service account..."
    local automount_count
    automount_count=$(kubectl get serviceaccounts --all-namespaces -o json 2>/dev/null | grep -c '"automountServiceAccountToken": false' || echo "0")
    if [[ "$automount_count" -gt 0 ]]; then
        write_pass "$automount_count SA avec automount désactivé"
        add_result "CIS-K8S-5.1.3" "K8s-Policies" "Service Account Automount" "PASS" "high" \
            "Tokens non montés automatiquement" "" "CIS Kubernetes 5.1.3"
    else
        write_warn "Automount activé par défaut"
        add_result "CIS-K8S-5.1.3" "K8s-Policies" "Service Account Automount" "WARN" "high" \
            "Tokens montés automatiquement" \
            "Configurer automountServiceAccountToken: false" "CIS Kubernetes 5.1.3"
    fi
    
    # 5.2.1 - Default namespace
    write_info "Vérification namespace default..."
    local default_pods
    default_pods=$(kubectl get pods -n default 2>/dev/null | grep -v "^NAME" | wc -l)
    if [[ "$default_pods" -eq 0 ]]; then
        write_pass "Namespace default vide"
        add_result "CIS-K8S-5.2.1" "K8s-Policies" "Default Namespace" "PASS" "medium" \
            "Aucun workload dans default" "" "CIS Kubernetes 5.2.1"
    else
        write_warn "$default_pods pods dans namespace default"
        add_result "CIS-K8S-5.2.1" "K8s-Policies" "Default Namespace" "WARN" "medium" \
            "Workloads dans namespace default" \
            "Déplacer vers des namespaces dédiés" "CIS Kubernetes 5.2.1"
    fi
    
    # 5.2.2 - Network Policies
    write_info "Vérification Network Policies..."
    local ns_with_netpol
    ns_with_netpol=$(kubectl get networkpolicies --all-namespaces 2>/dev/null | grep -v "^NAMESPACE" | awk '{print $1}' | sort -u | wc -l)
    
    if [[ "$ns_with_netpol" -gt 0 ]]; then
        write_pass "Network Policies dans $ns_with_netpol namespaces"
        add_result "CIS-K8S-5.2.2" "K8s-Policies" "Network Policies" "PASS" "high" \
            "Segmentation réseau en place" "" "CIS Kubernetes 5.2.2"
    else
        write_warn "Aucune Network Policy détectée"
        add_result "CIS-K8S-5.2.2" "K8s-Policies" "Network Policies" "WARN" "high" \
            "Pas de segmentation réseau" \
            "Créer des Network Policies" "CIS Kubernetes 5.2.2"
    fi
    
    # 5.3.1 - Secrets encryption (Level 2)
    write_info "Vérification chiffrement secrets..."
    add_result "CIS-K8S-5.3.1" "K8s-Policies" "Secrets Encryption" "WARN" "critical" \
        "Vérifier encryption at rest" \
        "Configurer EncryptionConfiguration" "CIS Kubernetes 5.3.1"
    
    # 5.4.1 - Resource quotas
    write_info "Vérification ResourceQuotas..."
    local ns_with_quota
    ns_with_quota=$(kubectl get resourcequotas --all-namespaces 2>/dev/null | grep -v "^NAMESPACE" | wc -l)
    
    if [[ "$ns_with_quota" -gt 0 ]]; then
        write_pass "$ns_with_quota ResourceQuotas configurées"
        add_result "CIS-K8S-5.4.1" "K8s-Policies" "Resource Quotas" "PASS" "medium" \
            "Limites de ressources en place" "" "CIS Kubernetes 5.4.1"
    else
        write_warn "Aucune ResourceQuota détectée"
        add_result "CIS-K8S-5.4.1" "K8s-Policies" "Resource Quotas" "WARN" "medium" \
            "Pas de limites de ressources" \
            "Créer des ResourceQuotas" "CIS Kubernetes 5.4.1"
    fi
    
    # 5.4.2 - LimitRanges
    write_info "Vérification LimitRanges..."
    local ns_with_lr
    ns_with_lr=$(kubectl get limitranges --all-namespaces 2>/dev/null | grep -v "^NAMESPACE" | wc -l)
    
    if [[ "$ns_with_lr" -gt 0 ]]; then
        write_pass "$ns_with_lr LimitRanges configurées"
        add_result "CIS-K8S-5.4.2" "K8s-Policies" "Limit Ranges" "PASS" "medium" \
            "Limites par défaut définies" "" "CIS Kubernetes 5.4.2"
    else
        write_warn "Aucune LimitRange détectée"
        add_result "CIS-K8S-5.4.2" "K8s-Policies" "Limit Ranges" "WARN" "medium" \
            "Pas de limites par défaut" \
            "Créer des LimitRanges" "CIS Kubernetes 5.4.2"
    fi
    
    # 5.5.1 - Image pull secrets (Level 2)
    write_info "Vérification secrets pour pull images..."
    local pull_secrets
    pull_secrets=$(kubectl get secrets --all-namespaces -o json 2>/dev/null | grep -c '"type": "kubernetes.io/dockerconfigjson"' || echo "0")
    if [[ "$pull_secrets" -gt 0 ]]; then
        write_pass "$pull_secrets secrets de registre configurés"
        add_result "CIS-K8S-5.5.1" "K8s-Policies" "Image Pull Secrets" "PASS" "medium" \
            "Authentification registres en place" "" "CIS Kubernetes 5.5.1"
    else
        write_info "Aucun secret de registre privé"
        add_result "CIS-K8S-5.5.1" "K8s-Policies" "Image Pull Secrets" "PASS" "medium" \
            "Registres publics ou intégrés" "" "CIS Kubernetes 5.5.1"
    fi
    
    # 5.6.1 - ImagePolicyWebhook (Level 2)
    write_info "Vérification admission controller images..."
    if pgrep -a kube-apiserver 2>/dev/null | grep -q "ImagePolicyWebhook"; then
        write_pass "ImagePolicyWebhook configuré"
        add_result "CIS-K8S-5.6.1" "K8s-Policies" "Image Policy Webhook" "PASS" "high" \
            "Validation images activée" "" "CIS Kubernetes 5.6.1"
    else
        write_warn "ImagePolicyWebhook non configuré"
        add_result "CIS-K8S-5.6.1" "K8s-Policies" "Image Policy Webhook" "WARN" "high" \
            "Pas de validation des images" \
            "Configurer ImagePolicyWebhook" "CIS Kubernetes 5.6.1"
    fi
}

#===============================================================================
# Génération du rapport
#===============================================================================

generate_json_report() {
    local score=$1
    local grade=$2
    
    local results_json
    results_json=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
    
    cat > "$OUTPUT_FILE" << EOF
{
  "metadata": {
    "script": "$SCRIPT_NAME",
    "version": "$VERSION",
    "date": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "standards": ["CIS Docker Benchmark 1.6 Level 1+2", "CIS Kubernetes Benchmark 1.8 Level 1+2"]
  },
  "summary": {
    "score": $score,
    "grade": "$grade",
    "total": $((PASS_COUNT + FAIL_COUNT + WARN_COUNT)),
    "pass": $PASS_COUNT,
    "fail": $FAIL_COUNT,
    "warn": $WARN_COUNT
  },
  "runtimes_detected": {
    "docker": $DOCKER_AVAILABLE,
    "podman": $PODMAN_AVAILABLE,
    "kubernetes": $KUBERNETES_AVAILABLE,
    "containerd": $CONTAINERD_AVAILABLE
  },
  "results": [$results_json]
}
EOF
    
    write_info "Rapport JSON: $OUTPUT_FILE"
}

generate_html_report() {
    local score=$1
    local grade=$2
    local html_file="${OUTPUT_FILE%.json}.html"
    
    local grade_color
    case $grade in
        A) grade_color="#22c55e" ;;
        B) grade_color="#84cc16" ;;
        C) grade_color="#eab308" ;;
        D) grade_color="#f97316" ;;
        F) grade_color="#ef4444" ;;
    esac
    
    cat > "$html_file" << 'HTMLHEAD'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Container Compliance Report - Enhanced</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; }
        .header h1 { font-size: 2.5rem; background: linear-gradient(135deg, #06b6d4, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; }
        .header p { color: #94a3b8; }
        .score-card { background: linear-gradient(135deg, #1e293b, #334155); border-radius: 1rem; padding: 2rem; margin-bottom: 2rem; display: flex; justify-content: space-around; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .grade { font-size: 5rem; font-weight: bold; }
        .score-details { text-align: center; }
        .score-details h2 { font-size: 3rem; margin-bottom: 0.5rem; }
        .stats { display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center; }
        .stat { text-align: center; padding: 1rem; }
        .stat-value { font-size: 2rem; font-weight: bold; }
        .stat-pass { color: #22c55e; }
        .stat-fail { color: #ef4444; }
        .stat-warn { color: #eab308; }
        .results { margin-top: 2rem; }
        .result-group { margin-bottom: 2rem; }
        .result-group h3 { font-size: 1.25rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #334155; }
        .result-item { background: #1e293b; border-radius: 0.5rem; padding: 1rem; margin-bottom: 0.5rem; display: flex; align-items: flex-start; gap: 1rem; }
        .result-status { padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-weight: bold; font-size: 0.75rem; text-transform: uppercase; flex-shrink: 0; }
        .status-pass { background: #166534; color: #bbf7d0; }
        .status-fail { background: #991b1b; color: #fecaca; }
        .status-warn { background: #854d0e; color: #fef08a; }
        .result-content { flex: 1; }
        .result-title { font-weight: 600; margin-bottom: 0.25rem; }
        .result-desc { color: #94a3b8; font-size: 0.875rem; }
        .result-ref { color: #64748b; font-size: 0.75rem; margin-top: 0.25rem; }
        .runtimes { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-bottom: 2rem; }
        .runtime { background: #1e293b; padding: 0.5rem 1rem; border-radius: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
        .runtime-active { border: 1px solid #22c55e; }
        .runtime-inactive { border: 1px solid #475569; opacity: 0.5; }
        .level-badge { background: #8b5cf6; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: 0.5rem; }
        @media print { body { background: white; color: black; } .result-item, .score-card { background: #f1f5f9; } }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>Container & Orchestration Compliance</h1>
        <p>CIS Docker Benchmark 1.6 + CIS Kubernetes Benchmark 1.8 - Level 1 + 2 <span class="level-badge">Enhanced</span></p>
    </div>
HTMLHEAD
    
    echo "    <div class=\"score-card\">" >> "$html_file"
    echo "        <div class=\"grade\" style=\"color: $grade_color\">$grade</div>" >> "$html_file"
    echo "        <div class=\"score-details\">" >> "$html_file"
    echo "            <h2>$score%</h2>" >> "$html_file"
    echo "            <p>Score de conformité</p>" >> "$html_file"
    echo "        </div>" >> "$html_file"
    echo "        <div class=\"stats\">" >> "$html_file"
    echo "            <div class=\"stat\"><div class=\"stat-value stat-pass\">$PASS_COUNT</div><div>Conformes</div></div>" >> "$html_file"
    echo "            <div class=\"stat\"><div class=\"stat-value stat-fail\">$FAIL_COUNT</div><div>Non conformes</div></div>" >> "$html_file"
    echo "            <div class=\"stat\"><div class=\"stat-value stat-warn\">$WARN_COUNT</div><div>Avertissements</div></div>" >> "$html_file"
    echo "        </div>" >> "$html_file"
    echo "    </div>" >> "$html_file"
    
    echo "    <div class=\"runtimes\">" >> "$html_file"
    if $DOCKER_AVAILABLE; then
        echo "        <div class=\"runtime runtime-active\">Docker</div>" >> "$html_file"
    else
        echo "        <div class=\"runtime runtime-inactive\">Docker</div>" >> "$html_file"
    fi
    if $PODMAN_AVAILABLE; then
        echo "        <div class=\"runtime runtime-active\">Podman</div>" >> "$html_file"
    else
        echo "        <div class=\"runtime runtime-inactive\">Podman</div>" >> "$html_file"
    fi
    if $KUBERNETES_AVAILABLE; then
        echo "        <div class=\"runtime runtime-active\">Kubernetes</div>" >> "$html_file"
    else
        echo "        <div class=\"runtime runtime-inactive\">Kubernetes</div>" >> "$html_file"
    fi
    if $CONTAINERD_AVAILABLE; then
        echo "        <div class=\"runtime runtime-active\">Containerd</div>" >> "$html_file"
    else
        echo "        <div class=\"runtime runtime-inactive\">Containerd</div>" >> "$html_file"
    fi
    echo "    </div>" >> "$html_file"
    
    echo "    <div class=\"results\">" >> "$html_file"
    
    declare -A categories
    for result in "${RESULTS[@]}"; do
        local category
        category=$(echo "$result" | grep -oP '"category":"\K[^"]+')
        categories["$category"]=1
    done
    
    for category in "${!categories[@]}"; do
        echo "        <div class=\"result-group\">" >> "$html_file"
        echo "            <h3>$category</h3>" >> "$html_file"
        
        for result in "${RESULTS[@]}"; do
            local cat
            cat=$(echo "$result" | grep -oP '"category":"\K[^"]+')
            if [[ "$cat" == "$category" ]]; then
                local status title desc ref
                status=$(echo "$result" | grep -oP '"status":"\K[^"]+')
                title=$(echo "$result" | grep -oP '"title":"\K[^"]+')
                desc=$(echo "$result" | grep -oP '"description":"\K[^"]+')
                ref=$(echo "$result" | grep -oP '"reference":"\K[^"]+')
                
                local status_class
                case $status in
                    PASS) status_class="status-pass" ;;
                    FAIL) status_class="status-fail" ;;
                    *) status_class="status-warn" ;;
                esac
                
                echo "            <div class=\"result-item\">" >> "$html_file"
                echo "                <span class=\"result-status $status_class\">$status</span>" >> "$html_file"
                echo "                <div class=\"result-content\">" >> "$html_file"
                echo "                    <div class=\"result-title\">$title</div>" >> "$html_file"
                echo "                    <div class=\"result-desc\">$desc</div>" >> "$html_file"
                [[ -n "$ref" ]] && echo "                    <div class=\"result-ref\">$ref</div>" >> "$html_file"
                echo "                </div>" >> "$html_file"
                echo "            </div>" >> "$html_file"
            fi
        done
        
        echo "        </div>" >> "$html_file"
    done
    
    echo "    </div>" >> "$html_file"
    echo "</div>" >> "$html_file"
    echo "</body></html>" >> "$html_file"
    
    write_info "Rapport HTML: $html_file"
}

calculate_score() {
    local total=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
    if [[ $total -eq 0 ]]; then
        echo "0"
        return
    fi
    
    local weighted_score=$((PASS_COUNT * 100 + WARN_COUNT * 50))
    echo $((weighted_score / total))
}

get_grade() {
    local score=$1
    if [[ $score -ge 90 ]]; then echo "A"
    elif [[ $score -ge 80 ]]; then echo "B"
    elif [[ $score -ge 70 ]]; then echo "C"
    elif [[ $score -ge 60 ]]; then echo "D"
    else echo "F"
    fi
}

#===============================================================================
# Main
#===============================================================================

main() {
    print_banner
    check_root
    
    echo -e "\n${CYAN}=== Détection des runtimes ===${NC}\n"
    detect_container_runtime
    
    # Docker checks
    check_docker_host_configuration
    check_docker_daemon_configuration
    check_docker_daemon_files
    check_container_images
    check_container_runtime
    
    # Kubernetes checks
    check_kubernetes_control_plane
    check_kubernetes_etcd
    check_kubernetes_worker
    check_kubernetes_policies
    
    # Generate reports
    local score
    score=$(calculate_score)
    local grade
    grade=$(get_grade "$score")
    
    echo -e "\n${CYAN}=== Résumé ===${NC}\n"
    echo -e "Score: ${CYAN}$score%${NC} - Grade: ${CYAN}$grade${NC}"
    echo -e "Conformes: ${GREEN}$PASS_COUNT${NC} | Non conformes: ${RED}$FAIL_COUNT${NC} | Avertissements: ${YELLOW}$WARN_COUNT${NC}"
    
    generate_json_report "$score" "$grade"
    generate_html_report "$score" "$grade"
    
    echo -e "\n${GREEN}Audit terminé avec succès${NC}\n"
}

main "$@"
