#!/bin/bash
#===============================================================================
# Container & Orchestration Compliance Toolkit - Base
# Version: 1.0.0
# Standards: CIS Docker Benchmark 1.6 + CIS Kubernetes Benchmark 1.8 (Level 1)
# Compatibilité: Docker 20.10+, Podman 4.0+, Kubernetes 1.25+
#===============================================================================

set -euo pipefail

VERSION="1.0.0"
SCRIPT_NAME="Container Compliance Base"
OUTPUT_FILE="${1:-container-compliance-base-$(date +%Y%m%d_%H%M%S).json}"

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
    echo "║     Container & Orchestration Compliance Toolkit - Base           ║"
    echo "║                      Version $VERSION                               ║"
    echo "║          CIS Docker & Kubernetes Benchmark Level 1                ║"
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

get_container_data_dir() {
    if [[ "$CONTAINER_RUNTIME" == "podman" ]]; then
        echo "/var/lib/containers"
    else
        echo "/var/lib/docker"
    fi
}

get_container_config_dir() {
    if [[ "$CONTAINER_RUNTIME" == "podman" ]]; then
        echo "/etc/containers"
    else
        echo "/etc/docker"
    fi
}

get_container_service_name() {
    if [[ "$CONTAINER_RUNTIME" == "podman" ]]; then
        echo "podman"
    else
        echo "docker"
    fi
}

#===============================================================================
# Vérifications Container CIS Level 1
#===============================================================================

check_container_host_configuration() {
    if ! container_available; then return; fi
    
    local data_dir config_dir service_name
    data_dir=$(get_container_data_dir)
    config_dir=$(get_container_config_dir)
    service_name=$(get_container_service_name)
    
    echo -e "\n${CYAN}=== Container Host Configuration (CIS Section 1) ===${NC}\n"
    write_info "Runtime: $CONTAINER_RUNTIME (data: $data_dir, config: $config_dir)"
    
    # 1.1.1 - Partition séparée pour données conteneurs
    write_info "Vérification partition $data_dir..."
    if mount | grep -q "$data_dir"; then
        write_pass "Partition séparée pour $data_dir"
        add_result "CIS-CONTAINER-1.1.1" "Container-Host" "Partition données" "PASS" "medium" \
            "$data_dir sur partition séparée" "" "CIS Docker/Podman 1.1.1"
    else
        write_warn "$data_dir pas sur partition séparée"
        add_result "CIS-CONTAINER-1.1.1" "Container-Host" "Partition données" "WARN" "medium" \
            "$data_dir partage la partition système" \
            "Créer une partition séparée pour $data_dir" "CIS Docker/Podman 1.1.1"
    fi
    
    # 1.1.3 - Auditing configuré pour runtime
    write_info "Vérification audit $service_name..."
    if command -v auditctl &>/dev/null && auditctl -l 2>/dev/null | grep -q "$service_name"; then
        write_pass "Audit $service_name configuré"
        add_result "CIS-CONTAINER-1.1.3" "Container-Host" "Audit runtime" "PASS" "high" \
            "Règles d'audit pour $service_name actives" "" "CIS Docker/Podman 1.1.3"
    else
        write_warn "Audit $service_name non configuré"
        add_result "CIS-CONTAINER-1.1.3" "Container-Host" "Audit runtime" "WARN" "high" \
            "Pas de règles d'audit pour $service_name" \
            "Configurer auditd pour surveiller /usr/bin/$service_name" "CIS Docker/Podman 1.1.3"
    fi
    
    # 1.1.4 - Audit pour service systemd
    write_info "Vérification audit $service_name.service..."
    if command -v auditctl &>/dev/null && auditctl -l 2>/dev/null | grep -q "$service_name.service"; then
        write_pass "Audit $service_name.service configuré"
        add_result "CIS-CONTAINER-1.1.4" "Container-Host" "Audit service" "PASS" "medium" \
            "Surveillance $service_name.service active" "" "CIS Docker/Podman 1.1.4"
    else
        write_warn "Audit $service_name.service non configuré"
        add_result "CIS-CONTAINER-1.1.4" "Container-Host" "Audit service" "WARN" "medium" \
            "$service_name.service non surveillé" \
            "Ajouter règle audit pour $service_name.service" "CIS Docker/Podman 1.1.4"
    fi
    
    # 1.1.5 - Audit pour socket
    write_info "Vérification audit $service_name.socket..."
    if command -v auditctl &>/dev/null && auditctl -l 2>/dev/null | grep -q "$service_name.socket"; then
        write_pass "Audit $service_name.socket configuré"
        add_result "CIS-CONTAINER-1.1.5" "Container-Host" "Audit socket" "PASS" "medium" \
            "Surveillance $service_name.socket active" "" "CIS Docker/Podman 1.1.5"
    else
        write_warn "Audit $service_name.socket non configuré"
        add_result "CIS-CONTAINER-1.1.5" "Container-Host" "Audit socket" "WARN" "medium" \
            "$service_name.socket non surveillé" \
            "Ajouter règle audit pour $service_name.socket" "CIS Docker/Podman 1.1.5"
    fi
    
    # 1.1.6 - Audit pour config dir
    write_info "Vérification audit $config_dir..."
    if command -v auditctl &>/dev/null && auditctl -l 2>/dev/null | grep -q "$config_dir"; then
        write_pass "Audit $config_dir configuré"
        add_result "CIS-CONTAINER-1.1.6" "Container-Host" "Audit config" "PASS" "medium" \
            "Surveillance $config_dir active" "" "CIS Docker/Podman 1.1.6"
    else
        write_warn "Audit $config_dir non configuré"
        add_result "CIS-CONTAINER-1.1.6" "Container-Host" "Audit config" "WARN" "medium" \
            "$config_dir non surveillé" \
            "Ajouter règle audit pour $config_dir" "CIS Docker/Podman 1.1.6"
    fi
}

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
    
    # 2.10 - Base device size
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
    
    # 2.11 - Authorization plugin
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
    
    # 2.12 - Centralized logging
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
    
    # 2.14 - Userland proxy
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
    
    # 2.16 - Experimental features
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
}

check_docker_daemon_files() {
    if ! container_available; then return; fi
    
    echo -e "\n${CYAN}=== Docker Daemon Files (CIS Section 3) ===${NC}\n"
    
    # 3.1 - docker.service ownership
    write_info "Vérification permissions docker.service..."
    local docker_service="/usr/lib/systemd/system/docker.service"
    if [[ -f "$docker_service" ]]; then
        local perms
        perms=$(stat -c "%a" "$docker_service" 2>/dev/null)
        if [[ "$perms" -le 644 ]]; then
            write_pass "docker.service permissions: $perms"
            add_result "CIS-DOCKER-3.1" "Docker-Files" "docker.service permissions" "PASS" "high" \
                "Permissions correctes: $perms" "" "CIS Docker 3.1"
        else
            write_fail "docker.service trop permissif: $perms"
            add_result "CIS-DOCKER-3.1" "Docker-Files" "docker.service permissions" "FAIL" "high" \
                "Permissions trop larges: $perms" \
                "chmod 644 $docker_service" "CIS Docker 3.1"
        fi
    fi
    
    # 3.2 - docker.socket ownership
    write_info "Vérification permissions docker.socket..."
    local docker_socket="/usr/lib/systemd/system/docker.socket"
    if [[ -f "$docker_socket" ]]; then
        local perms
        perms=$(stat -c "%a" "$docker_socket" 2>/dev/null)
        if [[ "$perms" -le 644 ]]; then
            write_pass "docker.socket permissions: $perms"
            add_result "CIS-DOCKER-3.2" "Docker-Files" "docker.socket permissions" "PASS" "high" \
                "Permissions correctes: $perms" "" "CIS Docker 3.2"
        else
            write_fail "docker.socket trop permissif: $perms"
            add_result "CIS-DOCKER-3.2" "Docker-Files" "docker.socket permissions" "FAIL" "high" \
                "Permissions trop larges: $perms" \
                "chmod 644 $docker_socket" "CIS Docker 3.2"
        fi
    fi
    
    # 3.3 - /etc/docker permissions
    write_info "Vérification permissions /etc/docker..."
    if [[ -d /etc/docker ]]; then
        local perms
        perms=$(stat -c "%a" /etc/docker 2>/dev/null)
        if [[ "$perms" -le 755 ]]; then
            write_pass "/etc/docker permissions: $perms"
            add_result "CIS-DOCKER-3.3" "Docker-Files" "/etc/docker permissions" "PASS" "high" \
                "Permissions correctes: $perms" "" "CIS Docker 3.3"
        else
            write_fail "/etc/docker trop permissif: $perms"
            add_result "CIS-DOCKER-3.3" "Docker-Files" "/etc/docker permissions" "FAIL" "high" \
                "Permissions trop larges: $perms" \
                "chmod 755 /etc/docker" "CIS Docker 3.3"
        fi
    fi
    
    # 3.4 - /etc/docker ownership
    write_info "Vérification propriétaire /etc/docker..."
    if [[ -d /etc/docker ]]; then
        local owner
        owner=$(stat -c "%U:%G" /etc/docker 2>/dev/null)
        if [[ "$owner" == "root:root" ]]; then
            write_pass "/etc/docker appartient à root:root"
            add_result "CIS-DOCKER-3.4" "Docker-Files" "/etc/docker ownership" "PASS" "high" \
                "Propriétaire correct: root:root" "" "CIS Docker 3.4"
        else
            write_fail "/etc/docker mauvais propriétaire: $owner"
            add_result "CIS-DOCKER-3.4" "Docker-Files" "/etc/docker ownership" "FAIL" "high" \
                "Propriétaire incorrect: $owner" \
                "chown root:root /etc/docker" "CIS Docker 3.4"
        fi
    fi
    
    # 3.5 - /var/run/docker.sock permissions
    write_info "Vérification permissions docker.sock..."
    if [[ -S /var/run/docker.sock ]]; then
        local perms
        perms=$(stat -c "%a" /var/run/docker.sock 2>/dev/null)
        if [[ "$perms" -le 660 ]]; then
            write_pass "docker.sock permissions: $perms"
            add_result "CIS-DOCKER-3.5" "Docker-Files" "docker.sock permissions" "PASS" "critical" \
                "Permissions correctes: $perms" "" "CIS Docker 3.5"
        else
            write_fail "docker.sock trop permissif: $perms"
            add_result "CIS-DOCKER-3.5" "Docker-Files" "docker.sock permissions" "FAIL" "critical" \
                "Permissions dangereuses: $perms" \
                "chmod 660 /var/run/docker.sock" "CIS Docker 3.5"
        fi
    fi
    
    # 3.6 - daemon.json permissions
    write_info "Vérification permissions daemon.json..."
    if [[ -f /etc/docker/daemon.json ]]; then
        local perms
        perms=$(stat -c "%a" /etc/docker/daemon.json 2>/dev/null)
        if [[ "$perms" -le 644 ]]; then
            write_pass "daemon.json permissions: $perms"
            add_result "CIS-DOCKER-3.6" "Docker-Files" "daemon.json permissions" "PASS" "high" \
                "Permissions correctes: $perms" "" "CIS Docker 3.6"
        else
            write_fail "daemon.json trop permissif: $perms"
            add_result "CIS-DOCKER-3.6" "Docker-Files" "daemon.json permissions" "FAIL" "high" \
                "Permissions trop larges: $perms" \
                "chmod 644 /etc/docker/daemon.json" "CIS Docker 3.6"
        fi
    else
        write_warn "daemon.json non trouvé"
        add_result "CIS-DOCKER-3.6" "Docker-Files" "daemon.json permissions" "WARN" "medium" \
            "Fichier de configuration absent" \
            "Créer /etc/docker/daemon.json" "CIS Docker 3.6"
    fi
}

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
        write_info "Aucun conteneur en cours d'exécution"
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
    
    if [[ $total_containers -eq 0 ]]; then
        add_result "CIS-DOCKER-4.3" "Container-Images" "HEALTHCHECK" "PASS" "medium" \
            "Aucun conteneur actif" "" "CIS Docker 4.3"
    elif [[ $no_healthcheck -eq 0 ]]; then
        write_pass "Tous les conteneurs ont un HEALTHCHECK"
        add_result "CIS-DOCKER-4.3" "Container-Images" "HEALTHCHECK" "PASS" "medium" \
            "Tous les conteneurs surveillés" "" "CIS Docker 4.3"
    else
        write_warn "$no_healthcheck/$total_containers sans HEALTHCHECK"
        add_result "CIS-DOCKER-4.3" "Container-Images" "HEALTHCHECK" "WARN" "medium" \
            "$no_healthcheck conteneurs sans surveillance santé" \
            "Ajouter HEALTHCHECK dans les Dockerfiles" "CIS Docker 4.3"
    fi
}

check_container_runtime() {
    if ! container_available; then return; fi
    
    echo -e "\n${CYAN}=== Container Runtime (CIS Section 5) ===${NC}\n"
    
    # 5.1 - AppArmor
    write_info "Vérification profils AppArmor..."
    local no_apparmor=0
    local total=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total++))
            local apparmor
            apparmor=$(container_exec inspect --format '{{.AppArmorProfile}}' "$container_id" 2>/dev/null)
            if [[ -z "$apparmor" || "$apparmor" == "unconfined" ]]; then
                ((no_apparmor++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total -eq 0 ]]; then
        add_result "CIS-DOCKER-5.1" "Container-Runtime" "AppArmor Profile" "PASS" "high" \
            "Aucun conteneur actif" "" "CIS Docker 5.1"
    elif [[ $no_apparmor -eq 0 ]]; then
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
        write_info "SELinux non disponible (AppArmor utilisé?)"
        add_result "CIS-DOCKER-5.2" "Container-Runtime" "SELinux" "PASS" "high" \
            "SELinux non applicable sur ce système" "" "CIS Docker 5.2"
    fi
    
    # 5.3 - Capabilities restreintes
    write_info "Vérification capabilities..."
    local elevated_caps=0
    total=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total++))
            local caps
            caps=$(container_exec inspect --format '{{.HostConfig.CapAdd}}' "$container_id" 2>/dev/null)
            if [[ -n "$caps" && "$caps" != "[]" && "$caps" != "<nil>" ]]; then
                ((elevated_caps++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total -eq 0 ]]; then
        add_result "CIS-DOCKER-5.3" "Container-Runtime" "Linux Capabilities" "PASS" "high" \
            "Aucun conteneur actif" "" "CIS Docker 5.3"
    elif [[ $elevated_caps -eq 0 ]]; then
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
    total=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total++))
            local priv
            priv=$(container_exec inspect --format '{{.HostConfig.Privileged}}' "$container_id" 2>/dev/null)
            if [[ "$priv" == "true" ]]; then
                ((privileged++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total -eq 0 ]]; then
        add_result "CIS-DOCKER-5.4" "Container-Runtime" "Privileged Containers" "PASS" "critical" \
            "Aucun conteneur actif" "" "CIS Docker 5.4"
    elif [[ $privileged -eq 0 ]]; then
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
    total=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total++))
            if docker exec "$container_id" pgrep sshd &>/dev/null 2>&1; then
                ((ssh_found++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total -eq 0 ]]; then
        add_result "CIS-DOCKER-5.5" "Container-Runtime" "SSH in Containers" "PASS" "high" \
            "Aucun conteneur actif" "" "CIS Docker 5.5"
    elif [[ $ssh_found -eq 0 ]]; then
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
    total=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total++))
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
    
    if [[ $total -eq 0 ]]; then
        add_result "CIS-DOCKER-5.6" "Container-Runtime" "Privileged Ports" "PASS" "medium" \
            "Aucun conteneur actif" "" "CIS Docker 5.6"
    elif [[ $priv_ports -eq 0 ]]; then
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
    total=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total++))
            local netmode
            netmode=$(container_exec inspect --format '{{.HostConfig.NetworkMode}}' "$container_id" 2>/dev/null)
            if [[ "$netmode" == "host" ]]; then
                ((host_net++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total -eq 0 ]]; then
        add_result "CIS-DOCKER-5.7" "Container-Runtime" "Host Network Mode" "PASS" "high" \
            "Aucun conteneur actif" "" "CIS Docker 5.7"
    elif [[ $host_net -eq 0 ]]; then
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
    total=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total++))
            local mem
            mem=$(container_exec inspect --format '{{.HostConfig.Memory}}' "$container_id" 2>/dev/null)
            if [[ "$mem" == "0" ]]; then
                ((no_mem_limit++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total -eq 0 ]]; then
        add_result "CIS-DOCKER-5.8" "Container-Runtime" "Memory Limits" "PASS" "medium" \
            "Aucun conteneur actif" "" "CIS Docker 5.8"
    elif [[ $no_mem_limit -eq 0 ]]; then
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
    total=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total++))
            local cpu
            cpu=$(container_exec inspect --format '{{.HostConfig.NanoCpus}}' "$container_id" 2>/dev/null)
            if [[ "$cpu" == "0" ]]; then
                ((no_cpu_limit++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total -eq 0 ]]; then
        add_result "CIS-DOCKER-5.9" "Container-Runtime" "CPU Limits" "PASS" "medium" \
            "Aucun conteneur actif" "" "CIS Docker 5.9"
    elif [[ $no_cpu_limit -eq 0 ]]; then
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
    total=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            ((total++))
            local readonly_fs
            readonly_fs=$(container_exec inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$container_id" 2>/dev/null)
            if [[ "$readonly_fs" != "true" ]]; then
                ((rw_root++))
            fi
        fi
    done < <(container_exec ps -q 2>/dev/null)
    
    if [[ $total -eq 0 ]]; then
        add_result "CIS-DOCKER-5.10" "Container-Runtime" "Read-only Root FS" "PASS" "medium" \
            "Aucun conteneur actif" "" "CIS Docker 5.10"
    elif [[ $rw_root -eq 0 ]]; then
        write_pass "Tous les conteneurs ont un FS root read-only"
        add_result "CIS-DOCKER-5.10" "Container-Runtime" "Read-only Root FS" "PASS" "medium" \
            "Filesystem immutable" "" "CIS Docker 5.10"
    else
        write_warn "$rw_root/$total conteneurs avec FS root en écriture"
        add_result "CIS-DOCKER-5.10" "Container-Runtime" "Read-only Root FS" "WARN" "medium" \
            "Filesystem modifiable" \
            "Utiliser --read-only" "CIS Docker 5.10"
    fi
}

#===============================================================================
# Vérifications Kubernetes CIS Level 1
#===============================================================================

check_kubernetes_control_plane() {
    if ! $KUBERNETES_AVAILABLE; then return; fi
    
    echo -e "\n${CYAN}=== Kubernetes Control Plane (CIS Section 1) ===${NC}\n"
    
    # 1.1.1 - API server pod spec permissions
    write_info "Vérification permissions API server..."
    local api_manifest="/etc/kubernetes/manifests/kube-apiserver.yaml"
    if [[ -f "$api_manifest" ]]; then
        local perms
        perms=$(stat -c "%a" "$api_manifest" 2>/dev/null)
        if [[ "$perms" -le 600 ]]; then
            write_pass "kube-apiserver.yaml permissions: $perms"
            add_result "CIS-K8S-1.1.1" "K8s-ControlPlane" "API Server Manifest" "PASS" "high" \
                "Permissions correctes: $perms" "" "CIS Kubernetes 1.1.1"
        else
            write_fail "kube-apiserver.yaml trop permissif: $perms"
            add_result "CIS-K8S-1.1.1" "K8s-ControlPlane" "API Server Manifest" "FAIL" "high" \
                "Permissions trop larges" \
                "chmod 600 $api_manifest" "CIS Kubernetes 1.1.1"
        fi
    else
        write_info "Manifest API server non trouvé (managed cluster?)"
        add_result "CIS-K8S-1.1.1" "K8s-ControlPlane" "API Server Manifest" "PASS" "high" \
            "Cluster managé ou manifest non local" "" "CIS Kubernetes 1.1.1"
    fi
    
    # 1.1.2 - Controller manager pod spec
    write_info "Vérification permissions controller-manager..."
    local cm_manifest="/etc/kubernetes/manifests/kube-controller-manager.yaml"
    if [[ -f "$cm_manifest" ]]; then
        local perms
        perms=$(stat -c "%a" "$cm_manifest" 2>/dev/null)
        if [[ "$perms" -le 600 ]]; then
            write_pass "controller-manager.yaml permissions: $perms"
            add_result "CIS-K8S-1.1.2" "K8s-ControlPlane" "Controller Manager Manifest" "PASS" "high" \
                "Permissions correctes" "" "CIS Kubernetes 1.1.2"
        else
            write_fail "controller-manager.yaml trop permissif"
            add_result "CIS-K8S-1.1.2" "K8s-ControlPlane" "Controller Manager Manifest" "FAIL" "high" \
                "Permissions trop larges" \
                "chmod 600 $cm_manifest" "CIS Kubernetes 1.1.2"
        fi
    fi
    
    # 1.1.3 - Scheduler pod spec
    write_info "Vérification permissions scheduler..."
    local sched_manifest="/etc/kubernetes/manifests/kube-scheduler.yaml"
    if [[ -f "$sched_manifest" ]]; then
        local perms
        perms=$(stat -c "%a" "$sched_manifest" 2>/dev/null)
        if [[ "$perms" -le 600 ]]; then
            write_pass "kube-scheduler.yaml permissions: $perms"
            add_result "CIS-K8S-1.1.3" "K8s-ControlPlane" "Scheduler Manifest" "PASS" "high" \
                "Permissions correctes" "" "CIS Kubernetes 1.1.3"
        else
            write_fail "kube-scheduler.yaml trop permissif"
            add_result "CIS-K8S-1.1.3" "K8s-ControlPlane" "Scheduler Manifest" "FAIL" "high" \
                "Permissions trop larges" \
                "chmod 600 $sched_manifest" "CIS Kubernetes 1.1.3"
        fi
    fi
    
    # 1.2.1 - Anonymous auth disabled
    write_info "Vérification authentification anonyme..."
    if kubectl get --raw /api 2>&1 | grep -qi "forbidden\|unauthorized"; then
        write_pass "Authentification anonyme désactivée"
        add_result "CIS-K8S-1.2.1" "K8s-ControlPlane" "Anonymous Auth" "PASS" "critical" \
            "Accès anonyme refusé" "" "CIS Kubernetes 1.2.1"
    else
        write_warn "Authentification anonyme potentiellement active"
        add_result "CIS-K8S-1.2.1" "K8s-ControlPlane" "Anonymous Auth" "WARN" "critical" \
            "Vérifier --anonymous-auth=false" \
            "Configurer --anonymous-auth=false sur l'API server" "CIS Kubernetes 1.2.1"
    fi
    
    # 1.2.2 - Token auth file
    write_info "Vérification token auth file..."
    if ! pgrep -a kube-apiserver 2>/dev/null | grep -q "token-auth-file"; then
        write_pass "Token auth file non utilisé"
        add_result "CIS-K8S-1.2.2" "K8s-ControlPlane" "Token Auth File" "PASS" "high" \
            "Authentification par fichier désactivée" "" "CIS Kubernetes 1.2.2"
    else
        write_fail "Token auth file utilisé"
        add_result "CIS-K8S-1.2.2" "K8s-ControlPlane" "Token Auth File" "FAIL" "high" \
            "Authentification statique non sécurisée" \
            "Retirer --token-auth-file" "CIS Kubernetes 1.2.2"
    fi
    
    # 1.2.3 - Audit logging
    write_info "Vérification audit logging..."
    if kubectl get pods -n kube-system 2>/dev/null | grep -qi "audit\|logging"; then
        write_pass "Audit logging probablement configuré"
        add_result "CIS-K8S-1.2.3" "K8s-ControlPlane" "Audit Logging" "PASS" "high" \
            "Audit logging détecté" "" "CIS Kubernetes 1.2.3"
    else
        write_warn "Audit logging à vérifier"
        add_result "CIS-K8S-1.2.3" "K8s-ControlPlane" "Audit Logging" "WARN" "high" \
            "Configuration audit non vérifiée" \
            "Configurer --audit-log-path" "CIS Kubernetes 1.2.3"
    fi
}

check_kubernetes_etcd() {
    if ! $KUBERNETES_AVAILABLE; then return; fi
    
    echo -e "\n${CYAN}=== Kubernetes etcd (CIS Section 2) ===${NC}\n"
    
    # 2.1 - etcd client cert auth
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
    
    # 2.3 - etcd data directory permissions
    write_info "Vérification permissions répertoire etcd..."
    local etcd_dir="/var/lib/etcd"
    if [[ -d "$etcd_dir" ]]; then
        local perms
        perms=$(stat -c "%a" "$etcd_dir" 2>/dev/null)
        if [[ "$perms" -le 700 ]]; then
            write_pass "Permissions etcd data: $perms"
            add_result "CIS-K8S-2.3" "K8s-etcd" "Data Directory" "PASS" "critical" \
                "Permissions correctes" "" "CIS Kubernetes 2.3"
        else
            write_fail "Permissions etcd trop larges: $perms"
            add_result "CIS-K8S-2.3" "K8s-etcd" "Data Directory" "FAIL" "critical" \
                "Données etcd exposées" \
                "chmod 700 $etcd_dir" "CIS Kubernetes 2.3"
        fi
    fi
}

check_kubernetes_worker() {
    if ! $KUBERNETES_AVAILABLE; then return; fi
    
    echo -e "\n${CYAN}=== Kubernetes Worker Nodes (CIS Section 4) ===${NC}\n"
    
    # 4.1.1 - Kubelet service file permissions
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
    
    # 4.2.2 - Kubelet authorization mode
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
    
    # 4.2.3 - Kubelet client certificate
    write_info "Vérification rotation certificats kubelet..."
    if pgrep -a kubelet 2>/dev/null | grep -q "rotate-certificates=true"; then
        write_pass "Rotation certificats kubelet activée"
        add_result "CIS-K8S-4.2.3" "K8s-Worker" "Certificate Rotation" "PASS" "high" \
            "Rotation automatique des certificats" "" "CIS Kubernetes 4.2.3"
    else
        write_warn "Rotation certificats kubelet à vérifier"
        add_result "CIS-K8S-4.2.3" "K8s-Worker" "Certificate Rotation" "WARN" "high" \
            "Vérifier --rotate-certificates=true" \
            "Activer la rotation des certificats" "CIS Kubernetes 4.2.3"
    fi
}

check_kubernetes_policies() {
    if ! $KUBERNETES_AVAILABLE; then return; fi
    
    echo -e "\n${CYAN}=== Kubernetes Policies (CIS Section 5) ===${NC}\n"
    
    # 5.1.1 - Cluster-admin role usage
    write_info "Vérification utilisation cluster-admin..."
    local admin_bindings
    admin_bindings=$(kubectl get clusterrolebindings -o json 2>/dev/null | grep -c '"cluster-admin"' || echo "0")
    if [[ "$admin_bindings" -le 2 ]]; then
        write_pass "Utilisation cluster-admin limitée: $admin_bindings bindings"
        add_result "CIS-K8S-5.1.1" "K8s-Policies" "Cluster-Admin Usage" "PASS" "high" \
            "Nombre limité de cluster-admin" "" "CIS Kubernetes 5.1.1"
    else
        write_warn "$admin_bindings bindings cluster-admin"
        add_result "CIS-K8S-5.1.1" "K8s-Policies" "Cluster-Admin Usage" "WARN" "high" \
            "Trop de comptes cluster-admin" \
            "Réduire les bindings cluster-admin" "CIS Kubernetes 5.1.1"
    fi
    
    # 5.1.2 - Pod Security Policies/Standards
    write_info "Vérification Pod Security..."
    if kubectl get podsecuritypolicies 2>/dev/null | grep -q "restricted\|baseline"; then
        write_pass "Pod Security Policies configurées"
        add_result "CIS-K8S-5.1.2" "K8s-Policies" "Pod Security" "PASS" "high" \
            "PSP/PSS en place" "" "CIS Kubernetes 5.1.2"
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
    
    # 5.2.1 - Default namespace usage
    write_info "Vérification utilisation namespace default..."
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
    
    # 5.2.2 - Namespaces with Network Policies
    write_info "Vérification Network Policies..."
    local ns_with_netpol
    ns_with_netpol=$(kubectl get networkpolicies --all-namespaces 2>/dev/null | grep -v "^NAMESPACE" | awk '{print $1}' | sort -u | wc -l)
    local total_ns
    total_ns=$(kubectl get namespaces 2>/dev/null | grep -v "^NAME" | wc -l)
    
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
    
    # 5.3.1 - Secrets encryption
    write_info "Vérification chiffrement secrets..."
    if kubectl get secrets -A 2>/dev/null | head -1 | grep -q "NAME"; then
        write_info "Secrets accessibles - vérifier chiffrement at rest"
        add_result "CIS-K8S-5.3.1" "K8s-Policies" "Secrets Encryption" "WARN" "critical" \
            "Vérifier encryption at rest" \
            "Configurer EncryptionConfiguration" "CIS Kubernetes 5.3.1"
    fi
    
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
    "standards": ["CIS Docker Benchmark 1.6", "CIS Kubernetes Benchmark 1.8"]
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
    <title>Container Compliance Report - Base</title>
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
        @media print { body { background: white; color: black; } .result-item, .score-card { background: #f1f5f9; } }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>Container & Orchestration Compliance</h1>
        <p>CIS Docker Benchmark 1.6 + CIS Kubernetes Benchmark 1.8 - Level 1</p>
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
