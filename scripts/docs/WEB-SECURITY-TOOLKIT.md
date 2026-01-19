# Web Security Compliance Toolkit

## Vue d'ensemble

Le **Web Security Compliance Toolkit** est une solution d'audit de securite pour sites web, permettant d'evaluer la conformite aux standards OWASP et aux recommandations ANSSI. Les scripts analysent les headers HTTP, la configuration TLS/SSL, les fichiers sensibles exposes, et bien plus encore.

## Versions disponibles

| Version | Controles | Description |
|---------|-----------|-------------|
| Base | ~55 | Controles essentiels de securite web |
| Enhanced | ~95 | Analyse avancee avec detection technologies |

## Standards de reference

- **OWASP Top 10** - Les 10 risques de securite web les plus critiques
- **OWASP Secure Headers** - Recommandations pour les headers HTTP
- **ANSSI** - Recommandations de l'ANSSI pour la securite web
- **RFC 7230-7235** - Specifications HTTP
- **RFC 8446** - TLS 1.3

## Pre-requis

### Systeme
- Windows 10/11 ou Windows Server 2016+
- PowerShell 5.1 ou superieur
- Connectivite reseau vers le site cible

### Permissions
- Aucun privilege administrateur requis
- Acces reseau sortant (HTTP/HTTPS)

## Installation

1. Extraire l'archive du toolkit
2. Ouvrir PowerShell
3. Naviguer vers le dossier des scripts

```powershell
cd C:\path\to\web-security-toolkit
```

## Utilisation

### Script Base (~55 controles)

```powershell
# Analyse basique
.\web-security-base.ps1 -Url "https://example.com"

# Avec chemin de sortie personnalise
.\web-security-base.ps1 -Url "https://example.com" -OutputPath "C:\Audits"

# Format de sortie specifique
.\web-security-base.ps1 -Url "https://example.com" -OutputFormat HTML
```

### Script Enhanced (~95 controles)

```powershell
# Analyse avancee
.\web-security-enhanced.ps1 -Url "https://example.com"

# Avec Deep Scan (plus complet, plus lent)
.\web-security-enhanced.ps1 -Url "https://example.com" -DeepScan

# Timeout personnalise (en secondes)
.\web-security-enhanced.ps1 -Url "https://example.com" -Timeout 60
```

### Parametres communs

| Parametre | Type | Defaut | Description |
|-----------|------|--------|-------------|
| `-Url` | String | (requis) | URL du site a analyser |
| `-OutputPath` | String | ./reports | Dossier de sortie |
| `-OutputFormat` | String | Both | HTML, JSON ou Both |
| `-Timeout` | Int | 30 | Timeout en secondes |
| `-DeepScan` | Switch | - | Analyse approfondie (Enhanced) |

## Categories de controles

### 1. Headers HTTP de Securite

Verification des headers de securite critiques :

| Header | Importance | Description |
|--------|------------|-------------|
| Content-Security-Policy | Critique | Protection contre XSS et injection |
| Strict-Transport-Security | Critique | Force HTTPS (HSTS) |
| X-Content-Type-Options | Haute | Previent le MIME sniffing |
| X-Frame-Options | Haute | Protection contre le clickjacking |
| Referrer-Policy | Moyenne | Controle les informations referrer |
| Permissions-Policy | Moyenne | Controle les fonctionnalites navigateur |

### 2. Configuration TLS/SSL

- Version du protocole TLS (1.2 minimum, 1.3 recommande)
- Validite du certificat
- Force de chiffrement
- Algorithme de signature
- Taille de cle
- Redirection HTTP vers HTTPS

### 3. Fichiers Sensibles

Detection de fichiers qui ne devraient pas etre accessibles :

| Fichier | Risque | Description |
|---------|--------|-------------|
| /.git/config | Critique | Configuration Git exposee |
| /.env | Critique | Variables d'environnement |
| /wp-config.php | Critique | Configuration WordPress |
| /backup.zip | Critique | Archives de sauvegarde |
| /phpinfo.php | Eleve | Information PHP |
| /server-status | Eleve | Status Apache |

### 4. Securite DNS (Enhanced)

- Enregistrement SPF pour l'email
- Enregistrement DMARC
- Enregistrements CAA
- Redondance des serveurs DNS

### 5. Configuration CORS (Enhanced)

- Access-Control-Allow-Origin
- Access-Control-Allow-Credentials
- Detection de configurations dangereuses

### 6. Analyse du Contenu (Enhanced)

- Detection de contenu mixte HTTP/HTTPS
- JavaScript inline
- Commentaires HTML sensibles
- Divulgation de versions

### 7. Detection des Technologies (Enhanced)

- CMS (WordPress, Joomla, Drupal, etc.)
- Frameworks (React, Angular, Vue, etc.)
- Versions exposees

### 8. Securite des Cookies

- Attribut Secure
- Attribut HttpOnly
- Attribut SameSite
- Analyse des cookies de session

## Interpretation des resultats

### Statuts des controles

| Statut | Signification |
|--------|---------------|
| PASS | Le controle est conforme |
| FAIL | Non-conformite detectee - action requise |
| WARNING | Point d'attention a evaluer |
| N/A | Controle non applicable |

### Systeme de notation

| Note | Score | Interpretation |
|------|-------|----------------|
| A | 90-100% | Excellent - Securite robuste |
| B | 80-89% | Bon - Quelques ameliorations mineures |
| C | 70-79% | Moyen - Ameliorations recommandees |
| D | 60-69% | Insuffisant - Actions necessaires |
| E | 50-59% | Critique - Intervention urgente |
| F | <50% | Echec - Risques majeurs |

## Exemples de rapports

### Sortie console

```
========================================
  Web Security Compliance Toolkit - Base
  Version: 1.0.0
========================================

Cible: https://example.com
Date: 2025-01-19 14:30:00

Verification de la connectivite...
Connexion reussie (HTTP 200)

--- HEADERS HTTP DE SECURITE ---

[PASS] WEB-HDR-001 - Content-Security-Policy
[PASS] WEB-HDR-002 - X-Content-Type-Options
[FAIL] WEB-HDR-003 - X-Frame-Options
[PASS] WEB-HDR-005 - Strict-Transport-Security
...

========================================
  RESULTATS DE L'AUDIT
========================================

Controles reussis:     42
Controles echoues:     8
Avertissements:        5
Non applicables:       0

Score: 84% - Note: B
```

### Rapport HTML

Le rapport HTML inclut :
- Resume executif avec score et note
- Graphique des resultats par categorie
- Detail de chaque controle avec statut
- Recommandations de remediation
- References aux standards

### Rapport JSON

Structure JSON pour integration avec d'autres outils :

```json
{
  "Metadata": {
    "ScriptName": "Web Security Compliance Toolkit - Base",
    "TargetUrl": "https://example.com",
    "ScanDate": "2025-01-19 14:30:00"
  },
  "Categories": [...],
  "Summary": {
    "Score": 84.0,
    "Grade": "B",
    "Passed": 42,
    "Failed": 8
  }
}
```

## Bonnes pratiques

### Avant l'audit

1. Obtenir l'autorisation du proprietaire du site
2. Verifier la connectivite reseau
3. Planifier l'audit en heures creuses si possible

### Pendant l'audit

1. Ne pas interrompre le script
2. Surveiller les erreurs eventuelles
3. Noter les comportements anormaux

### Apres l'audit

1. Analyser les resultats en detail
2. Prioriser les corrections (FAIL > WARNING)
3. Planifier les remediations
4. Re-tester apres corrections

## Remediation courante

### Headers de securite

```apache
# Apache - .htaccess ou httpd.conf
Header always set Content-Security-Policy "default-src 'self'"
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
```

```nginx
# Nginx - nginx.conf
add_header Content-Security-Policy "default-src 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Bloquer les fichiers sensibles

```apache
# Apache
<FilesMatch "^\.">
    Require all denied
</FilesMatch>
<FilesMatch "\.(env|sql|bak|backup)$">
    Require all denied
</FilesMatch>
```

```nginx
# Nginx
location ~ /\. {
    deny all;
}
location ~ \.(env|sql|bak|backup)$ {
    deny all;
}
```

## Limitations

- L'audit est non-intrusif (pas de test de penetration)
- Certains controles dependent de la reponse du serveur
- Les sites avec protection anti-bot peuvent bloquer l'analyse
- L'analyse DNS necessite des resolvers fonctionnels

## Depannage

### Erreur de connexion

```
Verifier :
- L'URL est correcte et accessible
- Le pare-feu autorise les connexions sortantes
- Le certificat SSL est valide
```

### Timeout

```
Augmenter le timeout :
.\web-security-base.ps1 -Url "https://site-lent.com" -Timeout 120
```

### Erreurs TLS

```
Verifier la version de PowerShell :
$PSVersionTable.PSVersion

Forcer TLS 1.2 :
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
```

## Support

Pour toute question ou assistance :
- Email : support@ist-security.fr
- Site : https://ist-security.fr

## Changelog

### Version 1.0.0 (2025-01-19)
- Version initiale
- ~55 controles (Base) / ~95 controles (Enhanced)
- Support OWASP et ANSSI
- Rapports HTML et JSON
