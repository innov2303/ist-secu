#!/bin/bash

# IST Production Deployment Script
# Usage: ./deploy.sh

set -e

echo "=========================================="
echo "IST Production Deployment"
echo "=========================================="

cd /var/www/ist-secu

echo "[1/5] Pulling latest changes..."
git pull origin main

echo "[2/5] Installing dependencies (including dev)..."
npm install --include=dev

echo "[3/5] Building application..."
npm run build

echo "[4/5] Restarting PM2 service..."
pm2 restart ist-secu

echo "[5/5] Checking service status..."
pm2 status ist-secu

echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
