# Configuration

Complete reference for all DreamTime configuration options.

## Environment Variables

Create a `.env` file in the project root with these variables.

### Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_TYPE` | No | `sqlite` | Database type: `sqlite` or `postgresql` |
| `DATABASE_URL` | If PostgreSQL | - | PostgreSQL connection string |

**SQLite Example:**
```env
DB_TYPE=sqlite
# Data stored in ./data/database/dreamtime.db
```

**PostgreSQL Example:**
```env
DB_TYPE=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/dreamtime
```

---

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `CLIENT_URL` | Yes (prod) | `http://localhost` | Frontend URL (for CORS and WebAuthn) |
| `DATA_DIR` | No | `./data` | Data storage directory |

**Example:**
```env
PORT=3000
NODE_ENV=production
CLIENT_URL=https://dreamtime.example.com
DATA_DIR=/app/data
```

---

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | No | Auto-generated | 64-char secret for access tokens |
| `JWT_REFRESH_SECRET` | No | Auto-generated | 64-char secret for refresh tokens |
| `JWT_EXPIRES_IN` | No | `15m` | Access token expiry (e.g., `15m`, `1h`) |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token expiry (e.g., `7d`, `30d`) |

**Notes:**
- If not provided, secrets are auto-generated and stored in `./data/secrets/`
- In production, set explicit secrets for consistency across restarts

**Example:**
```env
JWT_SECRET=your-64-character-secret-key-here-abcdefghijklmnopqrstuvwxyz123456
JWT_REFRESH_SECRET=another-64-character-secret-for-refresh-tokens-abcdefghijk123456
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

---

### WebAuthn (Passkeys)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEBAUTHN_RP_ID` | No | Derived from `CLIENT_URL` | Relying Party ID (domain) |
| `WEBAUTHN_ORIGIN` | No | Derived from `CLIENT_URL` | Expected origin URL |

**Example:**
```env
# Usually not needed - derived from CLIENT_URL
WEBAUTHN_RP_ID=dreamtime.example.com
WEBAUTHN_ORIGIN=https://dreamtime.example.com
```

---

### Push Notifications

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VAPID_PUBLIC_KEY` | No | Auto-generated | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | No | Auto-generated | VAPID private key |
| `VAPID_SUBJECT` | No | `mailto:admin@dreamtime.app` | Contact email for push service |

**Notes:**
- VAPID keys are auto-generated on first startup
- Keys are stored in `./data/secrets/vapid.json`
- Keep the same keys to maintain push subscriptions

**Example:**
```env
VAPID_SUBJECT=mailto:admin@yourdomain.com
# Keys auto-generated - only set if migrating
```

---

### MQTT / Home Assistant (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MQTT_ENABLED` | No | `false` | Enable MQTT integration |
| `MQTT_BROKER_URL` | If enabled | - | MQTT broker URL |
| `MQTT_USERNAME` | No | - | MQTT username |
| `MQTT_PASSWORD` | No | - | MQTT password |
| `MQTT_TOPIC_PREFIX` | No | `dreamtime` | Topic prefix for all messages |

**Example:**
```env
MQTT_ENABLED=true
MQTT_BROKER_URL=mqtt://homeassistant.local:1883
MQTT_USERNAME=dreamtime
MQTT_PASSWORD=your-mqtt-password
MQTT_TOPIC_PREFIX=dreamtime
```

---

## Complete Example

```env
# ===================
# Database
# ===================
DB_TYPE=sqlite

# ===================
# Server
# ===================
PORT=3000
NODE_ENV=production
CLIENT_URL=https://dreamtime.example.com
DATA_DIR=/app/data

# ===================
# Authentication
# ===================
JWT_SECRET=your-64-character-secret-key-here-abcdefghijklmnopqrstuvwxyz123456
JWT_REFRESH_SECRET=another-64-character-secret-for-refresh-tokens-abcdefghijk123456
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ===================
# Push Notifications
# ===================
VAPID_SUBJECT=mailto:admin@example.com

# ===================
# MQTT (Optional)
# ===================
MQTT_ENABLED=false
```

---

## Docker Compose Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  server:
    build:
      context: .
      dockerfile: packages/server/Dockerfile
      target: production
    environment:
      - DB_TYPE=${DB_TYPE:-sqlite}
      - DATABASE_URL=${DATABASE_URL:-}
      - PORT=3000
      - NODE_ENV=production
      - CLIENT_URL=${CLIENT_URL:-http://localhost}
      - JWT_SECRET=${JWT_SECRET:-}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-}
      - VAPID_SUBJECT=${VAPID_SUBJECT:-mailto:admin@dreamtime.app}
      - MQTT_ENABLED=${MQTT_ENABLED:-false}
      - MQTT_BROKER_URL=${MQTT_BROKER_URL:-}
      - MQTT_USERNAME=${MQTT_USERNAME:-}
      - MQTT_PASSWORD=${MQTT_PASSWORD:-}
    volumes:
      - ./data:/app/data
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 120s

  client:
    build:
      context: .
      dockerfile: packages/client/Dockerfile
      target: production
    ports:
      - "80:80"
    depends_on:
      - server
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## Schedule Configuration

These are configured per-child in the app, not via environment variables.

### Default 2-Nap Schedule

```javascript
{
  type: 'TWO_NAP',
  wakeWindow1Min: 120,      // 2h - Wake to Nap 1
  wakeWindow1Max: 150,      // 2.5h
  wakeWindow2Min: 150,      // 2.5h - Nap 1 to Nap 2
  wakeWindow2Max: 210,      // 3.5h
  wakeWindow3Min: 210,      // 3.5h - Nap 2 to Bedtime
  wakeWindow3Max: 270,      // 4.5h
  nap1Earliest: '08:30',
  nap1LatestStart: '09:00',
  nap1MaxDuration: 120,     // 2h
  nap1EndBy: '11:00',
  nap2Earliest: '12:00',
  nap2LatestStart: '13:00',
  nap2MaxDuration: 120,     // 2h
  nap2EndBy: '15:00',
  bedtimeEarliest: '17:30',
  bedtimeLatest: '19:30',
  bedtimeGoalStart: '19:00',
  bedtimeGoalEnd: '19:30',
  wakeTimeEarliest: '06:30',
  wakeTimeLatest: '07:30',
  mustWakeBy: '07:30',
  daySleepCap: 210,         // 3.5h total
  minimumCribMinutes: 60,   // Crib time rule
  napReminderMinutes: 30,
  bedtimeReminderMinutes: 30,
  wakeDeadlineReminderMinutes: 15
}
```

### Default 1-Nap Schedule

```javascript
{
  type: 'ONE_NAP',
  wakeWindow1Min: 300,      // 5h - Wake to Nap
  wakeWindow1Max: 330,      // 5.5h
  wakeWindow2Min: 240,      // 4h - Nap to Bedtime
  wakeWindow2Max: 300,      // 5h
  nap1Earliest: '12:00',
  nap1LatestStart: '13:00',
  nap1MaxDuration: 180,     // 3h
  nap1EndBy: '15:30',
  bedtimeEarliest: '18:00',
  bedtimeLatest: '19:30',
  bedtimeGoalStart: '18:45',
  bedtimeGoalEnd: '19:30',
  wakeTimeEarliest: '06:30',
  wakeTimeLatest: '08:00',
  mustWakeBy: '08:00',
  daySleepCap: 150,         // 2.5h
  minimumCribMinutes: 60
}
```

---

## Data Directory Structure

```
data/
├── database/
│   └── dreamtime.db       # SQLite database (if using SQLite)
├── secrets/
│   ├── jwt.json           # Auto-generated JWT secrets
│   └── vapid.json         # Auto-generated VAPID keys
└── logs/                  # Application logs (if enabled)
```

---

## Security Recommendations

### Production Checklist

- [ ] Set explicit `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Use HTTPS with valid SSL certificate
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CLIENT_URL` to your actual domain
- [ ] Backup the `data/` directory regularly
- [ ] Use strong passwords for PostgreSQL
- [ ] Restrict database access to localhost or private network
