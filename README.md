<img src="images/logo.svg" alt="DreamTime Logo" width="48" height="48" align="left" style="margin-right: 12px;">

# DreamTime

A Progressive Web App for tracking baby sleep schedules, designed to help parents follow sleep consultant guidance and manage nap transitions.

---

## Screenshots

<p align="center">
  <img src="images/Home.jpg" alt="Home Screen" width="200">
  <img src="images/History.jpg" alt="History" width="200">
  <img src="images/Analytics.jpg" alt="Analytics" width="200">
  <img src="images/Schedule.jpg" alt="Schedule" width="200">
</p>

## Features

### Sleep Tracking
- One-tap recording: Put Down, Fell Asleep, Woke Up, Out of Crib
- Real-time status display showing current sleep state
- Ad-hoc nap logging for car seats, strollers, and carriers
- Timestamp editing for corrections
- Session notes and history

### Schedule Management
- Configurable sleep schedules: 1-nap, 2-nap, 3-nap
- Wake window calculations with min/max ranges
- Day sleep caps and bedtime goals
- Guided 2-to-1 nap transition over 4-6 weeks
- Crib 90 rule enforcement during transitions

### Analytics
- Daily, weekly, and monthly sleep totals
- Average nap length trends
- Sleep pattern visualization
- Comparative metrics with percentage changes

### Multi-Caregiver Support
- Share child profiles between caregivers
- Role-based permissions: Admin, Caregiver, Viewer
- Email invitations with secure acceptance flow
- Activity tracking by caregiver

### PWA Capabilities
- Install to home screen on iOS and Android
- Offline support with background sync
- Push notifications for sleep reminders
- Face ID and Touch ID authentication via WebAuthn

### Home Assistant Integration
- MQTT connectivity for voice control
- Alexa commands via Home Assistant automations
- Auto-discovery of entities per child
- Real-time state synchronization

## Tech Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Fastify with Zod validation
- **Database**: PostgreSQL (production) or SQLite (development)
- **ORM**: Prisma
- **Authentication**: JWT with refresh tokens, WebAuthn for biometrics

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with PWA plugin
- **UI Components**: Tailwind CSS with shadcn/ui
- **State Management**: Zustand
- **Charts**: Recharts

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **CI/CD**: GitHub Actions with GHCR publishing
- **Reverse Proxy**: Nginx

## Installation

### Development

```bash
# Clone repository
git clone https://github.com/JoshuaSeidel/DreamTime.git
cd DreamTime

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173` (client) and `http://localhost:3000` (API).

### Docker (Standard)

```bash
# Using SQLite (default)
docker-compose up -d

# Using PostgreSQL
DB_TYPE=postgresql \
DATABASE_URL=postgresql://user:pass@host:5432/dreamtime \
docker-compose up -d
```

### Unraid Deployment

DreamTime includes optimized configuration for Unraid with macvlan networking for MQTT support.

```bash
mkdir -p /mnt/user/appdata/dreamtime
cd /mnt/user/appdata/dreamtime

# Download configuration
wget https://raw.githubusercontent.com/JoshuaSeidel/DreamTime/main/docker-compose.unraid.yml
wget https://raw.githubusercontent.com/JoshuaSeidel/DreamTime/main/.env.unraid.example -O .env

# Edit .env with your settings
nano .env

# Deploy
docker-compose -f docker-compose.unraid.yml up -d
```

See [docs/unraid-setup.md](docs/unraid-setup.md) for detailed instructions including:
- macvlan network configuration for LAN access
- PostgreSQL setup
- Reverse proxy configuration (SWAG/NPM)
- MQTT broker connectivity

## Home Assistant Voice Control

Control sleep tracking with Alexa through Home Assistant:

```
"Alexa, tell Home Assistant baby is in crib"
"Alexa, tell Home Assistant baby fell asleep"
"Alexa, tell Home Assistant baby woke up"
"Alexa, tell Home Assistant baby is out of crib"
```

Configuration files are provided in the [ha/](ha/) folder:
- `configuration.yaml` - Sensors and input helpers
- `automations.yaml` - Voice command automations
- `scripts.yaml` - Reusable scripts for dashboards
- `lovelace-card.yaml` - Dashboard card examples

Requirements:
- Mosquitto MQTT broker in Home Assistant
- Home Assistant Cloud (Nabu Casa) or manual Alexa skill
- MQTT enabled in DreamTime configuration

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_TYPE` | Database type: `sqlite` or `postgresql` | `sqlite` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `CLIENT_URL` | Public URL for WebAuthn | `http://localhost` |
| `JWT_EXPIRES_IN` | Access token expiration | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | `7d` |
| `MQTT_ENABLED` | Enable MQTT integration | `false` |
| `MQTT_BROKER_URL` | MQTT broker address | `mqtt://localhost:1883` |
| `MQTT_USERNAME` | MQTT authentication user | - |
| `MQTT_PASSWORD` | MQTT authentication password | - |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Invalidate tokens
- `POST /api/auth/webauthn/*` - Face ID/Touch ID flows

### Children
- `GET /api/children` - List children
- `POST /api/children` - Add child
- `GET /api/children/:id` - Get child details
- `PATCH /api/children/:id` - Update child
- `POST /api/children/:id/share` - Invite caregiver

### Sleep Sessions
- `GET /api/children/:id/sessions` - List sessions
- `POST /api/children/:id/sessions` - Start session
- `PATCH /api/children/:id/sessions/:sessionId` - Update session
- `DELETE /api/children/:id/sessions/:sessionId` - Delete session

### Schedules
- `GET /api/children/:id/schedule` - Get active schedule
- `PUT /api/children/:id/schedule` - Create/update schedule
- `POST /api/children/:id/transition` - Start nap transition
- `PATCH /api/children/:id/transition` - Update transition progress

### Analytics
- `GET /api/children/:id/analytics` - Sleep statistics

## Sleep Schedule Reference

### 2-Nap Schedule (6-15 months)
| Timing | Range |
|--------|-------|
| Wake | 6:30-7:30 AM |
| Nap 1 | 8:30-9:00 AM start, end by 11:00 AM |
| Nap 2 | 12:00-1:00 PM start, end by 3:00 PM |
| Bedtime | 6:30-7:30 PM |
| Day sleep cap | 3.5 hours |

### 2-to-1 Transition (4-6 weeks)
| Phase | Guidelines |
|-------|------------|
| Week 1-2 | Single nap no earlier than 11:30 AM |
| Week 2+ | Push nap 15 minutes later every 3-7 days |
| Goal | Nap at 12:30-1:00 PM |
| Crib rule | Minimum 90 minutes in crib |
| Bedtime | 4-5 hours after nap ends |

### 1-Nap Schedule (15+ months)
| Timing | Range |
|--------|-------|
| Wake | 6:30-8:00 AM |
| Nap | 12:30-1:00 PM start, end by 3:00-3:30 PM |
| Bedtime | 6:45-7:30 PM |
| Day sleep cap | 2.5 hours |

## Project Structure

```
DreamTime/
├── packages/
│   ├── server/           # Fastify API server
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── services/ # Business logic
│   │   │   ├── schemas/  # Zod validation
│   │   │   └── config/   # Database, env
│   │   └── Dockerfile
│   └── client/           # React PWA
│       ├── src/
│       │   ├── pages/    # Route components
│       │   ├── components/
│       │   ├── lib/      # API client, utilities
│       │   └── store/    # Zustand stores
│       └── Dockerfile
├── prisma/
│   └── schema.prisma     # Database schema
├── ha/                   # Home Assistant configs
├── docs/                 # Documentation
├── docker-compose.yml    # Standard deployment
└── docker-compose.unraid.yml  # Unraid deployment
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT
