# Countersig Production Deployment Guide

Complete guide for deploying Countersig 2.0 in production.

---

## v2.0 Changes

Countersig 2.0 introduces significant platform upgrades over v1:

- **JWT-based authentication** with access/refresh token rotation and Redis-backed session management
- **RBAC with org-scoped roles**: viewer, member, manager, admin
- **User registration and login endpoints** (`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`)
- **Stripe billing integration** — requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER_ID`, and `STRIPE_PRICE_PROFESSIONAL_ID` environment variables
- **Quota enforcement middleware** — usage-based limits per plan tier
- **New database tables**: `organizations`, `users`, `api_keys`, `audit_logs`, `webhooks`, `policies`, `org_plans`, `billing_events`
- **Docker Compose deployment** with Caddy for automatic TLS (recommended over bare-metal Nginx)

---

## Docker Compose Deployment (Recommended)

The recommended production deployment uses a **5-container Docker Compose stack**:

| Container | Role |
|-----------|------|
| **postgres** | PostgreSQL 16 database |
| **redis** | Redis 7 cache and session store |
| **backend** | Node.js Express API server (port 3002) |
| **caddy** | Automatic TLS/SSL termination and reverse proxy |
| **db-backup** | Scheduled PostgreSQL backups |

### Configuration Files

- **`docker-compose.yml`** — local development stack (repo root)
- **`docker-compose.prod.yml`** — production stack (repo root)
- **`Caddyfile`** — Caddy reverse proxy configuration (repo root)
- **`backend/Dockerfile`** — backend container image

### How Caddy Works

[Caddy](https://caddyserver.com/) serves as the TLS-terminating reverse proxy:

- Listens on ports **80** and **443**
- Automatically obtains and renews Let's Encrypt TLS certificates
- Redirects all HTTP traffic to HTTPS
- Proxies HTTPS requests on port 443 to the backend container on port 3002
- No manual certificate management required

### Environment Variables

Set the required environment variables in your `.env` file or Docker Compose environment section. See the **Required Environment Variables** table in [README.md](../README.md) for the full list.

Key variables for Docker Compose production:

```bash
# Database
POSTGRES_USER=countersig
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=countersig
DATABASE_URL=postgresql://countersig:<password>@postgres:5432/countersig

# Redis
REDIS_PASSWORD=<strong-random-password>
REDIS_HOST=redis
REDIS_PORT=6379

# Application
NODE_ENV=production
PORT=3002
JWT_SECRET=<64-char-hex-secret>
CORS_ORIGIN=https://countersig.com
COUNTERSIG_BASE_URL=https://api.countersig.com

# Stripe (if billing enabled)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_ID=price_...
STRIPE_PRICE_PROFESSIONAL_ID=price_...
```

### Deployment Commands

```bash
# Start the full production stack
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart a specific service
docker compose -f docker-compose.prod.yml restart backend

# Stop all services
docker compose -f docker-compose.prod.yml down
```

### Health Check

```bash
# Verify the API is running behind Caddy with valid TLS
curl https://api.countersig.com/health
# Expected: {"status":"ok"}
```

---

## VPS Environment (Reference)

| Component | Status |
|-----------|--------|
| **OS** | Ubuntu 22.04.5 LTS |
| **PostgreSQL** | v16 (via Docker or native) |
| **Redis** | v7 (via Docker or native) |
| **Node.js** | v20+ |
| **Port 3002** | Backend API |
| **Domain (API)** | api.countersig.com |
| **Domain (Frontend)** | countersig.com |
| **GitHub** | https://github.com/RunTimeAdmin/AgentID-2.0 |

---

## 1. Pre-Flight Check

Before starting deployment, verify all prerequisites:

```bash
# Check Docker and Docker Compose are installed
docker --version
docker compose version

# Check DNS resolution
dig +short api.countersig.com
# Should return your VPS IP address

# Confirm port 443 is available
sudo netstat -tlnp | grep 443 || echo "Port 443 is free"
```

---

## 2. Create PostgreSQL Database

> **Note:** If using Docker Compose (recommended), the database is created automatically. This section is for bare-metal installations only.

Create the database and user for Countersig:

```bash
# Create database user (replace CHANGE_THIS_STRONG_PASSWORD with a secure password)
sudo -u postgres psql -c "CREATE USER countersig WITH PASSWORD 'CHANGE_THIS_STRONG_PASSWORD';"

# Create database
sudo -u postgres psql -c "CREATE DATABASE countersig OWNER countersig;"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE countersig TO countersig;"

# Verify database was created
sudo -u postgres psql -l | grep countersig
```

> **Security Note:** Replace `CHANGE_THIS_STRONG_PASSWORD` with a strong, unique password. Store it securely as you'll need it for the environment configuration.

---

## 3. Clone Repository & Install Dependencies

```bash
# Navigate to web root
cd /var/www

# Clone the repository
git clone https://github.com/RunTimeAdmin/AgentID-2.0.git countersig

# Install backend dependencies
cd countersig/backend
npm install --production

# Install frontend dependencies
cd ../frontend
npm install
```

---

## 4. Configure Environment

### Backend Environment

Create the backend `.env` file:

```bash
cat > /var/www/countersig/backend/.env << 'EOF'
PORT=3002
NODE_ENV=production
DATABASE_URL=postgresql://countersig:CHANGE_THIS_STRONG_PASSWORD@localhost:5432/countersig
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=https://countersig.com
COUNTERSIG_BASE_URL=https://api.countersig.com
JWT_SECRET=<generate-a-64-char-hex-secret>
BADGE_CACHE_TTL=60
CHALLENGE_EXPIRY_SECONDS=300
VERIFIED_THRESHOLD=70

# Stripe billing (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_ID=price_...
STRIPE_PRICE_PROFESSIONAL_ID=price_...
EOF
```

> **Important:** Replace `CHANGE_THIS_STRONG_PASSWORD` with the same password you used in Step 2.

### Frontend Environment

Create the frontend `.env` file:

```bash
cat > /var/www/countersig/frontend/.env << 'EOF'
VITE_API_URL=https://api.countersig.com
EOF
```

---

## 5. Run Database Migration

Initialize the database schema:

```bash
cd /var/www/countersig/backend

node -e "require('dotenv').config(); const { migrate } = require('./src/models/migrate'); migrate().then(() => { console.log('Migration complete'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });"
```

Expected output: `Migration complete`

---

## 6. Build Frontend for Production

```bash
cd /var/www/countersig/frontend
npm run build
```

The production build will be created in `/var/www/countersig/frontend/dist/`.

---

## 7. Alternative: Nginx Setup

> **Note:** The recommended approach is Docker Compose with Caddy (see above). Use Nginx only if you have an existing Nginx installation you want to reuse.

Create the Nginx site configuration:

```bash
sudo tee /etc/nginx/sites-available/countersig << 'EOF'
server {
    listen 80;
    server_name api.countersig.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.countersig.com;

    # SSL will be configured by certbot
    # ssl_certificate /etc/letsencrypt/live/api.countersig.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/api.countersig.com/privkey.pem;

    # Frontend (static files)
    root /var/www/countersig/frontend/dist;
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

    # SPA fallback — all other routes serve the React app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css image/svg+xml;
    gzip_min_length 1000;
}
EOF
```

Enable the site:

```bash
# Create symlink to enable site
sudo ln -s /etc/nginx/sites-available/countersig /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 8. SSL Certificate (Nginx only)

> **Note:** If using Caddy, TLS certificates are managed automatically. This step is only needed for Nginx.

Obtain and configure SSL certificate using Certbot:

```bash
sudo certbot --nginx -d api.countersig.com
```

Follow the interactive prompts. Certbot will automatically:
- Obtain the certificate
- Update the Nginx configuration with SSL settings
- Set up auto-renewal

---

## 9. Start Backend with PM2 (Bare-Metal only)

> **Note:** If using Docker Compose, the backend starts automatically. This step is for bare-metal deployments only.

```bash
cd /var/www/countersig/backend

# Start the application
pm2 start server.js --name countersig --env production

# Save PM2 configuration
pm2 save

# Optional: Set up PM2 startup script (if not already done)
pm2 startup systemd
```

---

## 10. Verify Deployment

Run these checks to confirm everything is working:

```bash
# Health check
curl https://api.countersig.com/health

# Check agents endpoint
curl https://api.countersig.com/agents

# Check PM2 status (bare-metal only)
pm2 list

# Check Docker containers (Docker Compose only)
docker compose -f docker-compose.prod.yml ps

# Check recent logs
pm2 logs countersig --lines 20                              # bare-metal
docker compose -f docker-compose.prod.yml logs backend    # Docker

# Test the main site
curl -I https://countersig.com
```

Expected responses:
- `/health` should return `{"status":"ok"}`
- `/agents` should return a JSON array (empty `[]` initially)
- PM2 list should show `countersig` as `online` (bare-metal) or Docker shows all containers healthy

---

## 11. Post-Deployment Tasks

After successful deployment:

1. **Register your first agent** — Use the registration flow to add your first verified agent

2. **Test the frontend** — Visit https://countersig.com

3. **Test badge endpoint** — Try `/badge/{agentId}` with a registered agent

4. **Test widget** — Try `/widget/{agentId}` to verify widget rendering

5. **Set up monitoring** — Consider adding Countersig to your existing monitoring infrastructure

---

## Updating Countersig (Future Deployments)

### Docker Compose (Recommended)

```bash
cd /var/www/countersig

# Pull latest changes
git pull origin main

# Rebuild and restart containers
docker compose -f docker-compose.prod.yml up -d --build

# Verify health
curl https://api.countersig.com/health
```

### Bare-Metal

```bash
cd /var/www/countersig

# Pull latest changes
git pull origin main

# Update backend dependencies
cd backend && npm install --production

# Update and rebuild frontend
cd ../frontend && npm install && npm run build

# Restart the application
pm2 restart countersig

# Verify it's running
pm2 logs countersig --lines 10
```

---

## Troubleshooting

### Application Issues

```bash
# View application logs (bare-metal)
pm2 logs countersig
pm2 logs countersig --lines 100
pm2 monit

# View application logs (Docker)
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f caddy

# Restart application
pm2 restart countersig                                          # bare-metal
docker compose -f docker-compose.prod.yml restart backend    # Docker
```

### Nginx Issues

```bash
# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Database Issues

```bash
# Check database connection
sudo -u postgres psql -d countersig -c "SELECT version();"

# Check table counts
sudo -u postgres psql -d countersig -c "SELECT count(*) FROM agent_identities;"

# List all tables
sudo -u postgres psql -d countersig -c "\dt"

# Docker: connect to database container
docker compose -f docker-compose.prod.yml exec postgres psql -U countersig -d countersig -c "\dt"
```

### Backend Direct Test

```bash
# Test backend directly (bypass reverse proxy)
curl http://localhost:3002/health

# Test specific endpoints
curl http://localhost:3002/agents
curl http://localhost:3002/discover
```

### Common Problems

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` on port 3002 | Check if backend is running: `pm2 list` or `docker compose ps` |
| Database connection errors | Verify `.env` DATABASE_URL and PostgreSQL status |
| 502 Bad Gateway | Check backend is running and proxy config is correct |
| SSL errors (Nginx) | Run `sudo certbot --nginx -d api.countersig.com` |
| SSL errors (Caddy) | Check Caddy logs: `docker compose logs caddy` — ensure DNS A record points to VPS |
| Permission denied on `/var/www/countersig` | Check ownership: `sudo chown -R $USER:$USER /var/www/countersig` |
| Caddy not getting certificate | Ensure port 80 and 443 are open and DNS resolves correctly |

---

## Security Checklist

- [ ] Changed default database password
- [ ] `.env` file has restricted permissions (`chmod 600`)
- [ ] SSL certificate is active and auto-renewing
- [ ] Firewall rules restrict unnecessary ports
- [ ] Regular backups configured for PostgreSQL
- [ ] PM2 process monitoring is active (bare-metal) or Docker restart policies set
- [ ] Security headers are in place (Nginx or Caddy)
- [ ] JWT_SECRET is a strong 64-character hex string
- [ ] Stripe webhook secret is configured (if billing enabled)

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/RunTimeAdmin/AgentID-2.0/issues
- Documentation: See `/docs` folder in repository
