# DreamTime - Unraid Setup Guide

This guide covers deploying DreamTime on Unraid with full functionality including MQTT integration for Home Assistant.

## Overview

DreamTime on Unraid uses:
- **Pre-built Docker images** from GitHub Container Registry
- **macvlan networking** for LAN access (required for MQTT)
- **External networks** for reverse proxy and database connectivity
- **PostgreSQL** as the database (recommended for production)

## Prerequisites

1. **Unraid 6.9+** with Docker enabled
2. **PostgreSQL container** (official or community app)
3. **Reverse proxy** (optional but recommended): SWAG, Nginx Proxy Manager, or Traefik
4. **Home Assistant** with Mosquitto MQTT broker (for voice control integration)

## Quick Start

### 1. Create Required Networks

```bash
# Create PostgreSQL network (if not exists)
docker network create psql

# Create reverse proxy network (if using SWAG)
docker network create swag
```

### 2. Copy Configuration Files

```bash
# Create directory for DreamTime
mkdir -p /mnt/user/appdata/dreamtime/data

# Download docker-compose and env example
cd /mnt/user/appdata/dreamtime
wget https://raw.githubusercontent.com/JoshuaSeidel/DreamTime/main/docker-compose.unraid.yml
wget https://raw.githubusercontent.com/JoshuaSeidel/DreamTime/main/.env.unraid.example -O .env
```

### 3. Configure Environment

Edit `.env` with your settings:

```bash
nano .env
```

Key settings to configure:
- `DATABASE_URL` - Your PostgreSQL connection string
- `CLIENT_URL` - URL users access DreamTime from
- `MQTT_*` - Home Assistant MQTT settings
- `LAN_*` - Network settings for your subnet

### 4. Deploy

```bash
docker-compose -f docker-compose.unraid.yml up -d
```

## Network Configuration

### Understanding macvlan

DreamTime uses a **macvlan** network to give the server container its own IP address on your LAN. This is necessary because:

1. Docker bridge networks are isolated from LAN
2. MQTT broker (Home Assistant) is on LAN
3. Server needs direct LAN access to communicate with MQTT

### macvlan Setup

The `docker-compose.unraid.yml` creates a macvlan network with these defaults:

```yaml
lan:
  driver: macvlan
  driver_opts:
    parent: br0  # Your network interface
  ipam:
    config:
      - subnet: 192.168.6.0/24
      - ip_range: 192.168.6.240/28  # 16 IPs: .240-.255
      - gateway: 192.168.6.1
```

**Customize for your network:**

| Setting | Description | Example |
|---------|-------------|---------|
| `LAN_PARENT_INTERFACE` | Network interface | `br0`, `eth0`, `bond0`, `br0.2` (VLAN) |
| `LAN_SUBNET` | Your LAN subnet | `192.168.1.0/24` |
| `LAN_IP_RANGE` | Container IP range | `192.168.1.240/28` |
| `LAN_GATEWAY` | Router IP | `192.168.1.1` |
| `SERVER_LAN_IP` | Server's static IP | `192.168.1.241` |

### Finding Your Network Interface

```bash
# List network interfaces
ip link show

# Common Unraid interfaces:
# br0      - Default bridge (most common)
# eth0     - First ethernet port
# bond0    - Bonded interfaces
# br0.2    - VLAN 2 on bridge
```

### Choosing an IP Range

Pick a range of IPs that:
1. Are in your subnet
2. Are outside your DHCP range
3. Are not used by other devices

Example: If your network is `192.168.1.0/24` and DHCP assigns `.100-.200`:
- Use `192.168.1.240/28` (gives .240-.255)

## Database Setup

### PostgreSQL Configuration

1. Install PostgreSQL from Community Apps
2. Create a database:
   ```sql
   CREATE DATABASE dreamtime;
   ```
3. Note your connection details:
   ```
   Host: postgresql (container name) or IP
   Port: 5432
   User: postgres (or your user)
   Password: your_password
   Database: dreamtime
   ```
4. Set `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL=postgresql://postgres:your_password@postgresql:5432/dreamtime
   ```

### PostgreSQL Network

The server connects to PostgreSQL via the `psql` network:

```bash
# Create network if not exists
docker network create psql

# Connect your PostgreSQL container to it
docker network connect psql postgresql
```

## Reverse Proxy Setup

### SWAG Configuration

Create `/mnt/user/appdata/swag/nginx/proxy-confs/dreamtime.subdomain.conf`:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name dreamtime.*;

    include /config/nginx/ssl.conf;

    client_max_body_size 0;

    location / {
        include /config/nginx/proxy.conf;
        include /config/nginx/resolver.conf;
        set $upstream_app dreamtime-client;
        set $upstream_port 80;
        set $upstream_proto http;
        proxy_pass $upstream_proto://$upstream_app:$upstream_port;
    }
}
```

Connect SWAG to the DreamTime network:

```bash
docker network connect dreamtime-network swag
```

### Nginx Proxy Manager

1. Add proxy host for your domain
2. Forward to `dreamtime-client:80`
3. Enable WebSocket support
4. Connect NPM to `dreamtime-network`

## MQTT / Home Assistant Integration

### Prerequisites

1. Mosquitto MQTT broker running in Home Assistant
2. MQTT user created for DreamTime

### Configure MQTT User in Home Assistant

1. Go to **Settings > Add-ons > Mosquitto broker > Configuration**
2. Add a login:
   ```yaml
   logins:
     - username: dreamtime
       password: your_secure_password
   ```
3. Restart Mosquitto

### DreamTime MQTT Settings

In your `.env`:

```env
MQTT_ENABLED=true
MQTT_BROKER_URL=mqtt://192.168.1.100:1883  # Your HA IP
MQTT_USERNAME=dreamtime
MQTT_PASSWORD=your_secure_password
MQTT_TOPIC_PREFIX=dreamtime
```

### Home Assistant Configuration

See the `/ha/` folder in the repository for:
- `configuration.yaml` - Sensors and input helpers
- `automations.yaml` - Voice command automations
- `scripts.yaml` - Sleep tracking scripts
- `lovelace-card.yaml` - Dashboard cards

### Verify MQTT Connection

Check server logs:

```bash
docker logs dreamtime-server 2>&1 | grep -i mqtt
```

You should see:
```
MQTT: Testing TCP connectivity to 192.168.1.100:1883...
MQTT: TCP connection to 192.168.1.100:1883 successful
MQTT: Connecting to mqtt://192.168.1.100:1883...
MQTT: Connected successfully
MQTT: Published HA discovery config for [Child Name]
```

## Troubleshooting

### MQTT Connection Timeout

**Symptom:** `MQTT: TCP connection to x.x.x.x:1883 timed out`

**Cause:** Server container can't reach Home Assistant IP

**Solution:**
1. Verify server has macvlan IP: `docker inspect dreamtime-server | grep IPAddress`
2. Check macvlan network exists: `docker network ls | grep lan`
3. Verify IP range includes server IP
4. Test from container: `docker exec dreamtime-server wget -O- http://192.168.1.100:1883`

### Database Connection Failed

**Symptom:** Server won't start, database errors in logs

**Solution:**
1. Verify PostgreSQL is running
2. Check `psql` network exists and PostgreSQL is connected
3. Test connection: `docker exec -it postgresql psql -U postgres -d dreamtime`
4. Verify `DATABASE_URL` format

### Client Can't Reach Server

**Symptom:** API errors, 502 Bad Gateway

**Solution:**
1. Verify server is healthy: `docker ps | grep dreamtime-server`
2. Check server logs: `docker logs dreamtime-server`
3. Verify both containers are on `dreamtime-network`
4. Check nginx logs in client: `docker logs dreamtime-client`

### WebAuthn/Face ID Not Working

**Symptom:** Face ID setup fails

**Solution:**
1. Ensure `CLIENT_URL` matches the URL you access
2. Must use HTTPS (not HTTP)
3. Domain must match exactly (no www vs non-www mismatch)

## Updating

```bash
cd /mnt/user/appdata/dreamtime

# Pull latest images
docker-compose -f docker-compose.unraid.yml pull

# Restart with new images
docker-compose -f docker-compose.unraid.yml up -d
```

## Backup

Important data to backup:
- `/mnt/user/appdata/dreamtime/data/` - Secrets and local data
- PostgreSQL database - Use `pg_dump` or your backup solution

```bash
# Backup secrets
cp -r /mnt/user/appdata/dreamtime/data/secrets /mnt/user/backup/dreamtime/

# Backup database
docker exec postgresql pg_dump -U postgres dreamtime > /mnt/user/backup/dreamtime/database.sql
```
