#!/bin/bash

# ==============================================
# Infra Shield Tools - Script de mise à jour VPS
# ==============================================

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "  Infra Shield Tools - Mise à jour"
echo "=========================================="
echo ""

# Questions interactives
read -p "Chemin du répertoire de l'application [/var/www/Infra-Shield-Tools]: " APP_DIR
APP_DIR=${APP_DIR:-/var/www/Infra-Shield-Tools}

read -p "Nom de l'application PM2 [infra-shield-tools]: " APP_NAME
APP_NAME=${APP_NAME:-infra-shield-tools}

if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}[ERREUR]${NC} Le répertoire $APP_DIR n'existe pas !"
    exit 1
fi

echo ""
echo ">>> Récupération des dernières modifications..."
cd "$APP_DIR"
git pull origin main

echo ""
echo ">>> Installation des nouvelles dépendances..."
npm install

echo ""
echo ">>> Rebuild de l'application..."
npm run build

echo ""
echo ">>> Migration base de données (si nécessaire)..."
npm run db:push

echo ""
echo ">>> Redémarrage de l'application..."
pm2 restart $APP_NAME

echo ""
echo -e "${GREEN}[OK]${NC} Mise à jour terminée !"
echo ""
pm2 status
