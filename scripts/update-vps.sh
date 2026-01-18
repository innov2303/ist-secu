#!/bin/bash

# ==============================================
# Script de mise à jour VPS universel
# Pour applications Node.js/Express
# ==============================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[ATTENTION]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERREUR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}=========================================="
    echo "  $1"
    echo -e "==========================================${NC}"
    echo ""
}

print_header "Mise à jour de l'application"

# ==========================================
# CONFIGURATION
# ==========================================

# Détecter automatiquement les applications PM2
echo "Applications PM2 détectées :"
pm2 list

echo ""
read -p "Nom de l'application PM2 à mettre à jour : " APP_NAME

if [ -z "$APP_NAME" ]; then
    print_error "Nom d'application requis"
    exit 1
fi

# Essayer de trouver le répertoire automatiquement
PM2_APP_PATH=$(pm2 describe "$APP_NAME" 2>/dev/null | grep "exec cwd" | awk '{print $4}')

if [ -n "$PM2_APP_PATH" ] && [ -d "$PM2_APP_PATH" ]; then
    DEFAULT_DIR="$PM2_APP_PATH"
else
    DEFAULT_DIR="/var/www/$APP_NAME"
fi

read -p "Répertoire de l'application [$DEFAULT_DIR]: " APP_DIR
APP_DIR=${APP_DIR:-$DEFAULT_DIR}

if [ ! -d "$APP_DIR" ]; then
    print_error "Le répertoire $APP_DIR n'existe pas"
    exit 1
fi

# ==========================================
# OPTIONS
# ==========================================

echo ""
echo "Options de mise à jour :"
read -p "Exécuter git pull ? (O/n): " DO_GIT_PULL
read -p "Réinstaller les dépendances npm ? (O/n): " DO_NPM_INSTALL
read -p "Recompiler l'application ? (O/n): " DO_BUILD
read -p "Exécuter les migrations DB ? (o/N): " DO_MIGRATE

# ==========================================
# RÉCAPITULATIF
# ==========================================

print_header "Récapitulatif"

echo "  Application : $APP_NAME"
echo "  Répertoire  : $APP_DIR"
echo ""
echo "  Actions :"
[[ ! "$DO_GIT_PULL" =~ ^[nN]$ ]] && echo "    - Git pull"
[[ ! "$DO_NPM_INSTALL" =~ ^[nN]$ ]] && echo "    - npm install"
[[ ! "$DO_BUILD" =~ ^[nN]$ ]] && echo "    - npm run build"
[[ "$DO_MIGRATE" =~ ^[oOyY]$ ]] && echo "    - Migration DB"
echo "    - Redémarrage PM2"
echo ""

read -p "Continuer ? (O/n): " CONFIRM
if [[ "$CONFIRM" =~ ^[nN]$ ]]; then
    echo "Mise à jour annulée."
    exit 0
fi

# ==========================================
# EXÉCUTION
# ==========================================

cd "$APP_DIR"

# Sauvegarde des fichiers modifiés localement
if [ -f ".env" ]; then
    cp .env .env.update-backup
    print_status "Sauvegarde .env créée"
fi

# Git pull
if [[ ! "$DO_GIT_PULL" =~ ^[nN]$ ]]; then
    print_header "Récupération des mises à jour"
    
    # Vérifier s'il y a des modifications locales
    if ! git diff --quiet 2>/dev/null; then
        print_warning "Modifications locales détectées"
        git stash
        git pull
        git stash pop || true
    else
        git pull
    fi
    print_status "Code mis à jour"
fi

# npm install
if [[ ! "$DO_NPM_INSTALL" =~ ^[nN]$ ]]; then
    print_header "Installation des dépendances"
    npm install
    print_status "Dépendances installées"
fi

# Build
if [[ ! "$DO_BUILD" =~ ^[nN]$ ]]; then
    print_header "Compilation"
    npm run build
    print_status "Application compilée"
fi

# Migration DB
if [[ "$DO_MIGRATE" =~ ^[oOyY]$ ]]; then
    print_header "Migration base de données"
    
    # Charger les variables d'environnement
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    npm run db:push
    print_status "Base de données migrée"
fi

# Redémarrage PM2
print_header "Redémarrage de l'application"
pm2 restart "$APP_NAME"
pm2 save
print_status "Application redémarrée"

# ==========================================
# VÉRIFICATION
# ==========================================

print_header "Vérification"

sleep 3

# Vérifier le status
PM2_STATUS=$(pm2 describe "$APP_NAME" 2>/dev/null | grep "status" | head -1 | awk '{print $4}')

if [ "$PM2_STATUS" = "online" ]; then
    print_status "Application en ligne !"
    
    # Afficher les dernières lignes de log
    echo ""
    echo "Dernières lignes de log :"
    echo "---"
    pm2 logs "$APP_NAME" --lines 5 --nostream
    echo "---"
else
    print_error "L'application ne semble pas démarrée correctement"
    echo ""
    echo "Vérifiez les logs avec :"
    echo "  pm2 logs $APP_NAME --lines 50"
fi

print_header "Mise à jour terminée !"

echo "Commandes utiles :"
echo "  - Voir les logs : pm2 logs $APP_NAME"
echo "  - Status        : pm2 status"
echo "  - Rollback .env : cp $APP_DIR/.env.update-backup $APP_DIR/.env"
echo ""
