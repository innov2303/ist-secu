#!/bin/bash

# ==============================================
# Script d'installation VPS universel
# Pour applications Node.js/Express avec PostgreSQL
# Compatible Debian/Ubuntu
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

# Détection root
if [ "$EUID" -eq 0 ]; then
    print_warning "Exécution en tant que root détectée"
    print_info "Il est recommandé d'utiliser un utilisateur non-root avec sudo"
    read -p "Continuer en tant que root ? (o/N): " CONTINUE_AS_ROOT
    if [[ ! "$CONTINUE_AS_ROOT" =~ ^[oOyY]$ ]]; then
        echo "Créez un utilisateur avec : adduser monuser && usermod -aG sudo monuser"
        exit 0
    fi
    RUN_AS_ROOT=true
else
    RUN_AS_ROOT=false
fi

print_header "Installation VPS - Application Node.js"

echo -e "${BLUE}Ce script va installer et configurer :${NC}"
echo "  - Préparation système Debian/Ubuntu"
echo "  - Firewall (UFW)"
echo "  - Fail2ban (protection SSH)"
echo "  - Node.js 20 LTS"
echo "  - PostgreSQL"
echo "  - Nginx (reverse proxy)"
echo "  - PM2 (gestionnaire de processus)"
echo "  - Certificat SSL (Let's Encrypt)"
echo ""

# Fonction pour exécuter avec ou sans sudo (définie tôt pour préparation)
run_cmd() {
    if [ "$RUN_AS_ROOT" = true ]; then
        "$@"
    else
        sudo "$@"
    fi
}

# ==========================================
# PRÉPARATION SYSTÈME DEBIAN
# ==========================================

print_header "Préparation du système"

read -p "Configurer la préparation système (firewall, fail2ban, swap) ? (O/n): " DO_SYSTEM_PREP
DO_SYSTEM_PREP=${DO_SYSTEM_PREP:-O}

if [[ ! "$DO_SYSTEM_PREP" =~ ^[nN]$ ]]; then
    # Timezone
    echo ""
    read -p "Timezone [Europe/Paris]: " TIMEZONE
    TIMEZONE=${TIMEZONE:-Europe/Paris}
    
    # Swap
    read -p "Créer un fichier swap ? (O/n): " CREATE_SWAP
    CREATE_SWAP=${CREATE_SWAP:-O}
    if [[ ! "$CREATE_SWAP" =~ ^[nN]$ ]]; then
        read -p "Taille du swap en GB [2]: " SWAP_SIZE
        SWAP_SIZE=${SWAP_SIZE:-2}
    fi
fi

# ==========================================
# CONFIGURATION INTERACTIVE
# ==========================================

print_header "Configuration de l'application"

# Nom de l'application
read -p "Nom de l'application (ex: mon-site) : " APP_NAME
while [ -z "$APP_NAME" ]; do
    print_error "Le nom de l'application est obligatoire"
    read -p "Nom de l'application : " APP_NAME
done
APP_NAME=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')

# Répertoire de l'application
DEFAULT_DIR="/var/www/$APP_NAME"
read -p "Répertoire d'installation [$DEFAULT_DIR]: " APP_DIR
APP_DIR=${APP_DIR:-$DEFAULT_DIR}

# Nom de domaine
read -p "Nom de domaine (ex: example.com) : " DOMAIN
while [ -z "$DOMAIN" ]; do
    print_error "Le nom de domaine est obligatoire"
    read -p "Nom de domaine : " DOMAIN
done

# Sous-domaine www ?
read -p "Inclure www.$DOMAIN ? (O/n): " INCLUDE_WWW
INCLUDE_WWW=${INCLUDE_WWW:-O}

# Port de l'application
read -p "Port de l'application [5000]: " APP_PORT
APP_PORT=${APP_PORT:-5000}

# ==========================================
# CONFIGURATION GIT
# ==========================================

print_header "Configuration Git"

# Type de connexion Git
echo "Méthodes de connexion Git :"
echo "  1) HTTPS (simple, avec token)"
echo "  2) SSH (recommandé pour les déploiements)"
echo "  3) Dépôt déjà cloné"
read -p "Choix [1]: " GIT_METHOD
GIT_METHOD=${GIT_METHOD:-1}

case $GIT_METHOD in
    1)
        read -p "URL HTTPS du dépôt (ex: https://github.com/user/repo.git) : " GIT_URL
        if [ -n "$GIT_URL" ]; then
            read -p "Token d'accès GitHub/GitLab (laisser vide si public) : " GIT_TOKEN
            read -p "Branche [main]: " GIT_BRANCH
            GIT_BRANCH=${GIT_BRANCH:-main}
            GIT_TYPE="https"
        fi
        ;;
    2)
        read -p "URL SSH du dépôt (ex: git@github.com:user/repo.git) : " GIT_URL
        read -p "Branche [main]: " GIT_BRANCH
        GIT_BRANCH=${GIT_BRANCH:-main}
        GIT_TYPE="ssh"
        SETUP_SSH_KEY=true
        ;;
    3)
        GIT_URL=""
        print_info "Assurez-vous que le dépôt est déjà cloné dans le répertoire cible"
        ;;
esac

# Configuration Git globale
read -p "Nom Git (pour les commits) : " GIT_USER_NAME
read -p "Email Git : " GIT_USER_EMAIL

# ==========================================
# CONFIGURATION BASE DE DONNÉES
# ==========================================

print_header "Configuration PostgreSQL"

DEFAULT_DB_USER=$(echo "$APP_NAME" | sed 's/-/_/g')_user
read -p "Utilisateur PostgreSQL [$DEFAULT_DB_USER]: " DB_USER
DB_USER=${DB_USER:-$DEFAULT_DB_USER}

DEFAULT_DB_NAME=$(echo "$APP_NAME" | sed 's/-/_/g')_db
read -p "Nom de la base de données [$DEFAULT_DB_NAME]: " DB_NAME
DB_NAME=${DB_NAME:-$DEFAULT_DB_NAME}

while true; do
    read -s -p "Mot de passe PostgreSQL: " DB_PASSWORD
    echo ""
    if [ -z "$DB_PASSWORD" ]; then
        print_error "Le mot de passe ne peut pas être vide"
    else
        read -s -p "Confirmez le mot de passe: " DB_PASSWORD_CONFIRM
        echo ""
        if [ "$DB_PASSWORD" = "$DB_PASSWORD_CONFIRM" ]; then
            break
        else
            print_error "Les mots de passe ne correspondent pas"
        fi
    fi
done

# ==========================================
# CONFIGURATION OPTIONNELLE
# ==========================================

print_header "Configuration optionnelle"

# Stripe
read -p "Configurer Stripe ? (o/N): " CONFIGURE_STRIPE
if [[ "$CONFIGURE_STRIPE" =~ ^[oOyY]$ ]]; then
    read -p "Clé secrète Stripe (sk_...): " STRIPE_SECRET_KEY
    read -p "Clé publique Stripe (pk_...): " STRIPE_PUBLISHABLE_KEY
    read -p "Webhook secret Stripe (whsec_...): " STRIPE_WEBHOOK_SECRET
fi

# Variables d'environnement supplémentaires
read -p "Ajouter d'autres variables d'environnement ? (o/N): " ADD_EXTRA_ENV
EXTRA_ENV=""
if [[ "$ADD_EXTRA_ENV" =~ ^[oOyY]$ ]]; then
    echo "Entrez les variables au format NOM=valeur (ligne vide pour terminer) :"
    while true; do
        read -p "> " ENV_LINE
        if [ -z "$ENV_LINE" ]; then
            break
        fi
        EXTRA_ENV="$EXTRA_ENV$ENV_LINE\n"
    done
fi

# ==========================================
# RÉCAPITULATIF
# ==========================================

print_header "Récapitulatif de la configuration"

echo -e "${BLUE}Système :${NC}"
if [[ ! "$DO_SYSTEM_PREP" =~ ^[nN]$ ]]; then
    echo "  Préparation    : Oui (UFW, Fail2ban, Swap)"
    echo "  Timezone       : $TIMEZONE"
    if [[ ! "$CREATE_SWAP" =~ ^[nN]$ ]]; then
        echo "  Swap           : ${SWAP_SIZE}GB"
    fi
else
    echo "  Préparation    : Non"
fi
echo ""

echo -e "${BLUE}Application :${NC}"
echo "  Nom            : $APP_NAME"
echo "  Répertoire     : $APP_DIR"
echo "  Domaine        : $DOMAIN"
if [[ "$INCLUDE_WWW" =~ ^[oOyY]$ ]]; then
    echo "                   www.$DOMAIN"
fi
echo "  Port           : $APP_PORT"
echo ""

echo -e "${BLUE}Git :${NC}"
if [ -n "$GIT_URL" ]; then
    echo "  Dépôt          : $GIT_URL"
    echo "  Branche        : $GIT_BRANCH"
    echo "  Méthode        : $GIT_TYPE"
else
    echo "  Dépôt          : (déjà cloné)"
fi
if [ -n "$GIT_USER_NAME" ]; then
    echo "  Utilisateur    : $GIT_USER_NAME <$GIT_USER_EMAIL>"
fi
echo ""

echo -e "${BLUE}Base de données :${NC}"
echo "  Utilisateur    : $DB_USER"
echo "  Base           : $DB_NAME"
echo ""

if [[ "$CONFIGURE_STRIPE" =~ ^[oOyY]$ ]]; then
    echo -e "${BLUE}Stripe :${NC} Configuré"
    echo ""
fi

read -p "Continuer l'installation ? (O/n): " CONFIRM
if [[ "$CONFIRM" =~ ^[nN]$ ]]; then
    echo "Installation annulée."
    exit 0
fi

# ==========================================
# INSTALLATION
# ==========================================

print_header "Installation des dépendances système"

# Mise à jour système
echo ">>> Mise à jour du système..."
run_cmd apt update && run_cmd apt upgrade -y
print_status "Système mis à jour"

# Installation des outils de base
echo ">>> Installation des outils de base..."
run_cmd apt install -y curl wget git build-essential unzip htop
print_status "Outils de base installés"

# ==========================================
# PRÉPARATION SYSTÈME (SI DEMANDÉE)
# ==========================================

if [[ ! "$DO_SYSTEM_PREP" =~ ^[nN]$ ]]; then
    print_header "Configuration système Debian"
    
    # Timezone
    echo ">>> Configuration du fuseau horaire..."
    run_cmd timedatectl set-timezone "$TIMEZONE"
    print_status "Timezone configuré : $TIMEZONE"
    
    # Swap
    if [[ ! "$CREATE_SWAP" =~ ^[nN]$ ]]; then
        if [ ! -f /swapfile ]; then
            echo ">>> Création du fichier swap (${SWAP_SIZE}GB)..."
            run_cmd fallocate -l ${SWAP_SIZE}G /swapfile
            run_cmd chmod 600 /swapfile
            run_cmd mkswap /swapfile
            run_cmd swapon /swapfile
            echo '/swapfile none swap sw 0 0' | run_cmd tee -a /etc/fstab
            print_status "Swap créé : ${SWAP_SIZE}GB"
        else
            print_status "Swap déjà configuré"
        fi
    fi
    
    # Firewall UFW
    echo ">>> Configuration du firewall (UFW)..."
    run_cmd apt install -y ufw
    run_cmd ufw default deny incoming
    run_cmd ufw default allow outgoing
    run_cmd ufw allow ssh
    run_cmd ufw allow http
    run_cmd ufw allow https
    run_cmd ufw --force enable
    print_status "Firewall configuré (SSH, HTTP, HTTPS autorisés)"
    
    # Fail2ban
    echo ">>> Installation de Fail2ban..."
    run_cmd apt install -y fail2ban
    run_cmd systemctl enable fail2ban
    run_cmd systemctl start fail2ban
    print_status "Fail2ban installé (protection SSH)"
fi

# ==========================================
# CONFIGURATION GIT
# ==========================================

print_header "Configuration Git"

# Configuration globale Git
if [ -n "$GIT_USER_NAME" ]; then
    git config --global user.name "$GIT_USER_NAME"
fi
if [ -n "$GIT_USER_EMAIL" ]; then
    git config --global user.email "$GIT_USER_EMAIL"
fi

# Génération clé SSH si nécessaire
if [ "$SETUP_SSH_KEY" = true ]; then
    SSH_KEY_PATH="$HOME/.ssh/id_ed25519"
    if [ ! -f "$SSH_KEY_PATH" ]; then
        echo ">>> Génération de la clé SSH..."
        mkdir -p "$HOME/.ssh"
        ssh-keygen -t ed25519 -C "$GIT_USER_EMAIL" -f "$SSH_KEY_PATH" -N ""
        eval "$(ssh-agent -s)"
        ssh-add "$SSH_KEY_PATH"
        print_status "Clé SSH générée"
        
        echo ""
        echo -e "${YELLOW}=========================================="
        echo "  IMPORTANT : Ajoutez cette clé à GitHub/GitLab"
        echo "==========================================${NC}"
        echo ""
        cat "${SSH_KEY_PATH}.pub"
        echo ""
        echo "Allez sur : https://github.com/settings/ssh/new"
        echo "Ou : https://gitlab.com/-/profile/keys"
        echo ""
        read -p "Appuyez sur Entrée une fois la clé ajoutée..."
        
        # Test connexion
        echo ">>> Test de connexion SSH..."
        ssh -T git@github.com 2>&1 || true
    else
        print_status "Clé SSH existante trouvée"
    fi
fi

# ==========================================
# NODE.JS
# ==========================================

print_header "Installation de Node.js"

if ! command -v node &> /dev/null; then
    echo ">>> Installation de Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    run_cmd apt install -y nodejs
    print_status "Node.js $(node -v) installé"
else
    NODE_VERSION=$(node -v)
    print_status "Node.js $NODE_VERSION déjà installé"
fi

# ==========================================
# POSTGRESQL
# ==========================================

print_header "Installation de PostgreSQL"

if ! command -v psql &> /dev/null; then
    echo ">>> Installation de PostgreSQL..."
    run_cmd apt install -y postgresql postgresql-contrib
    run_cmd systemctl start postgresql
    run_cmd systemctl enable postgresql
    print_status "PostgreSQL installé"
else
    print_status "PostgreSQL déjà installé"
fi

# Configuration base de données
echo ">>> Configuration de la base de données..."

# Créer l'utilisateur si n'existe pas
run_cmd -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
    run_cmd -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

# Créer la base si n'existe pas
run_cmd -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
    run_cmd -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Accorder les permissions
run_cmd -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

print_status "Base de données configurée"

# ==========================================
# NGINX
# ==========================================

print_header "Installation de Nginx"

if ! command -v nginx &> /dev/null; then
    echo ">>> Installation de Nginx..."
    run_cmd apt install -y nginx
    run_cmd systemctl start nginx
    run_cmd systemctl enable nginx
    print_status "Nginx installé"
else
    print_status "Nginx déjà installé"
fi

# ==========================================
# PM2
# ==========================================

print_header "Installation de PM2"

if ! command -v pm2 &> /dev/null; then
    echo ">>> Installation de PM2..."
    run_cmd npm install -g pm2
    print_status "PM2 installé"
else
    print_status "PM2 déjà installé"
fi

# ==========================================
# APPLICATION
# ==========================================

print_header "Configuration de l'application"

# Créer le répertoire parent si nécessaire
PARENT_DIR=$(dirname "$APP_DIR")
if [ ! -d "$PARENT_DIR" ]; then
    run_cmd mkdir -p "$PARENT_DIR"
    run_cmd chown $USER:$USER "$PARENT_DIR"
fi

# Cloner le dépôt si URL fournie
if [ -n "$GIT_URL" ]; then
    # Construire l'URL avec token si HTTPS
    if [ "$GIT_TYPE" = "https" ] && [ -n "$GIT_TOKEN" ]; then
        # Extraire le domaine et le chemin de l'URL
        GIT_DOMAIN=$(echo "$GIT_URL" | sed -E 's|https://([^/]+)/.*|\1|')
        GIT_PATH=$(echo "$GIT_URL" | sed -E 's|https://[^/]+/(.*)|\1|')
        CLONE_URL="https://${GIT_TOKEN}@${GIT_DOMAIN}/${GIT_PATH}"
    else
        CLONE_URL="$GIT_URL"
    fi
    
    if [ -d "$APP_DIR" ]; then
        print_warning "Le répertoire existe déjà. Mise à jour..."
        cd "$APP_DIR"
        git pull origin "$GIT_BRANCH"
    else
        echo ">>> Clonage du dépôt..."
        git clone -b "$GIT_BRANCH" "$CLONE_URL" "$APP_DIR"
        
        # Reconfigurer l'URL sans le token pour la sécurité
        if [ "$GIT_TYPE" = "https" ] && [ -n "$GIT_TOKEN" ]; then
            cd "$APP_DIR"
            git remote set-url origin "$GIT_URL"
            # Configurer le credential helper pour stocker le token
            git config credential.helper store
            echo "https://${GIT_TOKEN}@${GIT_DOMAIN}" > ~/.git-credentials
            chmod 600 ~/.git-credentials
        fi
    fi
    run_cmd chown -R $USER:$USER "$APP_DIR"
    print_status "Dépôt cloné"
else
    if [ ! -d "$APP_DIR" ]; then
        print_error "Le répertoire $APP_DIR n'existe pas !"
        echo ""
        echo "Clonez d'abord votre dépôt avec :"
        echo "  sudo mkdir -p $PARENT_DIR"
        echo "  cd $PARENT_DIR"
        echo "  sudo git clone https://github.com/USERNAME/REPO.git $(basename $APP_DIR)"
        echo "  sudo chown -R \$USER:\$USER $APP_DIR"
        echo ""
        echo "Puis relancez ce script."
        exit 1
    fi
    print_status "Répertoire trouvé : $APP_DIR"
fi

cd "$APP_DIR"

# ==========================================
# FICHIER .ENV
# ==========================================

print_header "Configuration de l'environnement"

# Sauvegarde si existe
if [ -f ".env" ]; then
    print_warning "Fichier .env existant, sauvegarde vers .env.backup"
    cp .env .env.backup
fi

# Générer SESSION_SECRET
SESSION_SECRET=$(openssl rand -hex 32)

# Créer le fichier .env
cat > .env << EOF
# Configuration générée automatiquement le $(date)
NODE_ENV=production
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
SESSION_SECRET=$SESSION_SECRET
PORT=$APP_PORT
EOF

# Ajouter Stripe si configuré
if [[ "$CONFIGURE_STRIPE" =~ ^[oOyY]$ ]]; then
    cat >> .env << EOF

# Stripe
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
EOF
fi

# Ajouter variables supplémentaires
if [ -n "$EXTRA_ENV" ]; then
    echo "" >> .env
    echo "# Variables personnalisées" >> .env
    echo -e "$EXTRA_ENV" >> .env
fi

chmod 600 .env
print_status "Fichier .env créé"

# ==========================================
# DÉPENDANCES NPM
# ==========================================

print_header "Installation des dépendances"

echo ">>> Installation des dépendances npm..."
npm install
print_status "Dépendances installées"

# ==========================================
# BUILD
# ==========================================

print_header "Build de l'application"

echo ">>> Compilation de l'application..."
npm run build
print_status "Application compilée"

# ==========================================
# MIGRATION BASE DE DONNÉES
# ==========================================

print_header "Migration de la base de données"

echo ">>> Exécution des migrations..."
# Charger les variables d'environnement pour la migration
export $(cat .env | grep -v '^#' | xargs)
npm run db:push
print_status "Base de données migrée"

# ==========================================
# SCRIPT DE DÉMARRAGE PM2
# ==========================================

print_header "Configuration PM2"

# Créer le script de démarrage qui charge .env
cat > start.sh << 'STARTSCRIPT'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
set -a
source .env
set +a
exec npm start
STARTSCRIPT

chmod +x start.sh

# Arrêter l'ancienne instance si existe
pm2 delete "$APP_NAME" 2>/dev/null || true

# Démarrer avec PM2
pm2 start ./start.sh --name "$APP_NAME" --cwd "$APP_DIR"
pm2 save

print_status "Application démarrée avec PM2"

# ==========================================
# CONFIGURATION NGINX
# ==========================================

print_header "Configuration Nginx"

# Construire la liste des noms de serveur
if [[ "$INCLUDE_WWW" =~ ^[oOyY]$ ]]; then
    SERVER_NAMES="$DOMAIN www.$DOMAIN"
else
    SERVER_NAMES="$DOMAIN"
fi

# Créer la configuration Nginx
run_cmd tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
server {
    listen 80;
    server_name $SERVER_NAMES;

    # Taille max upload
    client_max_body_size 50M;

    # Logs
    access_log /var/log/nginx/${APP_NAME}_access.log;
    error_log /var/log/nginx/${APP_NAME}_error.log;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF

# Activer le site
run_cmd ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
run_cmd rm -f /etc/nginx/sites-enabled/default

# Tester et recharger Nginx
run_cmd nginx -t && run_cmd systemctl reload nginx
print_status "Nginx configuré"

# ==========================================
# DÉMARRAGE AUTOMATIQUE
# ==========================================

print_header "Configuration du démarrage automatique"

# Configurer le démarrage automatique
if [ "$RUN_AS_ROOT" = true ]; then
    pm2 startup systemd
else
    PM2_STARTUP=$(pm2 startup systemd -u $USER --hp $HOME 2>&1 | grep "sudo env")
    if [ -n "$PM2_STARTUP" ]; then
        eval $PM2_STARTUP
    fi
fi
pm2 save
print_status "Démarrage automatique configuré"

# ==========================================
# SSL (OPTIONNEL)
# ==========================================

print_header "Certificat SSL"

read -p "Installer le certificat SSL Let's Encrypt ? (O/n): " INSTALL_SSL

if [[ ! "$INSTALL_SSL" =~ ^[nN]$ ]]; then
    echo ">>> Installation de Certbot..."
    run_cmd apt install -y certbot python3-certbot-nginx
    
    echo ">>> Génération du certificat..."
    if [[ "$INCLUDE_WWW" =~ ^[oOyY]$ ]]; then
        run_cmd certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
            print_warning "Échec SSL automatique. Essayez manuellement :"
            echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
        }
    else
        run_cmd certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
            print_warning "Échec SSL automatique. Essayez manuellement :"
            echo "  sudo certbot --nginx -d $DOMAIN"
        }
    fi
    print_status "SSL configuré"
else
    print_info "SSL ignoré. Vous pouvez l'installer plus tard avec :"
    echo "  sudo apt install certbot python3-certbot-nginx"
    if [[ "$INCLUDE_WWW" =~ ^[oOyY]$ ]]; then
        echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    else
        echo "  sudo certbot --nginx -d $DOMAIN"
    fi
fi

# ==========================================
# RÉSUMÉ FINAL
# ==========================================

print_header "INSTALLATION TERMINÉE !"

echo -e "${GREEN}Votre application est maintenant en ligne !${NC}"
echo ""
echo "Accès :"
if [[ ! "$INSTALL_SSL" =~ ^[nN]$ ]]; then
    echo "  - https://$DOMAIN"
    if [[ "$INCLUDE_WWW" =~ ^[oOyY]$ ]]; then
        echo "  - https://www.$DOMAIN"
    fi
else
    echo "  - http://$DOMAIN"
fi
echo ""
echo "Fichiers importants :"
echo "  - Application : $APP_DIR"
echo "  - Configuration : $APP_DIR/.env"
echo "  - Nginx : /etc/nginx/sites-available/$APP_NAME"
echo ""
echo "Commandes utiles :"
echo "  - Voir les logs     : pm2 logs $APP_NAME"
echo "  - Redémarrer        : pm2 restart $APP_NAME"
echo "  - Arrêter           : pm2 stop $APP_NAME"
echo "  - Status            : pm2 status"
echo "  - Logs Nginx        : sudo tail -f /var/log/nginx/${APP_NAME}_error.log"
echo ""
echo "Base de données :"
echo "  - Connexion : psql -U $DB_USER -d $DB_NAME -h localhost"
echo ""

print_status "Installation complète !"
