#!/bin/bash

# IST VPS Initial Setup Script
# Run this on a fresh VPS to prepare for IST deployment
# Usage: bash vps-setup.sh

set -e

echo "=========================================="
echo "IST VPS Setup Script"
echo "=========================================="

# Update system
echo "[1/8] Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 20
echo "[2/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify Node.js installation
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# Install PM2 globally
echo "[3/8] Installing PM2..."
npm install -g pm2

# Install tsx globally (required for build)
echo "[4/8] Installing tsx..."
npm install -g tsx

# Install Nginx
echo "[5/8] Installing Nginx..."
apt install -y nginx

# Install Certbot for SSL (optional, skip if using custom certificates)
echo "[6/8] Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# Create application directory
echo "[7/8] Creating application directory..."
mkdir -p /var/www/ist-secu
cd /var/www/ist-secu

# Clone repository (replace with your repo URL)
echo "[8/8] Cloning repository..."
echo "Please run: git clone <your-repo-url> ."
echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Clone your repository: git clone <repo-url> /var/www/ist-secu"
echo "2. Create .env file with DATABASE_URL and other secrets"
echo "3. Run: npm install --include=dev"
echo "4. Run: npm run build"
echo "5. Configure ecosystem.config.cjs for PM2"
echo "6. Run: pm2 start ecosystem.config.cjs"
echo "7. Configure Nginx with SSL certificates"
echo "8. Run: pm2 save && pm2 startup"
echo ""
