# Baby Sleep Tracker - DreamTime

A Progressive Web App (PWA) for tracking baby sleep schedules, naps, and sleep training progress. Designed to help parents follow sleep consultant guidance and transition between sleep schedules.

## Project Overview

DreamTime helps parents:
- Track nap times, bedtimes, wake times with one-tap recording
- Follow sleep training schedules (Cry It Out, Ferber, etc.)
- Calculate optimal nap and bedtime based on wake time
- Handle the 2-to-1 nap transition with guided progression
- Share child profiles between multiple caregivers
- Get notifications/reminders for upcoming sleep times

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js or Fastify
- **Database**: PostgreSQL (primary) with SQLite support for development
- **ORM**: Prisma
- **Authentication**: JWT with refresh tokens
- **API**: RESTful with OpenAPI/Swagger documentation

### Frontend
- **Framework**: React 18+ with TypeScript
- **State Management**: Zustand or React Query
- **UI Components**: Tailwind CSS + shadcn/ui
- **PWA**: Vite PWA plugin with service workers
- **Time Handling**: date-fns or dayjs (timezone aware)

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Development**: Hot reload, seed data, test utilities

## Core Features

### 1. User Management
- Email/password registration and login
- Password reset via email
- User profiles with timezone settings
- Session management (multiple devices)

### 2. Child Management
- Add/edit child profiles (name, birthdate, photo)
- Share children between caregivers (invite via email/link)
- Role-based permissions (admin, caregiver, view-only)
- Multiple children support

### 3. Sleep Schedule Configuration
- Import schedule from sleep consultant plans
- Configure nap schedule (1-nap, 2-nap, 3-nap)
- Set wake windows, sleep caps, earliest/latest times
- Bedtime range configuration
- Track schedule transitions (2-to-1 nap transition)

### 4. Sleep Tracking
- One-tap buttons: "Put Down", "Fell Asleep", "Woke Up", "Out of Crib"
- Track crying duration (for CIO method)
- Notes field for each sleep session
- Edit historical entries
- Auto-calculate sleep duration

### 5. Schedule Calculator
- Based on wake time, calculate:
  - Optimal nap 1 start time
  - Optimal nap 2 start time (if applicable)
  - Recommended bedtime
- Account for sleep debt (poor naps = earlier bedtime)
- Support crib hour/crib 90 rules
- Handle transition schedules

### 6. Analytics & Insights
- Daily/weekly sleep totals
- Average sleep duration trends
- Nap length progression
- Night waking frequency
- Schedule adherence tracking

### 7. PWA Features
- Offline support (queue actions when offline)
- Push notifications for sleep reminders
- Install to home screen
- Background sync

## Database Schema

See `prisma/schema.prisma` for complete schema.

### Key Models:
- **User**: Account information, timezone
- **Child**: Baby profiles
- **ChildCaregiver**: Many-to-many relationship with roles
- **SleepSchedule**: Schedule configuration
- **SleepSession**: Individual sleep tracking entries
- **ScheduleTransition**: Track 2-to-1 nap transitions

## API Endpoints

See `docs/api-spec.yaml` for OpenAPI specification.

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Users
- `GET /api/users/me`
- `PATCH /api/users/me`
- `DELETE /api/users/me`

### Children
- `GET /api/children`
- `POST /api/children`
- `GET /api/children/:id`
- `PATCH /api/children/:id`
- `DELETE /api/children/:id`
- `POST /api/children/:id/share`
- `DELETE /api/children/:id/caregivers/:userId`

### Sleep Schedules
- `GET /api/children/:id/schedule`
- `PUT /api/children/:id/schedule`
- `POST /api/children/:id/schedule/transition` (start 2-to-1 transition)
- `PATCH /api/children/:id/schedule/transition` (progress transition)

### Sleep Sessions
- `GET /api/children/:id/sessions`
- `POST /api/children/:id/sessions`
- `GET /api/children/:id/sessions/:sessionId`
- `PATCH /api/children/:id/sessions/:sessionId`
- `DELETE /api/children/:id/sessions/:sessionId`

### Calculator
- `GET /api/children/:id/calculate?wakeTime=HH:mm`
- `GET /api/children/:id/bedtime?nap1End=HH:mm&nap2End=HH:mm`

### Analytics
- `GET /api/children/:id/analytics/daily?date=YYYY-MM-DD`
- `GET /api/children/:id/analytics/weekly?week=YYYY-Www`
- `GET /api/children/:id/analytics/trends?range=30d`

## Getting Started

```bash
# Clone and install
git clone <repo>
cd baby-sleep-tracker
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database URL and secrets

# Setup database
npx prisma migrate dev
npx prisma db seed

# Run development server
npm run dev

# Run with Docker
docker-compose up -d
```

## Project Structure

```
baby-sleep-tracker/
├── README.md
├── CLAUDE.md                    # Claude Code instructions
├── package.json
├── docker-compose.yml
├── .env.example
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── server/
│   │   ├── index.ts
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── types/
│   └── client/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── services/
│       ├── store/
│       └── utils/
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── docs/
│   ├── api-spec.yaml
│   ├── sleep-schedules.md
│   └── transitions.md
└── tests/
    ├── unit/
    └── integration/
```

## Sleep Schedule Reference

### 2-Nap Schedule (12-14 months)
- Wake: 6:30-7:30 AM
- Nap 1: 8:30-9:00 AM (cap at 2 hours, end by 11:00 AM)
- Nap 2: 12:00-1:00 PM (cap at 2 hours, end by 3:00 PM)
- Bedtime: 5:30-7:30 PM
- Total day sleep cap: 3.5 hours

### 2-to-1 Nap Transition (4-6 weeks)
- Week 1-2: Start single nap as early as 11:30 AM (5.5 hours after wake)
- Every 3-7 days: Push nap 15 minutes later
- Week 2+: No nap before 12:00 PM
- Goal: Nap at 12:30-1:00 PM
- Crib 90 rule: Stay in crib minimum 90 minutes
- Bedtime: 4-5 hours after nap ends (goal: 6:45-7:30 PM)
- Temporary: Allow sleep until 8:00 AM during transition

### 1-Nap Schedule (14+ months)
- Wake: 6:30-7:30 AM (up to 8:00 AM during transition)
- Nap: 12:30-1:00 PM (cap at 2.5-3 hours, end by 3:00-3:30 PM)
- Bedtime: 6:45-7:30 PM (4-4.5 hours after nap)

## License

MIT
