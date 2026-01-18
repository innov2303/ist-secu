#!/bin/bash

# ==============================================
# IST Security - Script de mise à jour VPS
# ==============================================

set -e

APP_DIR="/var/www/Infra-Shield-Tools"

GREEN='\033[0;32m'
NC='\033[0m'

echo "=========================================="
echo "  IST Security - Mise à jour"
echo "=========================================="

cd "$APP_DIR"

echo ""
echo ">>> Récupération des dernières modifications..."
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
pm2 restart ist-security

echo ""
echo -e "${GREEN}[OK]${NC} Mise à jour terminée !"
echo ""
pm2 status
