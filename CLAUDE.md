# CLAUDE.md - Instructions for Claude Code

This file contains instructions for Claude Code to build the DreamTime baby sleep tracker application.

## Project Context

This is a Progressive Web App (PWA) for tracking baby sleep. Parents use it to:
1. Record sleep events (put down, fell asleep, woke up, out of crib)
2. Follow sleep training schedules from their sleep consultant
3. Calculate optimal nap/bedtime based on wake time
4. Share child profiles between caregivers
5. Track the 2-to-1 nap transition over 4-6 weeks

## Build Order

### Phase 1: Foundation
1. Initialize monorepo with npm workspaces or turborepo
2. Setup TypeScript configuration
3. Setup Prisma with PostgreSQL schema
4. Create Express/Fastify server skeleton
5. Setup Vite + React client skeleton
6. Configure Docker and docker-compose

### Phase 2: Backend Core
1. Implement authentication (register, login, JWT, refresh tokens)
2. Implement user CRUD
3. Implement child CRUD with caregiver sharing
4. Implement sleep schedule configuration
5. Implement sleep session tracking
6. Add input validation (Zod)
7. Add error handling middleware

### Phase 3: Business Logic
1. Implement schedule calculator service
2. Implement bedtime calculator
3. Implement 2-to-1 transition tracker
4. Implement analytics aggregation
5. Add timezone handling

### Phase 4: Frontend Core
1. Setup React Router
2. Implement auth pages (login, register, forgot password)
3. Implement dashboard with child selection
4. Implement quick-action buttons for sleep tracking
5. Implement schedule configuration UI
6. Implement session history view

### Phase 5: PWA Features
1. Configure Vite PWA plugin
2. Create service worker for offline support
3. Implement background sync for offline actions
4. Add push notification support
5. Create app manifest and icons

### Phase 6: Polish
1. Add loading states and error boundaries
2. Implement optimistic updates
3. Add animations and transitions
4. Mobile-first responsive design
5. Accessibility audit

## Key Implementation Details

### Timezone Handling
- Store all times in UTC in the database
- User's timezone is stored in their profile
- All calculations happen in the user's local timezone
- Use `date-fns-tz` for timezone conversions
- Display times in user's local timezone

### Sleep Session State Machine
```
States: PENDING -> ASLEEP -> AWAKE -> COMPLETED

Events:
- put_down: Creates session in PENDING state, records putDownAt
- fell_asleep: Transitions to ASLEEP, records asleepAt
- woke_up: Transitions to AWAKE, records wokeUpAt
- out_of_crib: Transitions to COMPLETED, records outOfCribAt
```

### Schedule Calculator Logic
```typescript
function calculateNapTimes(wakeTime: Date, schedule: Schedule): NapRecommendation {
  // For 2-nap schedule:
  // Nap 1: 2-2.5 hours after wake
  // Nap 2: 2.5-3.5 hours after nap 1 ends
  // Bedtime: 3.5-4.5 hours after nap 2 ends
  
  // For 2-to-1 transition:
  // Single nap: 5-5.5 hours after wake (min 11:30am week 1-2, then 12pm)
  // Bedtime: 4-5 hours after nap ends
  
  // Account for:
  // - Sleep debt (poor naps = earlier bedtime)
  // - Maximum awake windows
  // - Earliest/latest times from schedule config
}
```

### Caregiver Sharing
- Owner creates child, becomes ADMIN
- Owner can invite caregivers via email
- Invitation creates pending record
- Accepting invitation grants CAREGIVER role
- View-only option available
- Roles: ADMIN (full control), CAREGIVER (can track), VIEWER (read-only)

### Offline Support
- IndexedDB for local session storage
- Queue offline actions with timestamps
- Sync when online, resolve conflicts by timestamp
- Show offline indicator in UI
- Optimistic updates for tracking actions

## File Naming Conventions

- Components: PascalCase (e.g., `SleepTracker.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useSleepSessions.ts`)
- Services: camelCase with `.service.ts` suffix
- Routes: camelCase with `.routes.ts` suffix
- Utils: camelCase (e.g., `calculateBedtime.ts`)
- Types: PascalCase in `types/` directory

## Testing Requirements

- Unit tests for calculator logic
- Integration tests for API endpoints
- E2E tests for critical flows (auth, tracking)
- Test timezone handling with multiple zones
- Test offline/online sync

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dreamtime
DATABASE_URL_SQLITE=file:./dev.db

# Auth
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development

# Push Notifications (optional)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

## API Response Format

```typescript
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": { ... }
  }
}

// Paginated
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## UI/UX Requirements

### Quick Action Buttons
- Large, touch-friendly buttons (min 48px tap target)
- Color-coded: Put Down (blue), Asleep (purple), Awake (yellow), Out (green)
- Show current state prominently
- Confirm timestamp with user's current time
- Allow timestamp adjustment if needed

### Dashboard
- Current child selector at top
- Current sleep state indicator
- Next recommended action with time
- Today's summary (total sleep, naps completed)
- Quick access to tracking buttons

### Mobile-First
- Bottom navigation for main sections
- Swipe gestures for common actions
- Pull-to-refresh for session list
- Large touch targets throughout

## Sleep Schedule Rules

### 2-Nap Schedule (Oliver's current schedule from PDF)
```yaml
wake_window_1: 2-2.5h  # Wake to Nap 1
wake_window_2: 2.5-3.5h  # Nap 1 end to Nap 2
wake_window_3: 3.5-4.5h  # Nap 2 end to Bedtime

nap_1:
  earliest: "08:30"
  latest_start: "09:00"
  max_duration: 120  # minutes
  end_by: "11:00"
  
nap_2:
  earliest: "12:00"
  latest_start: "13:00"
  max_duration: 120  # minutes
  end_by: "15:00"
  exception_max_duration: 150  # if nap 1 was skipped

bedtime:
  earliest: "17:30"
  latest: "19:30"
  goal: "19:00-19:30"

day_sleep_cap: 210  # 3.5 hours in minutes
wake_time:
  earliest: "06:30"
  latest: "07:30"
```

### 2-to-1 Transition Schedule
```yaml
transition_duration: "4-6 weeks"

week_1_2:
  single_nap:
    earliest: "11:30"
    wake_window: 5.5h  # hours from wake
  crib_rule: 90  # minutes minimum in crib

progression:
  interval_days: 3-7
  push_amount: 15  # minutes later

week_2_plus:
  single_nap:
    earliest: "12:00"
    
goal:
  single_nap:
    target_start: "12:30-13:00"
    max_duration: 150-180  # 2.5-3 hours
    end_by: "15:00-15:30"
  bedtime:
    wake_window: 4-5h  # after nap ends
    goal: "18:45-19:30"
    
temporary_allowances:
  wake_time_allowed_until: "08:00"  # first few months
  
after_transition:
  nap_cap: 150  # 2.5 hours after 4-6 weeks
```

## Common Pitfalls to Avoid

1. **Timezone bugs**: Always convert to user's timezone for display and calculations
2. **Race conditions**: Handle concurrent tracking (e.g., both parents tap "asleep")
3. **Offline conflicts**: Older offline action should not overwrite newer server state
4. **Session state**: Validate state transitions (can't go from PENDING to COMPLETED)
5. **Date boundaries**: Handle sessions that span midnight correctly
6. **DST**: Handle daylight saving time transitions

## Commands Reference

```bash
# Development
npm run dev              # Start both server and client
npm run dev:server       # Start server only
npm run dev:client       # Start client only

# Database
npm run db:migrate       # Run Prisma migrations
npm run db:seed          # Seed development data
npm run db:reset         # Reset and reseed database
npm run db:studio        # Open Prisma Studio

# Testing
npm run test             # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # E2E tests

# Build
npm run build            # Build for production
npm run preview          # Preview production build

# Docker
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
docker-compose logs -f   # Follow logs
```
