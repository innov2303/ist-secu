#!/bin/bash

# ==============================================
# Infra Shield Tools - Script d'installation VPS Debian
# ==============================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

echo "=========================================="
echo "  Infra Shield Tools - Installation VPS"
echo "=========================================="
echo ""

# Questions interactives
echo -e "${BLUE}Configuration de l'installation${NC}"
echo ""

# Répertoire de l'application
read -p "Chemin du répertoire de l'application [/var/www/Infra-Shield-Tools]: " APP_DIR
APP_DIR=${APP_DIR:-/var/www/Infra-Shield-Tools}

# Nom de domaine
read -p "Nom de domaine [ist-security.fr]: " DOMAIN
DOMAIN=${DOMAIN:-ist-security.fr}

# Nom de l'application pour PM2
read -p "Nom de l'application (pour PM2) [infra-shield-tools]: " APP_NAME
APP_NAME=${APP_NAME:-infra-shield-tools}

# Configuration base de données
echo ""
echo -e "${BLUE}Configuration de la base de données${NC}"
read -p "Utilisateur PostgreSQL [ist_user]: " DB_USER
DB_USER=${DB_USER:-ist_user}

read -p "Nom de la base de données [ist_db]: " DB_NAME
DB_NAME=${DB_NAME:-ist_db}

while true; do
    read -s -p "Mot de passe PostgreSQL: " DB_PASSWORD
    echo ""
    if [ -z "$DB_PASSWORD" ]; then
        print_error "Le mot de passe ne peut pas être vide."
    else
        read -s -p "Confirmez le mot de passe: " DB_PASSWORD_CONFIRM
        echo ""
        if [ "$DB_PASSWORD" = "$DB_PASSWORD_CONFIRM" ]; then
            break
        else
            print_error "Les mots de passe ne correspondent pas."
        fi
    fi
done

echo ""
echo "=========================================="
echo "  Récapitulatif de la configuration"
echo "=========================================="
echo "  Répertoire    : $APP_DIR"
echo "  Domaine       : $DOMAIN"
echo "  Nom app PM2   : $APP_NAME"
echo "  Utilisateur DB: $DB_USER"
echo "  Base de données: $DB_NAME"
echo "=========================================="
echo ""
read -p "Continuer l'installation ? (o/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[oOyY]$ ]]; then
    echo "Installation annulée."
    exit 0
fi

echo ""

# 1. Mise à jour système
echo ">>> Mise à jour du système..."
sudo apt update && sudo apt upgrade -y
print_status "Système mis à jour"

# 2. Installation Node.js 20
echo ""
echo ">>> Installation de Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    print_status "Node.js $(node -v) installé"
else
    print_status "Node.js $(node -v) déjà installé"
fi

# 3. Installation PostgreSQL
echo ""
echo ">>> Installation de PostgreSQL..."
if ! command -v psql &> /dev/null; then
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    print_status "PostgreSQL installé"
else
    print_status "PostgreSQL déjà installé"
fi

# 4. Configuration base de données
echo ""
echo ">>> Configuration de la base de données..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

print_status "Base de données configurée"

# 5. Installation Nginx
echo ""
echo ">>> Installation de Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    print_status "Nginx installé"
else
    print_status "Nginx déjà installé"
fi

# 6. Installation PM2
echo ""
echo ">>> Installation de PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    print_status "PM2 installé"
else
    print_status "PM2 déjà installé"
fi

# 7. Vérification du répertoire de l'application
echo ""
echo ">>> Vérification du répertoire..."
if [ ! -d "$APP_DIR" ]; then
    print_error "Le répertoire $APP_DIR n'existe pas !"
    echo ""
    echo "Clonez d'abord votre repo avec :"
    echo "  sudo mkdir -p /var/www"
    echo "  cd /var/www"
    echo "  sudo git clone https://github.com/VOTRE-USERNAME/VOTRE-REPO.git"
    echo "  sudo chown -R \$USER:\$USER $APP_DIR"
    echo ""
    echo "Puis relancez ce script."
    exit 1
fi
print_status "Répertoire trouvé : $APP_DIR"

# 8. Création du fichier .env
echo ""
echo ">>> Configuration de l'environnement..."
if [ -f "$APP_DIR/.env" ]; then
    print_warning "Fichier .env existant, sauvegarde..."
    cp "$APP_DIR/.env" "$APP_DIR/.env.backup"
fi

cat > "$APP_DIR/.env" << EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
SESSION_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
EOF

print_status "Fichier .env créé"

# 9. Installation des dépendances
echo ""
echo ">>> Installation des dépendances npm..."
cd "$APP_DIR"
npm install
print_status "Dépendances installées"

# 10. Build de l'application
echo ""
echo ">>> Build de l'application..."
npm run build
print_status "Application compilée"

# 11. Migration base de données
echo ""
echo ">>> Migration de la base de données..."
npm run db:push
print_status "Base de données migrée"

# 12. Configuration Nginx
echo ""
echo ">>> Configuration de Nginx..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
print_status "Nginx configuré"

# 13. Démarrage avec PM2
echo ""
echo ">>> Démarrage de l'application avec PM2..."
cd "$APP_DIR"
pm2 delete $APP_NAME 2>/dev/null || true
pm2 start npm --name "$APP_NAME" -- start
pm2 save
print_status "Application démarrée"

# 14. Configuration démarrage automatique
echo ""
echo ">>> Configuration du démarrage automatique..."
pm2 startup systemd -u $USER --hp $HOME
print_status "Démarrage automatique configuré"

echo ""
echo "=========================================="
echo -e "${GREEN}  INSTALLATION TERMINÉE !${NC}"
echo "=========================================="
echo ""
echo "Informations importantes :"
echo "  - Site accessible sur : http://$DOMAIN"
echo "  - Base de données : $DB_NAME"
echo "  - Utilisateur DB : $DB_USER"
echo ""
echo "Commandes utiles :"
echo "  - Voir les logs : pm2 logs $APP_NAME"
echo "  - Redémarrer : pm2 restart $APP_NAME"
echo "  - Status : pm2 status"
echo ""
print_warning "N'oubliez pas d'installer SSL avec :"
echo "  sudo apt install certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
