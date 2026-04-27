# Build & Deployment

<cite>
**Referenced Files in This Document**
- [backend/package.json](file://backend/package.json)
- [frontend/package.json](file://frontend/package.json)
- [vite.config.js](file://frontend/vite.config.js)
- [server.js](file://backend/server.js)
- [index.js](file://backend/src/config/index.js)
- [db.js](file://backend/src/models/db.js)
- [redis.js](file://backend/src/models/redis.js)
- [rateLimit.js](file://backend/src/middleware/rateLimit.js)
- [errorHandler.js](file://backend/src/middleware/errorHandler.js)
- [api.js](file://frontend/src/lib/api.js)
- [main.jsx](file://frontend/src/main.jsx)
- [App.jsx](file://frontend/src/App.jsx)
- [Security.jsx](file://frontend/src/pages/Security.jsx)
- [agentid_build_plan.md](file://agentid_build_plan.md)
- [DEPLOYMENT_GUIDE.md](file://docs/DEPLOYMENT_GUIDE.md)
- [deploy.sh](file://deploy.sh)
- [SecurityPage.html](file://SecurityPage.html)
- [register-infrawatch-prod.js](file://register-infrawatch-prod.js)
- [test-register.js](file://test-register.js)
</cite>

## Update Summary
**Changes Made**
- Enhanced automated deployment script documentation to include new security page integration and registration automation scripts
- Updated deployment architecture to reflect the new Security page route and static asset serving
- Added documentation for registration automation scripts including InfraWatch production registration and testing utilities
- Expanded deployment verification steps to include security page accessibility testing
- Updated troubleshooting guide to include security page specific diagnostics

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Production Deployment Guide](#production-deployment-guide)
7. [Automated Deployment Script](#automated-deployment-script)
8. [Registration Automation Scripts](#registration-automation-scripts)
9. [Dependency Analysis](#dependency-analysis)
10. [Performance Considerations](#performance-considerations)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Conclusion](#conclusion)
13. [Appendices](#appendices)

## Introduction
This document provides comprehensive build and deployment guidance for the AgentID system. It covers the frontend build process (Vite compilation, asset optimization, bundle analysis, and static asset generation), backend deployment (Node.js application setup, process management with PM2, and server configuration), and the deployment architecture (Nginx server blocks, SSL certificate configuration with Certbot, and reverse proxy setup). It also includes CI/CD pipeline considerations, automated testing integration, deployment automation strategies, load balancing setup, monitoring configuration, rollback procedures, scaling considerations, performance optimization, and maintenance procedures for production deployments.

**Updated** Enhanced with new security page integration, registration automation scripts, and expanded deployment verification procedures.

## Project Structure
The AgentID project is organized into two primary areas:
- Backend: Node.js/Express application with routing, middleware, database, and Redis integration.
- Frontend: React/Vite application serving the registry explorer UI, security page, and embeddable widget.

```mermaid
graph TB
subgraph "Backend"
B_pkg["backend/package.json"]
B_srv["server.js"]
B_cfg["src/config/index.js"]
B_db["src/models/db.js"]
B_rd["src/models/redis.js"]
B_rl["src/middleware/rateLimit.js"]
B_err["src/middleware/errorHandler.js"]
end
subgraph "Frontend"
F_pkg["frontend/package.json"]
F_vite["vite.config.js"]
F_main["src/main.jsx"]
F_app["src/App.jsx"]
F_security["src/pages/Security.jsx"]
F_api["src/lib/api.js"]
end
F_vite --> F_main
F_main --> F_app
F_app --> F_security
F_app --> F_api
F_api --> B_srv
B_srv --> B_cfg
B_srv --> B_rl
B_srv --> B_err
B_srv --> B_db
B_srv --> B_rd
```

**Diagram sources**
- [server.js:1-107](file://backend/server.js#L1-L107)
- [index.js:1-34](file://backend/src/config/index.js#L1-L34)
- [db.js:1-45](file://backend/src/models/db.js#L1-L45)
- [redis.js:1-94](file://backend/src/models/redis.js#L1-L94)
- [rateLimit.js:1-62](file://backend/src/middleware/rateLimit.js#L1-L62)
- [errorHandler.js:1-44](file://backend/src/middleware/errorHandler.js#L1-L44)
- [frontend/package.json:1-35](file://frontend/package.json#L1-L35)
- [vite.config.js:1-42](file://frontend/vite.config.js#L1-L42)
- [main.jsx:1-11](file://frontend/src/main.jsx#L1-L11)
- [App.jsx:1-189](file://frontend/src/App.jsx#L1-L189)
- [Security.jsx:1-779](file://frontend/src/pages/Security.jsx#L1-L779)
- [api.js:1-140](file://frontend/src/lib/api.js#L1-L140)

**Section sources**
- [agentid_build_plan.md:258-302](file://agentid_build_plan.md#L258-L302)

## Core Components
- Backend application: Express server with health checks, CORS, rate limiting, and global error handling. Routes are mounted for registration, verification, badges, reputation, agents, attestations, and widgets.
- Configuration: Centralized environment-driven configuration for ports, external APIs, database, Redis, CORS, and cache TTLs.
- Data persistence: PostgreSQL connection pool with production SSL handling and robust error logging.
- Caching: Redis client with retry strategy, offline queue, and cache helpers for badge and challenge storage.
- Middleware: Rate limiting with configurable windows and limits, plus a global error handler.
- Frontend: React application built with Vite, Tailwind, and React Router, featuring a comprehensive Security page with cryptographic verification details and registration automation support.

**Section sources**
- [server.js:1-107](file://backend/server.js#L1-L107)
- [index.js:1-34](file://backend/src/config/index.js#L1-L34)
- [db.js:1-45](file://backend/src/models/db.js#L1-L45)
- [redis.js:1-94](file://backend/src/models/redis.js#L1-L94)
- [rateLimit.js:1-62](file://backend/src/middleware/rateLimit.js#L1-L62)
- [errorHandler.js:1-44](file://backend/src/middleware/errorHandler.js#L1-L44)
- [frontend/package.json:1-35](file://frontend/package.json#L1-L35)
- [vite.config.js:1-42](file://frontend/vite.config.js#L1-L42)
- [api.js:1-140](file://frontend/src/lib/api.js#L1-L140)

## Architecture Overview
The deployment architecture centers around a Node.js/Express backend exposed via Nginx reverse proxy with SSL termination handled by Certbot. The frontend is served statically by Nginx after Vite build, including the new Security page. PM2 manages the backend process with environment-specific configuration. **Critical**: The backend now includes proper trust proxy configuration to ensure accurate client IP detection behind reverse proxies.

```mermaid
graph TB
Client["Browser / Widgets"]
Nginx["Nginx Reverse Proxy<br/>SSL Termination (Certbot)<br/>Proxy Headers"]
API["AgentID API (Express)<br/>server.js<br/>Trust Proxy: 1"]
DB["PostgreSQL"]
Redis["Redis"]
SecurityPage["Security Page<br/>Static Content"]
Client --> Nginx
Nginx --> API
Nginx --> SecurityPage
API --> DB
API --> Redis
Nginx --> Static["Static Assets (Vite Build Output)"]
```

**Diagram sources**
- [server.js:44-45](file://backend/server.js#L44-L45)
- [db.js:1-45](file://backend/src/models/db.js#L1-L45)
- [redis.js:1-94](file://backend/src/models/redis.js#L1-L94)
- [agentid_build_plan.md:14-38](file://agentid_build_plan.md#L14-L38)

## Detailed Component Analysis

### Frontend Build Process (Vite)
- Build targets: Multi-page build with separate entry points for the main application, Security page, and the widget.
- Development server: Local port with proxy configuration to forward /api requests to the backend.
- Plugins: React and Tailwind integrations; custom middleware to serve the widget entry for widget routes in development.
- Asset optimization: Vite handles code splitting, minification, and asset hashing in production builds.
- Bundle analysis: Recommended to integrate Vite bundle analyzers during CI for visibility into bundle composition.
- Static asset generation: Production build outputs static assets under the Vite output directory for Nginx serving, including the new Security page.

```mermaid
flowchart TD
Start(["Vite Build"]) --> ReadCfg["Read vite.config.js"]
ReadCfg --> ResolveInputs["Resolve Inputs:<br/>index.html, widget.html, security.html"]
ResolveInputs --> Plugins["Apply Plugins:<br/>React, Tailwind, Widget Middleware"]
Plugins --> DevProxy["Configure Dev Proxy:<br/>/api -> http://localhost:3002"]
DevProxy --> BuildProd["Production Build"]
BuildProd --> Optimize["Optimize Assets<br/>Code Splitting, Minification"]
Optimize --> Output["Write Static Assets"]
Output --> End(["Serve via Nginx"])
```

**Diagram sources**
- [vite.config.js:1-42](file://frontend/vite.config.js#L1-L42)

**Section sources**
- [vite.config.js:1-42](file://frontend/vite.config.js#L1-L42)
- [frontend/package.json:1-35](file://frontend/package.json#L1-L35)

### Backend Deployment (Node.js + PM2)
- Application startup: Express app exported for modular use and started when executed as main module.
- Environment configuration: Centralized configuration reads from environment variables with sensible defaults.
- Process management: PM2 recommended for process lifecycle, restart policies, and environment isolation.
- Health checks: Built-in /health endpoint supports readiness/liveness probes.
- Security middleware: Helmet, CORS, and rate limiting applied globally.
- **Critical**: Trust proxy configuration ensures accurate client IP detection behind reverse proxies.

```mermaid
sequenceDiagram
participant PM2 as "PM2"
participant Node as "Node.js Process"
participant Express as "Express App"
participant Config as "Config Module"
participant DB as "PostgreSQL Pool"
participant Redis as "Redis Client"
PM2->>Node : Start process
Node->>Express : Load server.js
Express->>Express : Set trust proxy (1)
Express->>Config : Read env vars
Express->>Express : Apply middleware (Helmet, CORS, Rate Limit)
Express->>DB : Initialize pool
Express->>Redis : Connect client
Express->>Express : Mount routes
Express-->>PM2 : Ready (/health)
```

**Diagram sources**
- [server.js:44-45](file://backend/server.js#L44-L45)
- [index.js:1-34](file://backend/src/config/index.js#L1-L34)
- [db.js:1-45](file://backend/src/models/db.js#L1-L45)
- [redis.js:1-94](file://backend/src/models/redis.js#L1-L94)

**Section sources**
- [server.js:1-107](file://backend/server.js#L1-L107)
- [index.js:1-34](file://backend/src/config/index.js#L1-L34)
- [rateLimit.js:1-62](file://backend/src/middleware/rateLimit.js#L1-L62)
- [errorHandler.js:1-44](file://backend/src/middleware/errorHandler.js#L1-L44)

### Deployment Architecture (Nginx + SSL + Reverse Proxy)
- Server blocks: Configure virtual hosts for the domain(s) hosting AgentID, including security page routing.
- SSL certificates: Provision and renew certificates using Certbot.
- Reverse proxy: Forward /api requests to the backend service while serving static assets directly.
- Static delivery: Serve frontend build artifacts from the Vite output directory, including the new Security page.
- Security headers: Enforce HTTPS, HSTS, and other security best practices via Nginx.
- **Critical**: Proper trust proxy configuration ensures accurate client IP detection for rate limiting and security features.

```mermaid
flowchart TD
D_Start(["Incoming Request"]) --> SSL{"HTTPS?<br/>Certbot"}
SSL --> |No| Redirect["301 Redirect to HTTPS"]
SSL --> |Yes| Route{"Path?"}
Route --> |/api*| ProxyAPI["Proxy to Backend (PM2)<br/>with Trust Proxy Headers"]
Route --> |Security Page| Static["Serve Security Page<br/>from Vite Output"]
Route --> |Static Assets| StaticAssets["Serve from Vite Output"]
ProxyAPI --> D_End(["Response"])
Static --> D_End
StaticAssets --> D_End
Redirect --> D_End
```

**Diagram sources**
- [vite.config.js:31-40](file://frontend/vite.config.js#L31-L40)
- [api.js:3-8](file://frontend/src/lib/api.js#L3-L8)
- [agentid_build_plan.md:14-38](file://agentid_build_plan.md#L14-L38)

**Section sources**
- [vite.config.js:31-40](file://frontend/vite.config.js#L31-L40)
- [api.js:3-8](file://frontend/src/lib/api.js#L3-L8)

## Production Deployment Guide

### VPS Environment Requirements
The AgentID system is designed for deployment on Ubuntu 22.04 VPS with the following confirmed environment:

| Component | Status |
|-----------|--------|
| **OS** | Ubuntu 22.04.5 LTS |
| **PostgreSQL** | v14, localhost:5432 (running) |
| **Redis** | localhost:6379 (running) |
| **Node.js** | v20.20.2 (installed) |
| **PM2** | Running dissensus (3000) and infrawatch (3001) |
| **Nginx** | SSL configured, 2 sites active |
| **Port 3002** | FREE for AgentID backend |
| **Disk** | 180GB free |
| **RAM** | 14GB available |
| **Domain** | agentid.provenanceai.network |
| **GitHub** | https://github.com/RunTimeAdmin/AgentID |

### Pre-Flight Checks
Before starting deployment, verify all prerequisites:

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check Redis is running
sudo systemctl status redis-server

# Check Node.js version
node --version  # Should be v20.20.2

# Check PM2 is installed
pm2 --version

# Check Nginx is running
sudo systemctl status nginx

# Confirm port 3002 is free
sudo netstat -tlnp | grep 3002 || echo "Port 3002 is free"

# Verify DNS resolution
dig +short agentid.provenanceai.network
# Should return your VPS IP address
```

### Database Setup
Create the database and user for AgentID:

```bash
# Create database user (replace CHANGE_THIS_STRONG_PASSWORD with a secure password)
sudo -u postgres psql -c "CREATE USER agentid WITH PASSWORD 'CHANGE_THIS_STRONG_PASSWORD';"

# Create database
sudo -u postgres psql -c "CREATE DATABASE agentid OWNER agentid;"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE agentid TO agentid;"

# Verify database was created
sudo -u postgres psql -l | grep agentid
```

**Security Note:** Replace `CHANGE_THIS_STRONG_PASSWORD` with a strong, unique password. Store it securely as you'll need it for the environment configuration.

### Repository Setup and Dependencies
Clone the repository and install dependencies:

```bash
# Navigate to web root
cd /var/www

# Clone the repository
git clone https://github.com/RunTimeAdmin/AgentID.git agentid

# Install backend dependencies
cd agentid/backend
npm install --production

# Install frontend dependencies
cd ../frontend
npm install
```

### Environment Configuration
#### Backend Environment
Create the backend `.env` file:

```bash
cat > /var/www/agentid/backend/.env << 'EOF'
PORT=3002
NODE_ENV=production
DATABASE_URL=postgresql://agentid:CHANGE_THIS_STRONG_PASSWORD@localhost:5432/agentid
REDIS_URL=redis://localhost:6379
BAGS_API_KEY=bags_prod_mvg-MqxhjYTqlqB0CX8Xps-YC_CyYj9W6R3BrbM6B6U
SAID_GATEWAY_URL=https://said-identity-gateway.up.railway.app
CORS_ORIGIN=https://agentid.provenanceai.network
AGENTID_BASE_URL=https://agentid.provenanceai.network
BADGE_CACHE_TTL=60
CHALLENGE_EXPIRY_SECONDS=300
VERIFIED_THRESHOLD=70
EOF
```

**Important:** Replace `CHANGE_THIS_STRONG_PASSWORD` with the same password you used in Step 2.

#### Frontend Environment
Create the frontend `.env` file:

```bash
cat > /var/www/agentid/frontend/.env << 'EOF'
VITE_AGENTID_API_URL=https://agentid.provenanceai.network
EOF
```

### Database Migration
Initialize the database schema:

```bash
cd /var/www/agentid/backend

node -e "require('dotenv').config(); const { migrate } = require('./src/models/migrate'); migrate().then(() => { console.log('Migration complete'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });"
```

Expected output: `Migration complete`

### Frontend Build
Build the frontend for production:

```bash
cd /var/www/agentid/frontend
npm run build
```

The production build will be created in `/var/www/agentid/frontend/dist/`.

### Nginx Configuration
Create the Nginx site configuration:

```bash
sudo tee /etc/nginx/sites-available/agentid << 'EOF'
server {
    listen 80;
    server_name agentid.provenanceai.network;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name agentid.provenanceai.network;

    # SSL will be configured by certbot
    # ssl_certificate /etc/letsencrypt/live/agentid.provenanceai.network/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/agentid.provenanceai.network/privkey.pem;

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

    # Security page route
    location /security {
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
sudo ln -s /etc/nginx/sites-available/agentid /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### SSL Certificate
Obtain and configure SSL certificate using Certbot:

```bash
sudo certbot --nginx -d agentid.provenanceai.network
```

Follow the interactive prompts. Certbot will automatically:
- Obtain the certificate
- Update the Nginx configuration with SSL settings
- Set up auto-renewal

### Backend Startup with PM2
Start the backend with PM2:

```bash
cd /var/www/agentid/backend

# Start the application
pm2 start server.js --name agentid --env production

# Save PM2 configuration
pm2 save

# Optional: Set up PM2 startup script (if not already done)
pm2 startup systemd
```

### Deployment Verification
Run these checks to confirm everything is working:

```bash
# Health check
curl https://agentid.provenanceai.network/health

# Check agents endpoint
curl https://agentid.provenanceai.network/agents

# Check PM2 status
pm2 list

# Check recent logs
pm2 logs agentid --lines 20

# Test the main site
curl -I https://agentid.provenanceai.network

# Test security page
curl -I https://agentid.provenanceai.network/security
```

Expected responses:
- `/health` should return `{"status":"ok"}`
- `/agents` should return a JSON array (empty `[]` initially)
- PM2 list should show `agentid` as `online`
- Security page should return `200 OK`

### Post-Deployment Tasks
After successful deployment:

1. **Register InfraWatch as the first agent** - Use the registration flow to add your first verified agent
2. **Test the Demo page** - Visit https://agentid.provenanceai.network/demo
3. **Test badge endpoint** - Try `/badge/{agentId}` with a registered agent
4. **Test widget** - Try `/widget/{agentId}` to verify widget rendering
5. **Test security page** - Visit https://agentid.provenanceai.network/security to verify the new security documentation
6. **Set up monitoring** - Consider adding AgentID to your existing monitoring infrastructure

### Future Updates
When updating to a new version:

```bash
cd /var/www/agentid

# Pull latest changes
git pull origin main

# Update backend dependencies
cd backend && npm install --production

# Update and rebuild frontend
cd ../frontend && npm install && npm run build

# Restart the application
pm2 restart agentid

# Verify it's running
pm2 logs agentid --lines 10
```

## Automated Deployment Script

### Script Overview
The `deploy.sh` script automates deployment steps 2-10 from the production deployment guide, providing a one-shot deployment solution for Ubuntu 22.04 VPS environments.

**Updated** Enhanced with improved error handling and expanded verification procedures including security page accessibility testing.

### Prerequisites
Before running the script, edit the configuration section with your secure password and domain:

```bash
# Configuration - EDIT THESE VALUES
DB_PASSWORD="CHANGE_THIS_STRONG_PASSWORD"  # <-- CHANGE THIS!
DOMAIN="agentid.provenanceai.network"
REPO_URL="https://github.com/RunTimeAdmin/AgentID.git"
INSTALL_DIR="/var/www/agentid"
BACKEND_PORT=3002
```

### Script Features
- **Pre-flight checks**: Validates root privileges, required commands, port availability, and directory conflicts
- **Database automation**: Creates PostgreSQL user, database, and grants privileges
- **Dependency installation**: Installs backend and frontend dependencies
- **Environment configuration**: Generates secure `.env` files with proper permissions
- **Migration execution**: Runs database migrations automatically
- **Frontend building**: Builds production frontend assets including the new Security page
- **Nginx configuration**: Sets up SSL-enabled server blocks with proxy configuration for all routes including security page
- **SSL certificate**: Attempts automatic Certbot configuration with manual fallback
- **PM2 management**: Starts backend with proper environment configuration
- **Enhanced verification**: Tests health endpoints, agents endpoint, and security page accessibility

### Usage
```bash
# Make script executable
chmod +x deploy.sh

# Run with root privileges
sudo ./deploy.sh
```

### Error Handling
The script includes comprehensive error handling:
- Checks for required commands (psql, git, node, npm, pm2, nginx, certbot)
- Validates database password is changed from default
- Ensures port 3002 is available
- Handles existing directory conflicts with user confirmation
- Provides detailed error messages for troubleshooting

### Security Features
- **Restricted permissions**: `.env` files are secured with `chmod 600`
- **Password validation**: Requires changing default database password
- **Root requirement**: Ensures script runs with appropriate privileges
- **Safe directory handling**: Confirms directory removal if needed

## Registration Automation Scripts

### InfraWatch Production Registration Script
The `register-infrawatch-prod.js` script automates the registration of InfraWatch as the first production agent on AgentID, demonstrating the complete challenge-response verification flow.

**Features:**
- Generates Ed25519 keypair using tweetnacl library
- Implements cryptographic challenge-response verification
- Handles base58 encoding/decoding for signatures
- Provides step-by-step logging of the registration process
- Outputs credentials for VPS environment configuration

**Usage:**
```bash
node register-infrawatch-prod.js
```

**Section sources**
- [register-infrawatch-prod.js:1-149](file://register-infrawatch-prod.js#L1-L149)

### Test Registration Script
The `test-register.js` script provides a testing utility for validating the registration flow with mock data.

**Features:**
- Generates valid base58-encoded public keys
- Simulates complete registration flow
- Tests challenge-response verification process
- Provides detailed logging of API interactions

**Usage:**
```bash
node test-register.js
```

**Section sources**
- [test-register.js:1-73](file://test-register.js#L1-L73)

### Security Page Integration
The `SecurityPage.html` file provides a comprehensive security documentation page that complements the frontend Security component.

**Features:**
- Detailed explanation of cryptographic verification process
- Database schema transparency with sensitivity ratings
- Attack scenario analysis with prevention mechanisms
- Security best practices for agent operators
- Formal security audit documentation links

**Section sources**
- [SecurityPage.html:1-942](file://SecurityPage.html#L1-L942)

## Dependency Analysis
The backend depends on configuration, database, and Redis modules. The frontend depends on Vite configuration, React Router for navigation, and the Axios API client that proxies to the backend. The Security page adds additional routing dependencies for the new security documentation route.

```mermaid
graph LR
F_app["frontend/src/App.jsx"] --> F_security["frontend/src/pages/Security.jsx"]
F_api["frontend/src/lib/api.js"] --> B_srv["backend/server.js"]
B_srv --> B_cfg["backend/src/config/index.js"]
B_srv --> B_db["backend/src/models/db.js"]
B_srv --> B_rd["backend/src/models/redis.js"]
B_srv --> B_rl["backend/src/middleware/rateLimit.js"]
B_srv --> B_err["backend/src/middleware/errorHandler.js"]
```

**Diagram sources**
- [App.jsx:1-189](file://frontend/src/App.jsx#L1-L189)
- [Security.jsx:1-779](file://frontend/src/pages/Security.jsx#L1-L779)
- [api.js:1-140](file://frontend/src/lib/api.js#L1-L140)
- [server.js:1-107](file://backend/server.js#L1-L107)
- [index.js:1-34](file://backend/src/config/index.js#L1-L34)
- [db.js:1-45](file://backend/src/models/db.js#L1-L45)
- [redis.js:1-94](file://backend/src/models/redis.js#L1-L94)
- [rateLimit.js:1-62](file://backend/src/middleware/rateLimit.js#L1-L62)
- [errorHandler.js:1-44](file://backend/src/middleware/errorHandler.js#L1-L44)

**Section sources**
- [api.js:1-140](file://frontend/src/lib/api.js#L1-L140)
- [server.js:1-107](file://backend/server.js#L1-L107)

## Performance Considerations
- Database: Use connection pooling and SSL in production; monitor slow queries and tune indexes.
- Cache: Set appropriate TTLs for badges and challenges; monitor hit ratios and latency.
- Frontend: Analyze bundle size and remove unused dependencies; leverage lazy loading for routes.
- Network: Enable gzip/deflate and HTTP/2; consider CDN for static assets.
- Security: The new Security page adds minimal overhead as it's served statically by Nginx.

## Troubleshooting Guide

### Application Issues
```bash
# View application logs
pm2 logs agentid

# View application logs with more lines
pm2 logs agentid --lines 100

# Monitor real-time
pm2 monit

# Restart application
pm2 restart agentid

# Stop application
pm2 stop agentid
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
sudo -u postgres psql -d agentid -c "SELECT version();"

# Check table counts
sudo -u postgres psql -d agentid -c "SELECT count(*) FROM agent_identities;"

# List all tables
sudo -u postgres psql -d agentid -c "\dt"
```

### Backend Direct Test
```bash
# Test backend directly (bypass Nginx)
curl http://localhost:3002/health

# Test specific endpoints
curl http://localhost:3002/agents
curl http://localhost:3002/discover
```

### Security Page Specific Issues
**Updated** Added troubleshooting steps for the new Security page integration:

```bash
# Check if security page is accessible
curl -I http://localhost:3002/security

# Verify static file serving
ls -la /var/www/agentid/frontend/dist/security*

# Check Nginx security page route
sudo nginx -T | grep -A 10 -B 5 "location /security"

# Test frontend security route
curl -I https://agentid.provenanceai.network/security
```

### Proxy and Rate Limiting Issues
**Critical**: If you encounter rate limiting problems or incorrect client IP detection behind Nginx:

```bash
# Check if trust proxy is properly configured
curl -s http://localhost:3002/health | grep -i "trust"

# Verify client IP detection in logs
pm2 logs agentid --lines 50 | grep -i "ip\|client"

# Test rate limiting with curl
curl -H "X-Real-IP: 192.168.1.100" http://localhost:3002/agents
curl -H "X-Forwarded-For: 192.168.1.100" http://localhost:3002/agents

# Check Nginx proxy headers
sudo nginx -T | grep -A 5 -B 5 "proxy_set_header"
```

### Common Problems
| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` on port 3002 | Check if backend is running: `pm2 list` |
| Database connection errors | Verify `.env` DATABASE_URL and PostgreSQL status |
| 502 Bad Gateway | Check backend is running and Nginx config is correct |
| SSL errors | Run `sudo certbot --nginx -d agentid.provenanceai.network` |
| Permission denied on `/var/www/agentid` | Check ownership: `sudo chown -R $USER:$USER /var/www/agentid` |
| **Rate limiting issues** | **Verify trust proxy configuration in server.js** |
| **Incorrect client IPs** | **Check Nginx proxy headers and trust proxy setting** |
| **Security page not loading** | **Check Nginx security route configuration and static file serving** |
| **Registration automation failures** | **Verify tweetnacl and bs58 dependencies are installed** |

### Security Checklist
- [ ] Changed default database password
- [ ] `.env` file has restricted permissions (`chmod 600`)
- [ ] SSL certificate is active and auto-renewing
- [ ] Firewall rules restrict unnecessary ports
- [ ] Regular backups configured for PostgreSQL
- [ ] PM2 process monitoring is active
- [ ] Nginx security headers are in place
- [ ] **Trust proxy configuration is properly set in server.js**
- [ ] **Rate limiting respects client IP behind reverse proxy**
- [ ] **Security page is accessible and properly routed**
- [ ] **Registration automation scripts are functional**

**Section sources**
- [server.js:44-45](file://backend/server.js#L44-L45)
- [errorHandler.js:15-41](file://backend/src/middleware/errorHandler.js#L15-L41)
- [rateLimit.js:23-42](file://backend/src/middleware/rateLimit.js#L23-L42)
- [index.js:21-26](file://backend/src/config/index.js#L21-L26)
- [db.js:10-18](file://backend/src/models/db.js#L10-L18)
- [redis.js:9-20](file://backend/src/models/redis.js#L9-L20)

## Conclusion
The AgentID system combines a React/Vite frontend with a Node.js/Express backend, supported by PostgreSQL and Redis. For production, deploy behind Nginx with SSL managed by Certbot, run the backend with PM2, and implement CI/CD with automated testing and deployment automation. **Critical**: The backend now includes proper trust proxy configuration to ensure accurate client IP detection behind reverse proxies, which is essential for effective rate limiting and security features. The comprehensive deployment guide and automated script provide streamlined deployment processes for Ubuntu 22.04 VPS environments, ensuring reliable and repeatable production deployments with robust error handling, security practices, and proper reverse proxy support.

**Updated** Enhanced with new security page integration, registration automation scripts, and expanded deployment verification procedures to support the comprehensive security documentation and automated agent registration workflows.

## Appendices
- Environment variables and deployment notes are documented in the build plan, including database URLs, Redis configuration, CORS origins, and cache TTLs.
- The automated deployment script provides a complete solution for production deployments with pre-flight checks, error handling, and verification steps.
- **Trust proxy configuration is now a critical security feature that ensures proper client IP detection and effective rate limiting behind Nginx reverse proxies.**
- **Registration automation scripts provide automated testing and production agent registration capabilities.**
- **Security page integration enhances transparency and provides comprehensive cryptographic verification documentation.**

**Section sources**
- [agentid_build_plan.md:309-330](file://agentid_build_plan.md#L309-L330)
- [DEPLOYMENT_GUIDE.md:1-476](file://docs/DEPLOYMENT_GUIDE.md#L1-L476)
- [deploy.sh:1-414](file://deploy.sh#L1-L414)
- [register-infrawatch-prod.js:1-149](file://register-infrawatch-prod.js#L1-L149)
- [test-register.js:1-73](file://test-register.js#L1-L73)
- [SecurityPage.html:1-942](file://SecurityPage.html#L1-L942)