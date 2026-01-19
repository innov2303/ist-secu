/**
 * Base de données des contrôles de sécurité par standard
 * Utilisé pour suggérer des mises à jour aux toolkits
 */

export interface SecurityControl {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  reference: string;
  implementationHint?: string;
}

export interface StandardControls {
  standardId: string;
  standardName: string;
  version: string;
  lastUpdated: string;
  controls: SecurityControl[];
}

// OWASP Top 10 & Secure Headers Controls for Web Security
export const owaspWebControls: StandardControls = {
  standardId: "owasp-web",
  standardName: "OWASP Web Security",
  version: "2023",
  lastUpdated: "2024-01-01",
  controls: [
    // Headers HTTP
    { id: "OWASP-HDR-001", name: "Content-Security-Policy", description: "Protection contre XSS et injection de contenu", category: "Headers HTTP", severity: "critical", reference: "OWASP Secure Headers" },
    { id: "OWASP-HDR-002", name: "X-Content-Type-Options", description: "Prévention du MIME sniffing", category: "Headers HTTP", severity: "high", reference: "OWASP Secure Headers" },
    { id: "OWASP-HDR-003", name: "X-Frame-Options", description: "Protection contre le clickjacking", category: "Headers HTTP", severity: "high", reference: "OWASP Secure Headers" },
    { id: "OWASP-HDR-004", name: "Strict-Transport-Security", description: "Force HTTPS (HSTS)", category: "Headers HTTP", severity: "critical", reference: "OWASP Secure Headers" },
    { id: "OWASP-HDR-005", name: "Referrer-Policy", description: "Contrôle des informations referrer", category: "Headers HTTP", severity: "medium", reference: "OWASP Secure Headers" },
    { id: "OWASP-HDR-006", name: "Permissions-Policy", description: "Contrôle des fonctionnalités navigateur", category: "Headers HTTP", severity: "medium", reference: "OWASP Secure Headers" },
    { id: "OWASP-HDR-007", name: "Cross-Origin-Embedder-Policy", description: "Isolation cross-origin", category: "Headers HTTP", severity: "medium", reference: "MDN COEP" },
    { id: "OWASP-HDR-008", name: "Cross-Origin-Opener-Policy", description: "Isolation des fenêtres", category: "Headers HTTP", severity: "medium", reference: "MDN COOP" },
    { id: "OWASP-HDR-009", name: "Cross-Origin-Resource-Policy", description: "Protection des ressources", category: "Headers HTTP", severity: "medium", reference: "MDN CORP" },
    { id: "OWASP-HDR-010", name: "Cache-Control sécurisé", description: "Contrôle du cache pour données sensibles", category: "Headers HTTP", severity: "medium", reference: "OWASP Session Management" },
    { id: "OWASP-HDR-011", name: "Server Header masqué", description: "Masquage des informations serveur", category: "Headers HTTP", severity: "low", reference: "OWASP Information Leakage" },
    { id: "OWASP-HDR-012", name: "X-Powered-By supprimé", description: "Suppression des informations framework", category: "Headers HTTP", severity: "low", reference: "OWASP Information Leakage" },
    { id: "OWASP-HDR-013", name: "X-DNS-Prefetch-Control", description: "Contrôle du prefetch DNS", category: "Headers HTTP", severity: "low", reference: "OWASP Secure Headers" },
    { id: "OWASP-HDR-014", name: "Expect-CT", description: "Certificate Transparency", category: "Headers HTTP", severity: "medium", reference: "OWASP Secure Headers", implementationHint: "Vérifier la politique CT du certificat" },
    
    // TLS/SSL
    { id: "OWASP-TLS-001", name: "HTTPS obligatoire", description: "Forcer l'utilisation de HTTPS", category: "TLS/SSL", severity: "critical", reference: "OWASP Transport Layer Protection" },
    { id: "OWASP-TLS-002", name: "TLS 1.2 minimum", description: "Version TLS 1.2 ou supérieure", category: "TLS/SSL", severity: "critical", reference: "OWASP Transport Layer Protection" },
    { id: "OWASP-TLS-003", name: "TLS 1.3 recommandé", description: "Utilisation de TLS 1.3", category: "TLS/SSL", severity: "high", reference: "OWASP Transport Layer Protection" },
    { id: "OWASP-TLS-004", name: "Certificat valide", description: "Certificat SSL/TLS valide et non expiré", category: "TLS/SSL", severity: "critical", reference: "PKI Best Practices" },
    { id: "OWASP-TLS-005", name: "Chiffrement fort", description: "Suites de chiffrement AES-128 minimum", category: "TLS/SSL", severity: "high", reference: "OWASP Transport Layer Protection" },
    { id: "OWASP-TLS-006", name: "Perfect Forward Secrecy", description: "Support PFS (ECDHE)", category: "TLS/SSL", severity: "high", reference: "OWASP Transport Layer Protection", implementationHint: "Vérifier les suites ECDHE" },
    { id: "OWASP-TLS-007", name: "OCSP Stapling", description: "Vérification du statut certificat via OCSP", category: "TLS/SSL", severity: "medium", reference: "PKI Best Practices", implementationHint: "Vérifier la réponse OCSP" },
    { id: "OWASP-TLS-008", name: "Certificate Pinning", description: "Épinglage de certificat", category: "TLS/SSL", severity: "medium", reference: "OWASP Certificate Pinning", implementationHint: "Vérifier le header Public-Key-Pins" },
    
    // Cookies
    { id: "OWASP-COOKIE-001", name: "Attribut Secure", description: "Cookies transmis uniquement en HTTPS", category: "Cookies", severity: "high", reference: "OWASP Session Management" },
    { id: "OWASP-COOKIE-002", name: "Attribut HttpOnly", description: "Cookies inaccessibles via JavaScript", category: "Cookies", severity: "high", reference: "OWASP Session Management" },
    { id: "OWASP-COOKIE-003", name: "Attribut SameSite", description: "Protection CSRF via SameSite", category: "Cookies", severity: "high", reference: "OWASP Session Management" },
    { id: "OWASP-COOKIE-004", name: "Préfixe __Secure-", description: "Préfixe sécurisé pour cookies", category: "Cookies", severity: "medium", reference: "OWASP Session Management", implementationHint: "Vérifier les préfixes de cookies" },
    { id: "OWASP-COOKIE-005", name: "Préfixe __Host-", description: "Préfixe host-only pour cookies", category: "Cookies", severity: "medium", reference: "OWASP Session Management", implementationHint: "Vérifier les préfixes de cookies" },
    
    // Fichiers sensibles
    { id: "OWASP-FILE-001", name: "Git exposé", description: "Dossier .git inaccessible", category: "Fichiers Sensibles", severity: "critical", reference: "OWASP Information Leakage" },
    { id: "OWASP-FILE-002", name: "Fichiers .env", description: "Variables d'environnement protégées", category: "Fichiers Sensibles", severity: "critical", reference: "OWASP Information Leakage" },
    { id: "OWASP-FILE-003", name: "Backups exposés", description: "Fichiers de sauvegarde inaccessibles", category: "Fichiers Sensibles", severity: "critical", reference: "OWASP Information Leakage" },
    { id: "OWASP-FILE-004", name: "Source maps", description: "Source maps non exposées en production", category: "Fichiers Sensibles", severity: "medium", reference: "OWASP Information Leakage", implementationHint: "Vérifier l'accès aux fichiers .map" },
    { id: "OWASP-FILE-005", name: "Swagger/OpenAPI", description: "Documentation API protégée", category: "Fichiers Sensibles", severity: "medium", reference: "OWASP API Security", implementationHint: "Vérifier /swagger, /api-docs" },
    
    // Contenu
    { id: "OWASP-CONTENT-001", name: "Contenu mixte", description: "Pas de ressources HTTP sur HTTPS", category: "Contenu", severity: "high", reference: "OWASP Mixed Content" },
    { id: "OWASP-CONTENT-002", name: "Subresource Integrity", description: "SRI pour les CDN externes", category: "Contenu", severity: "medium", reference: "OWASP Subresource Integrity", implementationHint: "Vérifier les attributs integrity sur les scripts/styles externes" },
    { id: "OWASP-CONTENT-003", name: "Clickjacking frame-ancestors", description: "CSP frame-ancestors défini", category: "Contenu", severity: "high", reference: "OWASP Clickjacking", implementationHint: "Vérifier CSP frame-ancestors" },
    
    // API Security
    { id: "OWASP-API-001", name: "Rate limiting headers", description: "Headers de limitation de débit", category: "API", severity: "medium", reference: "OWASP API Security", implementationHint: "Vérifier X-RateLimit-* headers" },
    { id: "OWASP-API-002", name: "CORS restrictif", description: "Configuration CORS sécurisée", category: "API", severity: "high", reference: "OWASP CORS" },
  ]
};

// ANSSI-BP-028 Controls for Linux
export const anssiBp028Controls: StandardControls = {
  standardId: "anssi-bp-028",
  standardName: "ANSSI-BP-028 Linux",
  version: "2.0",
  lastUpdated: "2024-06-01",
  controls: [
    // Partitionnement
    { id: "ANSSI-PART-001", name: "Partitions séparées", description: "Séparation /home, /tmp, /var, /var/log", category: "Partitionnement", severity: "high", reference: "ANSSI-BP-028 R1" },
    { id: "ANSSI-PART-002", name: "Options noexec", description: "noexec sur /tmp, /var/tmp", category: "Partitionnement", severity: "high", reference: "ANSSI-BP-028 R2" },
    { id: "ANSSI-PART-003", name: "Options nosuid", description: "nosuid sur partitions non-système", category: "Partitionnement", severity: "medium", reference: "ANSSI-BP-028 R3" },
    { id: "ANSSI-PART-004", name: "Chiffrement LUKS", description: "Partitions sensibles chiffrées", category: "Partitionnement", severity: "high", reference: "ANSSI-BP-028 R4" },
    
    // Comptes utilisateurs
    { id: "ANSSI-USER-001", name: "Politique mots de passe", description: "Complexité et expiration des mots de passe", category: "Comptes", severity: "high", reference: "ANSSI-BP-028 R10" },
    { id: "ANSSI-USER-002", name: "Verrouillage comptes", description: "Verrouillage après échecs d'authentification", category: "Comptes", severity: "high", reference: "ANSSI-BP-028 R11" },
    { id: "ANSSI-USER-003", name: "Comptes système", description: "Shell nologin pour comptes système", category: "Comptes", severity: "medium", reference: "ANSSI-BP-028 R12" },
    { id: "ANSSI-USER-004", name: "UID 0 unique", description: "Seul root avec UID 0", category: "Comptes", severity: "critical", reference: "ANSSI-BP-028 R13" },
    { id: "ANSSI-USER-005", name: "Sudo configuration", description: "Configuration sudo sécurisée", category: "Comptes", severity: "high", reference: "ANSSI-BP-028 R14" },
    
    // SSH
    { id: "ANSSI-SSH-001", name: "SSH Protocol 2", description: "Protocol SSH version 2 uniquement", category: "SSH", severity: "critical", reference: "ANSSI-BP-028 R20" },
    { id: "ANSSI-SSH-002", name: "SSH PermitRootLogin", description: "Connexion root directe interdite", category: "SSH", severity: "critical", reference: "ANSSI-BP-028 R21" },
    { id: "ANSSI-SSH-003", name: "SSH clés uniquement", description: "Authentification par clés SSH", category: "SSH", severity: "high", reference: "ANSSI-BP-028 R22" },
    { id: "ANSSI-SSH-004", name: "SSH Idle Timeout", description: "Déconnexion après inactivité", category: "SSH", severity: "medium", reference: "ANSSI-BP-028 R23" },
    { id: "ANSSI-SSH-005", name: "SSH Algorithms", description: "Algorithmes cryptographiques forts", category: "SSH", severity: "high", reference: "ANSSI-BP-028 R24" },
    
    // Kernel
    { id: "ANSSI-KERN-001", name: "ASLR activé", description: "Randomisation de l'espace d'adressage", category: "Kernel", severity: "high", reference: "ANSSI-BP-028 R30" },
    { id: "ANSSI-KERN-002", name: "Kernel modules signés", description: "Vérification des signatures modules", category: "Kernel", severity: "high", reference: "ANSSI-BP-028 R31" },
    { id: "ANSSI-KERN-003", name: "Sysctl hardening", description: "Paramètres sysctl sécurisés", category: "Kernel", severity: "high", reference: "ANSSI-BP-028 R32" },
    { id: "ANSSI-KERN-004", name: "Core dumps désactivés", description: "Pas de core dumps sensibles", category: "Kernel", severity: "medium", reference: "ANSSI-BP-028 R33" },
    
    // Services
    { id: "ANSSI-SVC-001", name: "Services minimaux", description: "Services non essentiels désactivés", category: "Services", severity: "high", reference: "ANSSI-BP-028 R40" },
    { id: "ANSSI-SVC-002", name: "Services réseau", description: "Services réseau inutiles désactivés", category: "Services", severity: "high", reference: "ANSSI-BP-028 R41" },
    { id: "ANSSI-SVC-003", name: "Systemd hardening", description: "Isolation des services systemd", category: "Services", severity: "medium", reference: "ANSSI-BP-028 R42" },
    
    // Réseau
    { id: "ANSSI-NET-001", name: "Firewall activé", description: "iptables/nftables configuré", category: "Réseau", severity: "critical", reference: "ANSSI-BP-028 R50" },
    { id: "ANSSI-NET-002", name: "IPv6 sécurisé", description: "IPv6 désactivé ou sécurisé", category: "Réseau", severity: "medium", reference: "ANSSI-BP-028 R51" },
    { id: "ANSSI-NET-003", name: "Network parameters", description: "Paramètres réseau kernel sécurisés", category: "Réseau", severity: "high", reference: "ANSSI-BP-028 R52" },
    
    // Journalisation
    { id: "ANSSI-LOG-001", name: "Audit activé", description: "auditd configuré et actif", category: "Journalisation", severity: "high", reference: "ANSSI-BP-028 R60" },
    { id: "ANSSI-LOG-002", name: "Logs protégés", description: "Permissions restrictives sur logs", category: "Journalisation", severity: "medium", reference: "ANSSI-BP-028 R61" },
    { id: "ANSSI-LOG-003", name: "Log rotation", description: "Rotation des logs configurée", category: "Journalisation", severity: "medium", reference: "ANSSI-BP-028 R62" },
    
    // SELinux/AppArmor
    { id: "ANSSI-MAC-001", name: "MAC activé", description: "SELinux ou AppArmor actif", category: "Contrôle d'accès", severity: "high", reference: "ANSSI-BP-028 R70" },
    { id: "ANSSI-MAC-002", name: "Mode enforcing", description: "MAC en mode enforcing", category: "Contrôle d'accès", severity: "high", reference: "ANSSI-BP-028 R71" },
  ]
};

// CIS Benchmark Controls for Windows
export const cisWindowsControls: StandardControls = {
  standardId: "cis-windows",
  standardName: "CIS Benchmark Windows",
  version: "3.0",
  lastUpdated: "2024-03-01",
  controls: [
    // Comptes
    { id: "CIS-WIN-001", name: "Compte Administrateur renommé", description: "Renommer le compte Administrator", category: "Comptes", severity: "medium", reference: "CIS 1.1.1" },
    { id: "CIS-WIN-002", name: "Compte Guest désactivé", description: "Compte invité désactivé", category: "Comptes", severity: "high", reference: "CIS 1.1.2" },
    { id: "CIS-WIN-003", name: "Politique mots de passe", description: "Longueur et complexité des mots de passe", category: "Comptes", severity: "high", reference: "CIS 1.2" },
    { id: "CIS-WIN-004", name: "Verrouillage compte", description: "Verrouillage après tentatives échouées", category: "Comptes", severity: "high", reference: "CIS 1.3" },
    
    // Audit
    { id: "CIS-WIN-010", name: "Audit logon events", description: "Audit des connexions", category: "Audit", severity: "high", reference: "CIS 2.1" },
    { id: "CIS-WIN-011", name: "Audit policy changes", description: "Audit des changements de politique", category: "Audit", severity: "high", reference: "CIS 2.2" },
    { id: "CIS-WIN-012", name: "Audit privilege use", description: "Audit de l'utilisation des privilèges", category: "Audit", severity: "medium", reference: "CIS 2.3" },
    
    // Droits utilisateurs
    { id: "CIS-WIN-020", name: "SeNetworkLogonRight", description: "Accès réseau restreint", category: "Droits", severity: "high", reference: "CIS 3.1" },
    { id: "CIS-WIN-021", name: "SeDenyNetworkLogonRight", description: "Refus d'accès réseau configuré", category: "Droits", severity: "high", reference: "CIS 3.2" },
    { id: "CIS-WIN-022", name: "SeRemoteInteractiveLogonRight", description: "Bureau à distance restreint", category: "Droits", severity: "high", reference: "CIS 3.3" },
    
    // Options de sécurité
    { id: "CIS-WIN-030", name: "UAC activé", description: "User Account Control actif", category: "Sécurité", severity: "critical", reference: "CIS 4.1" },
    { id: "CIS-WIN-031", name: "LSASS Protection", description: "Protection du processus LSASS", category: "Sécurité", severity: "high", reference: "CIS 4.2" },
    { id: "CIS-WIN-032", name: "Credential Guard", description: "Windows Credential Guard activé", category: "Sécurité", severity: "high", reference: "CIS 4.3" },
    { id: "CIS-WIN-033", name: "BitLocker", description: "Chiffrement des disques", category: "Sécurité", severity: "high", reference: "CIS 4.4" },
    
    // Réseau
    { id: "CIS-WIN-040", name: "Windows Firewall", description: "Pare-feu Windows activé", category: "Réseau", severity: "critical", reference: "CIS 5.1" },
    { id: "CIS-WIN-041", name: "SMB Signing", description: "Signature SMB requise", category: "Réseau", severity: "high", reference: "CIS 5.2" },
    { id: "CIS-WIN-042", name: "LDAP Signing", description: "Signature LDAP requise", category: "Réseau", severity: "high", reference: "CIS 5.3" },
    
    // Services
    { id: "CIS-WIN-050", name: "Services inutiles", description: "Services non essentiels désactivés", category: "Services", severity: "medium", reference: "CIS 6.1" },
    { id: "CIS-WIN-051", name: "Remote Desktop sécurisé", description: "NLA activé pour RDP", category: "Services", severity: "high", reference: "CIS 6.2" },
    { id: "CIS-WIN-052", name: "WinRM sécurisé", description: "Configuration WinRM sécurisée", category: "Services", severity: "high", reference: "CIS 6.3" },
  ]
};

// CIS Docker Controls
export const cisDockerControls: StandardControls = {
  standardId: "cis-docker",
  standardName: "CIS Docker Benchmark",
  version: "1.6",
  lastUpdated: "2024-02-01",
  controls: [
    // Host
    { id: "CIS-DOCKER-001", name: "Partition Docker séparée", description: "/var/lib/docker sur partition dédiée", category: "Host", severity: "high", reference: "CIS Docker 1.1" },
    { id: "CIS-DOCKER-002", name: "Version Docker à jour", description: "Dernière version stable", category: "Host", severity: "high", reference: "CIS Docker 1.2" },
    { id: "CIS-DOCKER-003", name: "Audit Docker", description: "Règles d'audit pour Docker", category: "Host", severity: "medium", reference: "CIS Docker 1.3" },
    
    // Daemon
    { id: "CIS-DOCKER-010", name: "Network namespace", description: "Isolation réseau des conteneurs", category: "Daemon", severity: "high", reference: "CIS Docker 2.1" },
    { id: "CIS-DOCKER-011", name: "TLS pour Docker API", description: "API Docker sécurisée par TLS", category: "Daemon", severity: "critical", reference: "CIS Docker 2.2" },
    { id: "CIS-DOCKER-012", name: "Ulimits par défaut", description: "Limites de ressources configurées", category: "Daemon", severity: "medium", reference: "CIS Docker 2.3" },
    { id: "CIS-DOCKER-013", name: "User namespace", description: "Remapping des utilisateurs", category: "Daemon", severity: "high", reference: "CIS Docker 2.4" },
    
    // Images
    { id: "CIS-DOCKER-020", name: "Images de confiance", description: "Utilisation d'images vérifiées", category: "Images", severity: "high", reference: "CIS Docker 3.1" },
    { id: "CIS-DOCKER-021", name: "Content Trust", description: "Docker Content Trust activé", category: "Images", severity: "high", reference: "CIS Docker 3.2" },
    { id: "CIS-DOCKER-022", name: "Images rootless", description: "Utiliser des utilisateurs non-root", category: "Images", severity: "high", reference: "CIS Docker 3.3" },
    
    // Conteneurs
    { id: "CIS-DOCKER-030", name: "Capabilities restreintes", description: "Capabilities minimales", category: "Conteneurs", severity: "high", reference: "CIS Docker 4.1" },
    { id: "CIS-DOCKER-031", name: "Pas de --privileged", description: "Mode privilégié interdit", category: "Conteneurs", severity: "critical", reference: "CIS Docker 4.2" },
    { id: "CIS-DOCKER-032", name: "Read-only filesystem", description: "Système de fichiers en lecture seule", category: "Conteneurs", severity: "medium", reference: "CIS Docker 4.3" },
    { id: "CIS-DOCKER-033", name: "PID namespace", description: "Isolation PID namespace", category: "Conteneurs", severity: "medium", reference: "CIS Docker 4.4" },
    { id: "CIS-DOCKER-034", name: "Seccomp profile", description: "Profil Seccomp appliqué", category: "Conteneurs", severity: "high", reference: "CIS Docker 4.5" },
    { id: "CIS-DOCKER-035", name: "AppArmor/SELinux", description: "Profil MAC appliqué", category: "Conteneurs", severity: "high", reference: "CIS Docker 4.6" },
    
    // Réseau
    { id: "CIS-DOCKER-040", name: "Pas de docker0 bridge", description: "Réseau bridge personnalisé", category: "Réseau", severity: "medium", reference: "CIS Docker 5.1" },
    { id: "CIS-DOCKER-041", name: "ICC désactivé", description: "Inter-container communication restreinte", category: "Réseau", severity: "high", reference: "CIS Docker 5.2" },
  ]
};

// CIS VMware ESXi Controls
export const cisVmwareControls: StandardControls = {
  standardId: "cis-vmware",
  standardName: "CIS VMware ESXi Benchmark",
  version: "1.5",
  lastUpdated: "2024-01-15",
  controls: [
    // Réseau
    { id: "CIS-ESXI-001", name: "vSwitch Forged Transmits", description: "Reject forged transmits", category: "Réseau", severity: "high", reference: "CIS ESXi 1.1" },
    { id: "CIS-ESXI-002", name: "vSwitch MAC Changes", description: "Reject MAC changes", category: "Réseau", severity: "high", reference: "CIS ESXi 1.2" },
    { id: "CIS-ESXI-003", name: "vSwitch Promiscuous Mode", description: "Reject promiscuous mode", category: "Réseau", severity: "high", reference: "CIS ESXi 1.3" },
    { id: "CIS-ESXI-004", name: "VLAN configuration", description: "VLANs correctement configurés", category: "Réseau", severity: "medium", reference: "CIS ESXi 1.4" },
    
    // Stockage
    { id: "CIS-ESXI-010", name: "NFS sécurisé", description: "Configuration NFS sécurisée", category: "Stockage", severity: "high", reference: "CIS ESXi 2.1" },
    { id: "CIS-ESXI-011", name: "iSCSI CHAP", description: "Authentification CHAP pour iSCSI", category: "Stockage", severity: "high", reference: "CIS ESXi 2.2" },
    { id: "CIS-ESXI-012", name: "VMFS intégrité", description: "Vérification intégrité VMFS", category: "Stockage", severity: "medium", reference: "CIS ESXi 2.3" },
    
    // Services
    { id: "CIS-ESXI-020", name: "SSH désactivé", description: "Service SSH désactivé", category: "Services", severity: "high", reference: "CIS ESXi 3.1" },
    { id: "CIS-ESXI-021", name: "Shell désactivé", description: "ESXi Shell désactivé", category: "Services", severity: "high", reference: "CIS ESXi 3.2" },
    { id: "CIS-ESXI-022", name: "NTP configuré", description: "Synchronisation NTP", category: "Services", severity: "medium", reference: "CIS ESXi 3.3" },
    { id: "CIS-ESXI-023", name: "SNMP sécurisé", description: "SNMP v3 ou désactivé", category: "Services", severity: "high", reference: "CIS ESXi 3.4" },
    
    // Logs
    { id: "CIS-ESXI-030", name: "Syslog distant", description: "Logs envoyés à un serveur distant", category: "Journalisation", severity: "high", reference: "CIS ESXi 4.1" },
    { id: "CIS-ESXI-031", name: "Rotation logs", description: "Rotation des logs configurée", category: "Journalisation", severity: "medium", reference: "CIS ESXi 4.2" },
    
    // Accès
    { id: "CIS-ESXI-040", name: "Timeout session", description: "Timeout des sessions configuré", category: "Accès", severity: "medium", reference: "CIS ESXi 5.1" },
    { id: "CIS-ESXI-041", name: "Lockdown mode", description: "Mode lockdown activé", category: "Accès", severity: "high", reference: "CIS ESXi 5.2" },
    { id: "CIS-ESXI-042", name: "TLS 1.2", description: "TLS 1.2 minimum", category: "Accès", severity: "critical", reference: "CIS ESXi 5.3" },
  ]
};

// NetApp Security Hardening Guide Controls
export const netappControls: StandardControls = {
  standardId: "netapp-hardening",
  standardName: "NetApp Security Hardening Guide",
  version: "ONTAP 9",
  lastUpdated: "2024-04-01",
  controls: [
    // Authentification
    { id: "NETAPP-AUTH-001", name: "Multi-admin verification", description: "Vérification multi-admin activée", category: "Authentification", severity: "high", reference: "NetApp TR-4569" },
    { id: "NETAPP-AUTH-002", name: "LDAP/AD intégration", description: "Authentification centralisée", category: "Authentification", severity: "high", reference: "NetApp TR-4569" },
    { id: "NETAPP-AUTH-003", name: "SSH sécurisé", description: "Algorithmes SSH forts", category: "Authentification", severity: "high", reference: "NetApp TR-4569" },
    { id: "NETAPP-AUTH-004", name: "SAML/MFA", description: "Authentification multifacteur", category: "Authentification", severity: "high", reference: "NetApp TR-4569" },
    
    // Chiffrement
    { id: "NETAPP-ENC-001", name: "NAE/NVE", description: "Chiffrement des volumes", category: "Chiffrement", severity: "high", reference: "NetApp TR-4569" },
    { id: "NETAPP-ENC-002", name: "TLS 1.2", description: "Protocoles TLS sécurisés", category: "Chiffrement", severity: "critical", reference: "NetApp TR-4569" },
    { id: "NETAPP-ENC-003", name: "SMB Encryption", description: "Chiffrement SMB activé", category: "Chiffrement", severity: "high", reference: "NetApp TR-4569" },
    { id: "NETAPP-ENC-004", name: "IPsec", description: "IPsec pour communications inter-cluster", category: "Chiffrement", severity: "medium", reference: "NetApp TR-4569" },
    
    // Ransomware
    { id: "NETAPP-ARP-001", name: "ARP activé", description: "Anti-ransomware Protection", category: "Anti-ransomware", severity: "critical", reference: "NetApp TR-4572" },
    { id: "NETAPP-ARP-002", name: "SnapLock", description: "Volumes SnapLock Compliance", category: "Anti-ransomware", severity: "high", reference: "NetApp TR-4572" },
    { id: "NETAPP-ARP-003", name: "FPolicy", description: "Monitoring FPolicy", category: "Anti-ransomware", severity: "high", reference: "NetApp TR-4572" },
    
    // Audit
    { id: "NETAPP-AUDIT-001", name: "Audit NAS", description: "Audit des accès NAS", category: "Audit", severity: "high", reference: "NetApp TR-4569" },
    { id: "NETAPP-AUDIT-002", name: "EMS configuré", description: "Event Management System", category: "Audit", severity: "medium", reference: "NetApp TR-4569" },
    { id: "NETAPP-AUDIT-003", name: "ONTAP logging", description: "Journalisation complète", category: "Audit", severity: "high", reference: "NetApp TR-4569" },
    
    // Réseau
    { id: "NETAPP-NET-001", name: "FIPS mode", description: "Mode FIPS 140-2 activé", category: "Réseau", severity: "high", reference: "NetApp TR-4569" },
    { id: "NETAPP-NET-002", name: "Protocols désactivés", description: "Protocoles legacy désactivés", category: "Réseau", severity: "high", reference: "NetApp TR-4569" },
    { id: "NETAPP-NET-003", name: "Firewall policies", description: "Politiques firewall LIF", category: "Réseau", severity: "high", reference: "NetApp TR-4569" },
  ]
};

// Mapping des toolkits aux standards
export const toolkitStandardsMapping: Record<string, string[]> = {
  "Windows": ["cis-windows"],
  "Linux": ["anssi-bp-028"],
  "VMware": ["cis-vmware"],
  "Containers": ["cis-docker"],
  "NetApp": ["netapp-hardening"],
  "Web": ["owasp-web"],
};

// Récupérer tous les contrôles pour un standard
export function getControlsForStandard(standardId: string): StandardControls | null {
  switch (standardId) {
    case "owasp-web": return owaspWebControls;
    case "anssi-bp-028": return anssiBp028Controls;
    case "cis-windows": return cisWindowsControls;
    case "cis-docker": return cisDockerControls;
    case "cis-vmware": return cisVmwareControls;
    case "netapp-hardening": return netappControls;
    default: return null;
  }
}

// Récupérer tous les contrôles pour un OS de toolkit
export function getControlsForToolkitOS(os: string): StandardControls[] {
  const standardIds = toolkitStandardsMapping[os] || [];
  return standardIds.map(id => getControlsForStandard(id)).filter(Boolean) as StandardControls[];
}
