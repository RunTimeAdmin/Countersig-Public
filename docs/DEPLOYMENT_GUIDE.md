# AgentID Production Deployment Guide

Complete guide for deploying AgentID on Ubuntu 22.04 VPS.

---

## VPS Environment (Confirmed)

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

---

## 1. Pre-Flight Check

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

---

## 2. Create PostgreSQL Database

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

> **Security Note:** Replace `CHANGE_THIS_STRONG_PASSWORD` with a strong, unique password. Store it securely as you'll need it for the environment configuration.

---

## 3. Clone Repository & Install Dependencies

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

---

## 4. Configure Environment

### Backend Environment

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

> **Important:** Replace `CHANGE_THIS_STRONG_PASSWORD` with the same password you used in Step 2.

### Frontend Environment

Create the frontend `.env` file:

```bash
cat > /var/www/agentid/frontend/.env << 'EOF'
VITE_AGENTID_API_URL=https://agentid.provenanceai.network
EOF
```

---

## 5. Run Database Migration

Initialize the database schema:

```bash
cd /var/www/agentid/backend

node -e "require('dotenv').config(); const { migrate } = require('./src/models/migrate'); migrate().then(() => { console.log('Migration complete'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });"
```

Expected output: `Migration complete`

---

## 6. Build Frontend for Production

```bash
cd /var/www/agentid/frontend
npm run build
```

The production build will be created in `/var/www/agentid/frontend/dist/`.

---

## 7. Configure Nginx

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

---

## 8. SSL Certificate

Obtain and configure SSL certificate using Certbot:

```bash
sudo certbot --nginx -d agentid.provenanceai.network
```

Follow the interactive prompts. Certbot will automatically:
- Obtain the certificate
- Update the Nginx configuration with SSL settings
- Set up auto-renewal

---

## 9. Start Backend with PM2

```bash
cd /var/www/agentid/backend

# Start the application
pm2 start server.js --name agentid --env production

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
curl https://agentid.provenanceai.network/health

# Check agents endpoint
curl https://agentid.provenanceai.network/agents

# Check PM2 status
pm2 list

# Check recent logs
pm2 logs agentid --lines 20

# Test the main site
curl -I https://agentid.provenanceai.network
```

Expected responses:
- `/health` should return `{"status":"ok"}`
- `/agents` should return a JSON array (empty `[]` initially)
- PM2 list should show `agentid` as `online`

---

## 11. Post-Deployment Tasks

After successful deployment:

1. **Register InfraWatch as the first agent** - Use the registration flow to add your first verified agent

2. **Test the Demo page** - Visit https://agentid.provenanceai.network/demo

3. **Test badge endpoint** - Try `/badge/{agentId}` with a registered agent

4. **Test widget** - Try `/widget/{agentId}` to verify widget rendering

5. **Set up monitoring** - Consider adding AgentID to your existing monitoring infrastructure

---

## Updating AgentID (Future Deployments)

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

---

## Troubleshooting

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

### Common Problems

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` on port 3002 | Check if backend is running: `pm2 list` |
| Database connection errors | Verify `.env` DATABASE_URL and PostgreSQL status |
| 502 Bad Gateway | Check backend is running and Nginx config is correct |
| SSL errors | Run `sudo certbot --nginx -d agentid.provenanceai.network` |
| Permission denied on `/var/www/agentid` | Check ownership: `sudo chown -R $USER:$USER /var/www/agentid` |

---

## Security Checklist

- [ ] Changed default database password
- [ ] `.env` file has restricted permissions (`chmod 600`)
- [ ] SSL certificate is active and auto-renewing
- [ ] Firewall rules restrict unnecessary ports
- [ ] Regular backups configured for PostgreSQL
- [ ] PM2 process monitoring is active
- [ ] Nginx security headers are in place

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/RunTimeAdmin/AgentID/issues
- Documentation: See `/docs` folder in repository
