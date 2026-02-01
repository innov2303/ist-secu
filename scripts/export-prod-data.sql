-- Export des données IST pour la base de production
-- Généré automatiquement depuis la base de développement
-- À exécuter sur le VPS : psql -U ist_secu_user -d ist_secu_db -f export-prod-data.sql

-- ============================================================
-- SCRIPTS / TOOLKITS
-- ============================================================

INSERT INTO scripts (id, os, name, description, filename, icon, compliance, features, price_cents, monthly_price_cents, bundled_script_ids, is_hidden, status, version) VALUES
(5, 'Windows', 'Windows Compliance Toolkit', 'Bundle complet incluant les scripts Base (~80 contrôles) et Enhanced (~125 contrôles) pour Windows Server.

🏷️ Standards: ANSSI-BP-028 | CIS Benchmark Level 1 & 2

Compatible Windows Server 2016, 2019, 2022 et 2025. Requiert PowerShell 5.1 ou supérieur avec privilèges administrateur.', 'windows-compliance-toolkit.zip', 'Monitor', 'ANSSI & CIS', '{"Bundle Base + Enhanced","~125 contrôles total","Credential Guard, LSASS Protection","Chiffrement TLS/SSL avancé","Attack Surface Reduction","Rapport HTML/JSON détaillé"}', 0, 8000, '{11,12}', 0, 'active', '1.0.0'),

(10, 'Linux', 'Linux Compliance Toolkit', 'Pack complet d''audit de conformité Linux. Inclut les versions Base (~115 contrôles) et Renforcée (~215 contrôles).

🏷️ Standards: ANSSI-BP-028 | CIS Benchmark Level 1 & 2

Compatible Debian/Ubuntu, Red Hat/CentOS, Fedora, SUSE. Fonctionnement limité sur les distributions non listées.', 'linux-compliance-toolkit.zip', 'Terminal', 'ANSSI-BP-028 + CIS Benchmark', '{"Base + Enhanced","~215 contrôles total","ANSSI + CIS","Rapports HTML/JSON"}', 0, 8000, '{6,9}', 0, 'active', '1.0.0'),

(7, 'VMware', 'VMware Compliance Toolkit', 'Pack complet d''audit de conformité VMware ESXi. Inclut les versions Base (~75 contrôles) et Enhanced (~165 contrôles).

🏷️ Standards: CIS Benchmark | DISA STIG CAT I & CAT II

Compatible ESXi 7.0 et 8.0. Exécution depuis Windows avec PowerShell 5.1+ et VMware PowerCLI.', 'vmware-esxi-compliance-toolkit.zip', 'Server', 'CIS', '{"Base + Enhanced","~165 contrôles total","CIS Benchmark","PowerCLI","Rapports HTML/JSON"}', 0, 10000, '{13,14}', 0, 'development', '1.0.0'),

(8, 'Containers', 'Container & Orchestration Toolkit', 'Pack complet d''audit de conformité pour environnements conteneurisés. Inclut les versions Base (~135 contrôles) et Enhanced (~160 contrôles).

🏷️ Standards: CIS Benchmark Docker | CIS Benchmark Kubernetes

Compatible Docker 20.10+, Podman 4.0+ (via API Docker-compatible), Kubernetes 1.25+.', 'container-orchestration-toolkit.zip', 'Container', 'CIS Docker & Kubernetes', '{"Base + Enhanced","~160 contrôles total","CIS Docker + Kubernetes","Rapports HTML/JSON"}', 0, 10000, '{16,17}', 0, 'development', '1.0.0'),

(18, 'NetApp', 'NetApp ONTAP Compliance Base', 'Script d''audit de securite pour les clusters NetApp ONTAP.
Effectue ~70 controles essentiels bases sur le NetApp Security Hardening Guide et DISA STIG.
Verifie l''authentification, les protocoles reseau, le chiffrement, l''audit et la protection des donnees.', 'netapp-ontap-compliance-base.ps1', 'SiNetapp', 'NetApp Security Hardening Guide + DISA STIG', '{"~70 controles de securite essentiels","Verification authentification et RBAC","Audit protocoles SSL/TLS et SSH","Verification chiffrement NVE/NAE","Analyse protection anti-ransomware","Verification SnapMirror et snapshots","Controle acces NFS/CIFS/SMB","Rapport HTML et JSON avec score"}', 0, 35000, NULL, 1, 'active', '1.0.0'),

(19, 'NetApp', 'NetApp ONTAP Compliance Enhanced', 'Script d''audit de securite avance pour les clusters NetApp ONTAP.
Effectue ~120 controles approfondis bases sur le NetApp Security Hardening Guide, DISA STIG et bonnes pratiques.
Inclut des verifications avancees de chiffrement, authentification MFA, mode FIPS et protection des donnees.', 'netapp-ontap-compliance-enhanced.ps1', 'SiNetapp', 'NetApp Security Hardening Guide + DISA STIG (Full)', '{"~120 controles de securite avances","Verification MFA et SAML SSO","Audit complet suites de chiffrement","Verification mode FIPS 140-2","Analyse IPsec pour iSCSI","Verification SnapLock WORM","Controle separation reseau gestion/donnees","Analyse certificats SSL et expiration","Verification authentification CHAP iSCSI","Rapport HTML et JSON detaille"}', 0, 35000, NULL, 1, 'active', '1.0.0'),

(6, 'Linux', 'Linux Compliance Base', 'Audit de conformité Linux (version Base) couvrant ~115 contrôles ANSSI-BP-028 et CIS Level 1 : partitionnement, comptes, SSH, réseau, permissions, services, journalisation, sécurité kernel.', 'linux-compliance-base.sh', 'Terminal', 'ANSSI-BP-028 + CIS L1', '{"~115 contrôles","ANSSI-BP-028 essentiel","CIS Level 1","Rapport HTML/JSON","Synchronisation temps","Permissions fichiers"}', 0, 30000, NULL, 1, 'active', '1.0.0'),

(9, 'Linux', 'Linux Compliance Enhanced', 'Audit de conformité Linux (version Renforcée) couvrant ~215 contrôles ANSSI-BP-028 et CIS Level 2 : kernel hardening avancé, SELinux/AppArmor, PAM, chiffrement LUKS, sécurité systemd et conteneurs.', 'linux-compliance-enhanced.sh', 'Terminal', 'ANSSI-BP-028 + CIS L2', '{"~215 contrôles","ANSSI-BP-028 complet","CIS Level 2","Kernel hardening","SELinux/AppArmor","Chiffrement LUKS","Sécurité conteneurs"}', 0, 30000, NULL, 1, 'active', '1.0.0'),

(11, 'Windows', 'Windows Compliance Base', 'Audit de sécurité de base pour Windows Server couvrant ~80 contrôles ANSSI et CIS Level 1 : configuration système, comptes, services, pare-feu, audit et réseau.', 'windows-compliance-base.ps1', 'Monitor', 'ANSSI + CIS L1', '{"~80 contrôles essentiels","Rapport HTML/JSON","Score de conformité A-F","Recommandations de correction","Compatible Windows Server 2016+"}', 0, 30000, NULL, 1, 'active', '1.0.0'),

(12, 'Windows', 'Windows Compliance Enhanced', 'Audit de sécurité renforcé pour Windows Server couvrant ~125 contrôles ANSSI et CIS Level 2 : Credential Guard, LSASS Protection, WDigest, TLS/SSL, SEHOP, ASLR et plus.', 'windows-compliance-enhanced.ps1', 'Monitor', 'ANSSI + CIS L2', '{"~125 contrôles complets","Credential Guard","LSASS Protection","Chiffrement TLS avancé","Attack Surface Reduction","Rapport HTML/JSON détaillé"}', 0, 30000, NULL, 1, 'active', '1.0.0'),

(13, 'VMware', 'VMware ESXi Compliance - Base', 'Script d''audit VMware ESXi (Base) couvrant ~75 contrôles CIS 7.0/8.0 : réseau, stockage, services, accès et configuration de base.', 'vmware-esxi-compliance-base.ps1', 'Server', 'CIS Benchmark', '{"~75 contrôles","CIS VMware ESXi","PowerCLI","Rapport HTML/JSON","Audit réseau et services"}', 0, 40000, NULL, 1, 'active', '1.0.0'),

(14, 'VMware', 'VMware ESXi Compliance - Enhanced', 'Script d''audit VMware ESXi (Enhanced) couvrant ~165 contrôles CIS 7.0/8.0 + renforcements : sécurité mémoire, TLS, mode Lockdown, audit VMs et stockage.', 'vmware-esxi-compliance-enhanced.ps1', 'Server', 'CIS Benchmark + Avancé', '{"~165 contrôles","CIS Benchmark complet","Contrôles avancés","Memory/TLS/Lockdown","Audit VMs et stockage"}', 0, 40000, NULL, 1, 'active', '1.0.0'),

(16, 'Containers', 'Container Compliance Base', 'Script d''audit de conformité conteneurs (Base) couvrant ~135 contrôles CIS Docker & Kubernetes Level 1 : daemon, images, réseaux, volumes, RBAC.', 'container-compliance-base.sh', 'container', 'CIS Docker & Kubernetes L1', '{"~135 contrôles","CIS Level 1","Rapports HTML/JSON","Graphiques de score","Recommandations de correction"}', 50000, 30000, NULL, 1, 'active', '1.0.0'),

(17, 'Containers', 'Container Compliance Enhanced', 'Script d''audit de conformité conteneurs (Enhanced) couvrant ~160 contrôles CIS Docker & Kubernetes Level 2 : politiques réseau avancées, admission controllers, sécurité noyau.', 'container-compliance-enhanced.sh', 'container', 'CIS Docker & Kubernetes L1+L2', '{"~160 contrôles","CIS Level 2","Rapports HTML/JSON","Graphiques de score","Recommandations de correction"}', 50000, 30000, NULL, 1, 'active', '1.0.0'),

(21, 'Web', 'Web Security Base', 'Script d''audit de securite web de base avec environ 55 controles. Verifie les headers HTTP, la configuration TLS/SSL, les fichiers sensibles et les cookies.

Standards: OWASP Top 10 | ANSSI Recommandations Web

Execution PowerShell depuis Windows. Compatible avec tout site web accessible.', 'web-security-base.ps1', 'Globe', 'OWASP + ANSSI', '{"~55 controles de securite","Headers HTTP (CSP, HSTS, X-Frame)","Configuration TLS/SSL","Detection fichiers sensibles","Securite des cookies","Rapports HTML/JSON"}', 0, 20000, NULL, 1, 'active', '1.0.0'),

(22, 'Web', 'Web Security Enhanced', 'Script d''audit de securite web avance avec environ 95 controles. Inclut tous les controles de base plus l''analyse DNS, CORS, detection des technologies et analyse du contenu.

Standards: OWASP Top 10 | ANSSI | CIS Benchmark

Execution PowerShell depuis Windows. Option Deep Scan pour analyse approfondie.', 'web-security-enhanced.ps1', 'Globe', 'OWASP + ANSSI + CIS', '{"~95 controles avances","Tous controles Base inclus","Analyse DNS (SPF, DMARC, CAA)","Configuration CORS","Detection CMS et frameworks","Analyse contenu mixte","Mode Deep Scan","Rapports HTML/JSON"}', 0, 30000, NULL, 1, 'active', '1.0.0'),

(23, 'Web', 'Web Security Toolkit', 'Pack complet d''audit de securite pour sites web. Inclut les versions Base (~55 controles) et Enhanced (~95 controles).

Standards: OWASP Top 10 | ANSSI Recommandations Web | CIS Benchmark

Execution PowerShell depuis Windows. Compatible avec tout site web accessible en HTTP/HTTPS.', 'web-security-toolkit.zip', 'Globe', 'OWASP + ANSSI + CIS', '{"Bundle Base + Enhanced avec 30% reduction","~150 controles de securite au total","Headers HTTP et TLS/SSL complets","Analyse DNS et CORS","Detection technologies et CMS","Fichiers sensibles et cookies","Rapports HTML/JSON detailles"}', 0, 5000, '{21,22}', 0, 'development', '1.0.0')

ON CONFLICT (id) DO UPDATE SET
  os = EXCLUDED.os,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  filename = EXCLUDED.filename,
  icon = EXCLUDED.icon,
  compliance = EXCLUDED.compliance,
  features = EXCLUDED.features,
  price_cents = EXCLUDED.price_cents,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  bundled_script_ids = EXCLUDED.bundled_script_ids,
  is_hidden = EXCLUDED.is_hidden,
  status = EXCLUDED.status,
  version = EXCLUDED.version;

-- ============================================================
-- SCRIPT CONTROLS
-- ============================================================

INSERT INTO script_controls (id, script_id, control_id, name, description, category, severity, reference, code, enabled) VALUES
(6, 10, 'ANSSI-SSH-001', 'SSH Protocol 2', 'Protocol SSH version 2 uniquement', 'SSH', 'critical', 'ANSSI-BP-028 R20', '# ANSSI-SSH-001: SSH Protocol 2
check_anssi_ssh_001() {
    echo ''{"status":"MANUAL","controlId":"ANSSI-SSH-001","name":"SSH Protocol 2","recommendation":"Manual verification required"}''
}
results["ANSSI-SSH-001"]=$(check_anssi_ssh_001)', 1),

(7, 10, 'ANSSI-SSH-002', 'SSH PermitRootLogin', 'Connexion root directe interdite', 'SSH', 'critical', 'ANSSI-BP-028 R21', '# ANSSI-SSH-002: SSH PermitRootLogin
check_anssi_ssh_002() {
    echo ''{"status":"MANUAL","controlId":"ANSSI-SSH-002","name":"SSH PermitRootLogin","recommendation":"Manual verification required"}''
}
results["ANSSI-SSH-002"]=$(check_anssi_ssh_002)', 1),

(1, 23, 'OWASP-HDR-001', 'Content-Security-Policy', 'Protection contre XSS et injection de contenu', 'Headers HTTP', 'critical', 'OWASP Secure Headers', '# OWASP-HDR-001: Content-Security-Policy
function Test-OWASPHDR001 {
    return @{
        Status = "MANUAL"
        ControlId = "OWASP-HDR-001"
        Name = "Content-Security-Policy"
        Description = "Protection contre XSS et injection de contenu"
        Recommendation = "Manual verification required"
    }
}
$results["OWASP-HDR-001"] = Test-OWASPHDR001', 1),

(2, 23, 'OWASP-TLS-001', 'HTTPS obligatoire', 'Forcer l''utilisation de HTTPS', 'TLS/SSL', 'critical', 'OWASP Transport Layer Protection', '# OWASP-TLS-001: HTTPS obligatoire
function Test-OWASPTLS001 {
    return @{
        Status = "MANUAL"
        ControlId = "OWASP-TLS-001"
        Name = "HTTPS obligatoire"
        Description = "Forcer l''utilisation de HTTPS"
        Recommendation = "Manual verification required"
    }
}
$results["OWASP-TLS-001"] = Test-OWASPTLS001', 1),

(3, 23, 'OWASP-TLS-002', 'TLS 1.2 minimum', 'Version TLS 1.2 ou supérieure', 'TLS/SSL', 'critical', 'OWASP Transport Layer Protection', '# OWASP-TLS-002: TLS 1.2 minimum
function Test-OWASPTLS002 {
    return @{
        Status = "MANUAL"
        ControlId = "OWASP-TLS-002"
        Name = "TLS 1.2 minimum"
        Description = "Version TLS 1.2 ou supérieure"
        Recommendation = "Manual verification required"
    }
}
$results["OWASP-TLS-002"] = Test-OWASPTLS002', 1),

(4, 23, 'OWASP-FILE-001', 'Git exposé', 'Dossier .git inaccessible', 'Fichiers Sensibles', 'critical', 'OWASP Information Leakage', '# OWASP-FILE-001: Git exposé
function Test-OWASPFILE001 {
    return @{
        Status = "MANUAL"
        ControlId = "OWASP-FILE-001"
        Name = "Git exposé"
        Description = "Dossier .git inaccessible"
        Recommendation = "Manual verification required"
    }
}
$results["OWASP-FILE-001"] = Test-OWASPFILE001', 1),

(5, 23, 'OWASP-FILE-002', 'Fichiers .env', 'Variables d''environnement protégées', 'Fichiers Sensibles', 'critical', 'OWASP Information Leakage', '# OWASP-FILE-002: Fichiers .env
function Test-OWASPFILE002 {
    return @{
        Status = "MANUAL"
        ControlId = "OWASP-FILE-002"
        Name = "Fichiers .env"
        Description = "Variables d''environnement protégées"
        Recommendation = "Manual verification required"
    }
}
$results["OWASP-FILE-002"] = Test-OWASPFILE002', true)

ON CONFLICT (id) DO UPDATE SET
  script_id = EXCLUDED.script_id,
  control_id = EXCLUDED.control_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  severity = EXCLUDED.severity,
  reference = EXCLUDED.reference,
  code = EXCLUDED.code,
  enabled = EXCLUDED.enabled;

-- ============================================================
-- Mise à jour des séquences d'ID
-- ============================================================
SELECT setval('scripts_id_seq', (SELECT MAX(id) FROM scripts) + 1, false);
SELECT setval('script_controls_id_seq', (SELECT MAX(id) FROM script_controls) + 1, false);

-- ============================================================
-- Vérification
-- ============================================================
SELECT 'Scripts importés: ' || COUNT(*) FROM scripts;
SELECT 'Contrôles importés: ' || COUNT(*) FROM script_controls;
