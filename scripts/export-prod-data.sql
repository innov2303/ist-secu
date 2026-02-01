-- Export des données IST pour la base de production
-- À exécuter sur le VPS : psql -U ist_secu_user -d ist_secu_db -f scripts/export-prod-data.sql

-- ============================================================
-- SCRIPTS / TOOLKITS
-- ============================================================

INSERT INTO scripts (id, os, name, description, filename, content, icon, compliance, features, price_cents, monthly_price_cents, bundled_script_ids, is_hidden, status, version) VALUES
(5, 'Windows', 'Windows Compliance Toolkit', 'Bundle complet incluant les scripts Base (~80 contrôles) et Enhanced (~125 contrôles) pour Windows Server.

🏷️ Standards: ANSSI-BP-028 | CIS Benchmark Level 1 & 2

Compatible Windows Server 2016, 2019, 2022 et 2025. Requiert PowerShell 5.1 ou supérieur avec privilèges administrateur.', 'windows-compliance-toolkit.zip', '# Toolkit Bundle', 'Monitor', 'ANSSI & CIS', '{"Bundle Base + Enhanced","~125 contrôles total","Credential Guard, LSASS Protection","Chiffrement TLS/SSL avancé","Attack Surface Reduction","Rapport HTML/JSON détaillé"}', 0, 8000, '{11,12}', 0, 'active', '1.0.0'),

(10, 'Linux', 'Linux Compliance Toolkit', 'Pack complet d''audit de conformité Linux. Inclut les versions Base (~115 contrôles) et Renforcée (~215 contrôles).

🏷️ Standards: ANSSI-BP-028 | CIS Benchmark Level 1 & 2

Compatible Debian/Ubuntu, Red Hat/CentOS, Fedora, SUSE.', 'linux-compliance-toolkit.zip', '# Toolkit Bundle', 'Terminal', 'ANSSI-BP-028 + CIS Benchmark', '{"Base + Enhanced","~215 contrôles total","ANSSI + CIS","Rapports HTML/JSON"}', 0, 8000, '{6,9}', 0, 'active', '1.0.0'),

(7, 'VMware', 'VMware Compliance Toolkit', 'Pack complet d''audit de conformité VMware ESXi. Inclut les versions Base (~75 contrôles) et Enhanced (~165 contrôles).

🏷️ Standards: CIS Benchmark | DISA STIG CAT I & CAT II

Compatible ESXi 7.0 et 8.0.', 'vmware-esxi-compliance-toolkit.zip', '# Toolkit Bundle', 'Server', 'CIS', '{"Base + Enhanced","~165 contrôles total","CIS Benchmark","PowerCLI","Rapports HTML/JSON"}', 0, 10000, '{13,14}', 0, 'development', '1.0.0'),

(8, 'Containers', 'Container & Orchestration Toolkit', 'Pack complet d''audit de conformité pour environnements conteneurisés.

🏷️ Standards: CIS Benchmark Docker | CIS Benchmark Kubernetes

Compatible Docker 20.10+, Kubernetes 1.25+.', 'container-orchestration-toolkit.zip', '# Toolkit Bundle', 'Container', 'CIS Docker & Kubernetes', '{"Base + Enhanced","~160 contrôles total","CIS Docker + Kubernetes","Rapports HTML/JSON"}', 0, 10000, '{16,17}', 0, 'development', '1.0.0'),

(18, 'NetApp', 'NetApp ONTAP Compliance Base', 'Script d''audit de securite pour les clusters NetApp ONTAP.
Effectue ~70 controles essentiels bases sur le NetApp Security Hardening Guide et DISA STIG.', 'netapp-ontap-compliance-base.ps1', '# NetApp Base Audit Script', 'SiNetapp', 'NetApp Security Hardening Guide + DISA STIG', '{"~70 controles de securite essentiels","Verification authentification et RBAC","Rapport HTML et JSON avec score"}', 0, 35000, NULL, 1, 'active', '1.0.0'),

(19, 'NetApp', 'NetApp ONTAP Compliance Enhanced', 'Script d''audit de securite avance pour les clusters NetApp ONTAP.
Effectue ~120 controles approfondis.', 'netapp-ontap-compliance-enhanced.ps1', '# NetApp Enhanced Audit Script', 'SiNetapp', 'NetApp Security Hardening Guide + DISA STIG (Full)', '{"~120 controles de securite avances","Verification MFA et SAML SSO","Rapport HTML et JSON detaille"}', 0, 35000, NULL, 1, 'active', '1.0.0'),

(6, 'Linux', 'Linux Compliance Base', 'Audit de conformité Linux (version Base) couvrant ~115 contrôles ANSSI-BP-028 et CIS Level 1.', 'linux-compliance-base.sh', '#!/bin/bash
# Linux Compliance Base Audit Script', 'Terminal', 'ANSSI-BP-028 + CIS L1', '{"~115 contrôles","ANSSI-BP-028 essentiel","CIS Level 1","Rapport HTML/JSON"}', 0, 30000, NULL, 1, 'active', '1.0.0'),

(9, 'Linux', 'Linux Compliance Enhanced', 'Audit de conformité Linux (version Renforcée) couvrant ~215 contrôles ANSSI-BP-028 et CIS Level 2.', 'linux-compliance-enhanced.sh', '#!/bin/bash
# Linux Compliance Enhanced Audit Script', 'Terminal', 'ANSSI-BP-028 + CIS L2', '{"~215 contrôles","ANSSI-BP-028 complet","CIS Level 2","Kernel hardening"}', 0, 30000, NULL, 1, 'active', '1.0.0'),

(11, 'Windows', 'Windows Compliance Base', 'Audit de sécurité de base pour Windows Server couvrant ~80 contrôles ANSSI et CIS Level 1.', 'windows-compliance-base.ps1', '# Windows Compliance Base Audit Script', 'Monitor', 'ANSSI + CIS L1', '{"~80 contrôles essentiels","Rapport HTML/JSON","Score de conformité A-F"}', 0, 30000, NULL, 1, 'active', '1.0.0'),

(12, 'Windows', 'Windows Compliance Enhanced', 'Audit de sécurité renforcé pour Windows Server couvrant ~125 contrôles ANSSI et CIS Level 2.', 'windows-compliance-enhanced.ps1', '# Windows Compliance Enhanced Audit Script', 'Monitor', 'ANSSI + CIS L2', '{"~125 contrôles complets","Credential Guard","LSASS Protection"}', 0, 30000, NULL, 1, 'active', '1.0.0'),

(13, 'VMware', 'VMware ESXi Compliance - Base', 'Script d''audit VMware ESXi (Base) couvrant ~75 contrôles CIS 7.0/8.0.', 'vmware-esxi-compliance-base.ps1', '# VMware ESXi Base Audit Script', 'Server', 'CIS Benchmark', '{"~75 contrôles","CIS VMware ESXi","PowerCLI","Rapport HTML/JSON"}', 0, 40000, NULL, 1, 'active', '1.0.0'),

(14, 'VMware', 'VMware ESXi Compliance - Enhanced', 'Script d''audit VMware ESXi (Enhanced) couvrant ~165 contrôles CIS 7.0/8.0.', 'vmware-esxi-compliance-enhanced.ps1', '# VMware ESXi Enhanced Audit Script', 'Server', 'CIS Benchmark + Avancé', '{"~165 contrôles","CIS Benchmark complet","Contrôles avancés"}', 0, 40000, NULL, 1, 'active', '1.0.0'),

(16, 'Containers', 'Container Compliance Base', 'Script d''audit de conformité conteneurs (Base) couvrant ~135 contrôles CIS Docker & Kubernetes Level 1.', 'container-compliance-base.sh', '#!/bin/bash
# Container Compliance Base Audit Script', 'container', 'CIS Docker & Kubernetes L1', '{"~135 contrôles","CIS Level 1","Rapports HTML/JSON"}', 50000, 30000, NULL, 1, 'active', '1.0.0'),

(17, 'Containers', 'Container Compliance Enhanced', 'Script d''audit de conformité conteneurs (Enhanced) couvrant ~160 contrôles CIS Docker & Kubernetes Level 2.', 'container-compliance-enhanced.sh', '#!/bin/bash
# Container Compliance Enhanced Audit Script', 'container', 'CIS Docker & Kubernetes L1+L2', '{"~160 contrôles","CIS Level 2","Rapports HTML/JSON"}', 50000, 30000, NULL, 1, 'active', '1.0.0'),

(21, 'Web', 'Web Security Base', 'Script d''audit de securite web de base avec environ 55 controles. Verifie les headers HTTP, TLS/SSL, fichiers sensibles.', 'web-security-base.ps1', '# Web Security Base Audit Script', 'Globe', 'OWASP + ANSSI', '{"~55 controles de securite","Headers HTTP (CSP, HSTS)","Configuration TLS/SSL"}', 0, 20000, NULL, 1, 'active', '1.0.0'),

(22, 'Web', 'Web Security Enhanced', 'Script d''audit de securite web avance avec environ 95 controles. Inclut analyse DNS, CORS, detection des technologies.', 'web-security-enhanced.ps1', '# Web Security Enhanced Audit Script', 'Globe', 'OWASP + ANSSI + CIS', '{"~95 controles avances","Analyse DNS (SPF, DMARC, CAA)","Configuration CORS"}', 0, 30000, NULL, 1, 'active', '1.0.0'),

(23, 'Web', 'Web Security Toolkit', 'Pack complet d''audit de securite pour sites web. Inclut les versions Base (~55 controles) et Enhanced (~95 controles).

Standards: OWASP Top 10 | ANSSI | CIS Benchmark', 'web-security-toolkit.zip', '# Toolkit Bundle', 'Globe', 'OWASP + ANSSI + CIS', '{"Bundle Base + Enhanced","~150 controles de securite au total","Rapports HTML/JSON detailles"}', 0, 5000, '{21,22}', 0, 'development', '1.0.0')

ON CONFLICT (id) DO UPDATE SET
  os = EXCLUDED.os,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  filename = EXCLUDED.filename,
  content = EXCLUDED.content,
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
(6, 10, 'ANSSI-SSH-001', 'SSH Protocol 2', 'Protocol SSH version 2 uniquement', 'SSH', 'critical', 'ANSSI-BP-028 R20', '# SSH Protocol 2 check', 1),
(7, 10, 'ANSSI-SSH-002', 'SSH PermitRootLogin', 'Connexion root directe interdite', 'SSH', 'critical', 'ANSSI-BP-028 R21', '# SSH PermitRootLogin check', 1),
(1, 23, 'OWASP-HDR-001', 'Content-Security-Policy', 'Protection contre XSS', 'Headers HTTP', 'critical', 'OWASP Secure Headers', '# CSP check', 1),
(2, 23, 'OWASP-TLS-001', 'HTTPS obligatoire', 'Forcer HTTPS', 'TLS/SSL', 'critical', 'OWASP Transport Layer Protection', '# HTTPS check', 1),
(3, 23, 'OWASP-TLS-002', 'TLS 1.2 minimum', 'Version TLS 1.2 ou supérieure', 'TLS/SSL', 'critical', 'OWASP Transport Layer Protection', '# TLS version check', 1),
(4, 23, 'OWASP-FILE-001', 'Git exposé', 'Dossier .git inaccessible', 'Fichiers Sensibles', 'critical', 'OWASP Information Leakage', '# Git exposure check', 1),
(5, 23, 'OWASP-FILE-002', 'Fichiers .env', 'Variables d''environnement protégées', 'Fichiers Sensibles', 'critical', 'OWASP Information Leakage', '# Env files check', 1)

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
-- Vérification
-- ============================================================
SELECT 'Scripts importés: ' || COUNT(*) FROM scripts;
SELECT 'Contrôles importés: ' || COUNT(*) FROM script_controls;
