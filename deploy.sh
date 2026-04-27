#!/bin/bash
#
# AgentID One-Shot Deployment Script
# Automates deployment steps 2-10 from DEPLOYMENT_GUIDE.md
#
# Usage:
#   1. Edit DB_PASSWORD below with a secure password
#   2. Run: chmod +x deploy.sh && sudo ./deploy.sh
#

set -e  # Exit on any error

# ============================================================================
# CONFIGURATION - EDIT THESE VALUES
# ============================================================================
DB_PASSWORD="CHANGE_THIS_STRONG_PASSWORD"  # <-- CHANGE THIS!
JWT_SECRET="CHANGE_THIS_JWT_SECRET"        # <-- CHANGE THIS! Minimum 32 chars
DOMAIN="agentid2.provenanceai.network"     # Production domain for AgentID 2.0
REPO_URL="https://github.com/RunTimeAdmin/AgentID-2.0.git"
INSTALL_DIR="/var/www/agentid"
BACKEND_PORT=3002

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# FUNCTIONS
# ============================================================================
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed"
        exit 1
    fi
}

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================
echo "========================================"
echo "AgentID Deployment Script"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (use sudo)"
    exit 1
fi

# Check if password has been changed
if [ "$DB_PASSWORD" = "CHANGE_THIS_STRONG_PASSWORD" ]; then
    log_error "Please change DB_PASSWORD in this script before running!"
    exit 1
fi

if [ ${#DB_PASSWORD} -lt 8 ]; then
    log_error "DB_PASSWORD must be at least 8 characters"
    exit 1
fi

# Check JWT_SECRET has been changed
if [ "$JWT_SECRET" = "CHANGE_THIS_JWT_SECRET" ]; then
    log_error "Please change JWT_SECRET in this script before running!"
    exit 1
fi

if [ ${#JWT_SECRET} -lt 32 ]; then
    log_error "JWT_SECRET must be at least 32 characters for security"
    exit 1
fi

# Check required commands
log_info "Checking prerequisites..."
check_command psql
check_command git
check_command node
check_command npm
check_command pm2
check_command nginx
check_command certbot

# Check if port is free
if netstat -tlnp 2>/dev/null | grep -q ":$BACKEND_PORT "; then
    log_error "Port $BACKEND_PORT is already in use"
    exit 1
fi
log_info "Port $BACKEND_PORT is free"

# Check if directory already exists
if [ -d "$INSTALL_DIR" ]; then
    log_warn "Directory $INSTALL_DIR already exists"
    read -p "Remove existing directory? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        log_error "Deployment cancelled"
        exit 1
    fi
fi

# ============================================================================
# STEP 2: CREATE DATABASE
# ============================================================================
echo ""
log_info "Step 2: Creating PostgreSQL database and user..."

# Create user
sudo -u postgres psql -c "CREATE USER agentid WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
    log_warn "User 'agentid' may already exist, continuing..."
}

# Create database
sudo -u postgres psql -c "CREATE DATABASE agentid OWNER agentid;" 2>/dev/null || {
    log_warn "Database 'agentid' may already exist, continuing..."
}

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE agentid TO agentid;"

log_info "Database setup complete"

# ============================================================================
# STEP 3: CLONE & INSTALL DEPENDENCIES
# ============================================================================
echo ""
log_info "Step 3: Cloning repository and installing dependencies..."

cd /var/www
git clone "$REPO_URL" agentid

cd "$INSTALL_DIR/backend"
npm install --production

# Ensure AgentID 2.0 dependencies are present
log_info "Verifying AgentID 2.0 dependencies..."
npm ls jsonwebtoken bcryptjs uuid > /dev/null 2>&1 || {
    log_warn "Some 2.0 dependencies missing, reinstalling..."
    npm install jsonwebtoken bcryptjs uuid
}

cd "$INSTALL_DIR/frontend"
npm install

log_info "Dependencies installed"

# ============================================================================
# STEP 4: CONFIGURE ENVIRONMENT
# ============================================================================
echo ""
log_info "Step 4: Configuring environment files..."

# Backend .env
cat > "$INSTALL_DIR/backend/.env" << EOF
PORT=$BACKEND_PORT
NODE_ENV=production
DATABASE_URL=postgresql://agentid:$DB_PASSWORD@localhost:5432/agentid
REDIS_URL=redis://localhost:6379
BAGS_API_KEY=bags_prod_mvg-MqxhjYTqlqB0CX8Xps-YC_CyYj9W6R3BrbM6B6U
SAID_GATEWAY_URL=https://said-identity-gateway.up.railway.app
# Production CORS origin for AgentID 2.0 dashboard
CORS_ORIGIN=https://$DOMAIN
AGENTID_BASE_URL=https://$DOMAIN
BADGE_CACHE_TTL=60
CHALLENGE_EXPIRY_SECONDS=300
VERIFIED_THRESHOLD=70
# Authentication (AgentID 2.0)
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
DEFAULT_ORG_NAME=Default Organization
API_KEY_PREFIX=aid_
EOF

# Frontend .env
cat > "$INSTALL_DIR/frontend/.env" << EOF
VITE_AGENTID_API_URL=https://$DOMAIN
EOF

# Secure the .env files
chmod 600 "$INSTALL_DIR/backend/.env"
chmod 600 "$INSTALL_DIR/frontend/.env"

log_info "Environment files created"

# ============================================================================
# STEP 5: RUN DATABASE MIGRATION
# ============================================================================
echo ""
log_info "Step 5: Running database migration..."

cd "$INSTALL_DIR/backend"

node -e "
require('dotenv').config();
const { migrate } = require('./src/models/migrate');
migrate()
  .then(() => {
    console.log('Migration complete');
    process.exit(0);
  })
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
"

log_info "Database migration complete"

# ============================================================================
# STEP 5b: RUN V2 MIGRATION (AgentID 2.0)
# ============================================================================
echo ""
log_info "Step 5b: Running AgentID 2.0 migration..."

cd "$INSTALL_DIR/backend"

node -e "
require('dotenv').config();
const { pool } = require('./src/models/db');
const { runV2Migration } = require('./src/models/migrate-v2');
runV2Migration(pool)
  .then(() => {
    console.log('V2 migration complete');
    process.exit(0);
  })
  .catch(e => {
    console.error('V2 migration failed:', e);
    process.exit(1);
  });
"

log_info "AgentID 2.0 migration complete"

# ============================================================================
# STEP 6: BUILD FRONTEND
# ============================================================================
echo ""
log_info "Step 6: Building frontend for production..."

cd "$INSTALL_DIR/frontend"
npm run build

log_info "Frontend build complete"

# ============================================================================
# STEP 7: CONFIGURE NGINX
# ============================================================================
echo ""
log_info "Step 7: Configuring Nginx..."

cat > /etc/nginx/sites-available/agentid << 'EOF'
server {
    listen 80;
    server_name agentid2.provenanceai.network;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name agentid2.provenanceai.network;

    # Frontend (static files)
    root /var/www/agentid/frontend/dist;
    index index.html;

    # API proxy to backend
    location /register {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /verify {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /agents {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /badge {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /widget {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /reputation {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /discover {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # AgentID 2.0 authenticated routes
    location /auth {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api-keys {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /orgs {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /audit {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /policies {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /webhooks {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain application/json application/javascript text/css image/svg+xml;
    gzip_min_length 1000;
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/agentid /etc/nginx/sites-enabled/

# Test and reload
nginx -t
systemctl reload nginx

log_info "Nginx configured"

# ============================================================================
# STEP 8: SSL CERTIFICATE
# ============================================================================
echo ""
log_info "Step 8: Obtaining SSL certificate..."

# Run certbot non-interactively if possible, otherwise inform user
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN 2>/dev/null; then
    log_info "SSL certificate obtained successfully"
else
    log_warn "Certbot requires interactive input. Please run manually:"
    echo "  sudo certbot --nginx -d $DOMAIN"
    read -p "Press Enter to continue after running certbot manually..."
fi

# ============================================================================
# STEP 9: START BACKEND WITH PM2
# ============================================================================
echo ""
log_info "Step 9: Starting backend with PM2..."

cd "$INSTALL_DIR/backend"

# Stop existing process if running
pm2 delete agentid 2>/dev/null || true

# Start new process
pm2 start server.js --name agentid --env production

# Save PM2 config
pm2 save

log_info "Backend started with PM2"

# ============================================================================
# STEP 10: VERIFY DEPLOYMENT
# ============================================================================
echo ""
log_info "Step 10: Verifying deployment..."

echo ""
echo "Checking PM2 status:"
pm2 list

echo ""
echo "Waiting 5 seconds for services to start..."
sleep 5

echo ""
echo "Testing health endpoint:"
if curl -s http://localhost:$BACKEND_PORT/health | grep -q "ok"; then
    log_info "Backend health check: PASSED"
else
    log_error "Backend health check: FAILED"
fi

echo ""
echo "Testing agents endpoint:"
curl -s http://localhost:$BACKEND_PORT/agents | head -c 100
echo ""

# ============================================================================
# COMPLETION
# ============================================================================
echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "AgentID is now deployed at:"
echo "  https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  pm2 logs agentid       - View application logs"
echo "  pm2 restart agentid    - Restart the application"
echo "  pm2 status             - Check application status"
echo ""
echo "Next steps:"
echo "  1. Visit https://$DOMAIN to verify the site loads"
echo "  2. Visit https://$DOMAIN/demo to test the demo page"
echo "  3. Register your first agent via the registration flow"
echo ""
echo "For troubleshooting, see docs/DEPLOYMENT_GUIDE.md"
echo ""
