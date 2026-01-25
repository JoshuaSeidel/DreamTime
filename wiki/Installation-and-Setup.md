# Installation & Setup

This guide covers deploying DreamTime on your own server.

## Quick Start with Docker

The easiest way to run DreamTime is with Docker Compose.

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 512MB RAM minimum
- 1GB disk space

### 1. Clone the Repository

```bash
git clone https://github.com/JoshuaSeidel/DreamTime.git
cd DreamTime
```

### 2. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` with your settings (see [Configuration](Configuration) for all options).

### 3. Start the Services

```bash
docker-compose up -d
```

This starts:
- **Server** on port 3000 (API)
- **Client** on port 80 (Web UI)

### 4. Access the App

Open `http://localhost` in your browser.

---

## Database Options

### SQLite (Default)

SQLite requires no additional setup. Data is stored in `./data/database/dreamtime.db`.

```env
DB_TYPE=sqlite
```

### PostgreSQL

For larger deployments or if you prefer PostgreSQL:

```env
DB_TYPE=postgresql
DATABASE_URL=postgresql://user:password@host:5432/dreamtime
```

You'll need to run a PostgreSQL server separately or use a managed service.

---

## Production Deployment

### Using Docker Compose

```bash
# Build and start in production mode
docker-compose -f docker-compose.yml up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables for Production

```env
# Required
NODE_ENV=production
CLIENT_URL=https://your-domain.com

# Database
DB_TYPE=sqlite  # or postgresql

# Security (auto-generated if not set)
JWT_SECRET=your-64-char-secret
JWT_REFRESH_SECRET=your-64-char-refresh-secret

# Push Notifications (auto-generated if not set)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@your-domain.com
```

### Reverse Proxy (Nginx)

If running behind a reverse proxy:

```nginx
server {
    listen 443 ssl http2;
    server_name dreamtime.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 9+

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

### 3. Start Development Servers

```bash
# Start both server and client with hot reload
npm run dev
```

Or separately:

```bash
# Terminal 1: Server
npm run dev:server

# Terminal 2: Client
npm run dev:client
```

### Development URLs

- **Client**: http://localhost:5173
- **Server**: http://localhost:3000
- **API Docs**: http://localhost:3000/documentation

---

## Unraid Setup

DreamTime works great on Unraid. Use Docker Compose through the Compose Manager plugin.

### 1. Install Compose Manager

1. Go to **Apps** in Unraid
2. Search for "Compose Manager"
3. Install it

### 2. Add DreamTime Stack

1. Go to **Docker > Compose**
2. Click **Add New Stack**
3. Name it "dreamtime"
4. Paste the docker-compose.yml contents
5. Add environment variables

### 3. Configure Paths

```yaml
volumes:
  - /mnt/user/appdata/dreamtime/data:/app/data
```

### 4. Port Mapping

Map port 80 to your desired port (e.g., 8080):

```yaml
ports:
  - "8080:80"  # Client
  - "3000:3000"  # Server API
```

---

## Health Checks

Both services include health checks:

```bash
# Server health
curl http://localhost:3000/health

# Client health (via Nginx)
curl http://localhost/health
```

Response: `{"status":"ok"}`

---

## Updating

### Docker Update

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build
```

### Manual Update

```bash
git pull
npm install
npm run db:migrate
npm run build
```

---

## Backup & Restore

### SQLite Backup

```bash
# Backup
cp ./data/database/dreamtime.db ./backup/dreamtime-$(date +%Y%m%d).db

# Restore
cp ./backup/dreamtime-YYYYMMDD.db ./data/database/dreamtime.db
```

### PostgreSQL Backup

```bash
# Backup
pg_dump -h localhost -U dreamtime dreamtime > backup.sql

# Restore
psql -h localhost -U dreamtime dreamtime < backup.sql
```

### Docker Volume Backup

```bash
# Backup data volume
docker run --rm -v dreamtime_data:/data -v $(pwd):/backup \
  alpine tar cvf /backup/dreamtime-data.tar /data

# Restore
docker run --rm -v dreamtime_data:/data -v $(pwd):/backup \
  alpine tar xvf /backup/dreamtime-data.tar
```

---

## Troubleshooting Installation

### Port Conflicts

If port 80 or 3000 is in use:

```yaml
# docker-compose.yml
services:
  client:
    ports:
      - "8080:80"  # Use 8080 instead
  server:
    ports:
      - "3001:3000"  # Use 3001 instead
```

### Permission Issues

```bash
# Fix data directory permissions
sudo chown -R 1000:1000 ./data
```

### Database Connection Failed

1. Check `DATABASE_URL` format
2. Ensure PostgreSQL is running
3. Verify network connectivity

See **[Troubleshooting](Troubleshooting)** for more solutions.
