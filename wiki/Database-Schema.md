# Database Schema

Technical reference for DreamTime's data model.

## Overview

DreamTime uses Prisma ORM with support for:
- **SQLite** (default, no external database required)
- **PostgreSQL** (for larger deployments)

---

## Entity Relationship Diagram

```
┌───────────┐       ┌───────────────┐       ┌──────────────┐
│   User    │───────│ ChildCaregiver│───────│    Child     │
└───────────┘       └───────────────┘       └──────────────┘
      │                                            │
      │                                            │
      ▼                                            ▼
┌───────────┐                              ┌──────────────┐
│ Passkey   │                              │   Schedule   │
└───────────┘                              └──────────────┘
      │                                            │
      ▼                                            ▼
┌───────────┐                              ┌──────────────┐
│ RefreshTkn│                              │   Session    │
└───────────┘                              └──────────────┘
                                                   │
                                                   ▼
┌───────────┐                              ┌──────────────┐
│PushSubscr │                              │  NightWake   │
└───────────┘                              └──────────────┘
```

---

## Models

### User

Stores user accounts.

```prisma
model User {
  id                  String             @id @default(uuid())
  email               String             @unique
  password            String
  name                String
  timezone            String             @default("America/New_York")
  onboardingCompleted Boolean            @default(false)
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  // Relations
  caregiverOf         ChildCaregiver[]
  passkeys            Passkey[]
  refreshTokens       RefreshToken[]
  pushSubscriptions   PushSubscription[]
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | String | Unique email address |
| password | String | Hashed password |
| name | String | Display name |
| timezone | String | IANA timezone (e.g., "America/New_York") |
| onboardingCompleted | Boolean | Has completed onboarding wizard |
| createdAt | DateTime | Account creation timestamp |
| updatedAt | DateTime | Last update timestamp |

---

### Child

Stores child profiles.

```prisma
model Child {
  id        String   @id @default(uuid())
  name      String
  birthDate DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  caregivers ChildCaregiver[]
  schedule   Schedule?
  sessions   SleepSession[]
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Child's name |
| birthDate | DateTime | Date of birth |
| createdAt | DateTime | Profile creation timestamp |
| updatedAt | DateTime | Last update timestamp |

---

### ChildCaregiver

Junction table for many-to-many user-child relationship.

```prisma
model ChildCaregiver {
  id        String   @id @default(uuid())
  role      Role     @default(CAREGIVER)
  status    Status   @default(ACTIVE)
  createdAt DateTime @default(now())

  // Relations
  userId  String
  user    User   @relation(fields: [userId], references: [id])
  childId String
  child   Child  @relation(fields: [childId], references: [id])

  @@unique([userId, childId])
}

enum Role {
  ADMIN
  CAREGIVER
  VIEWER
}

enum Status {
  PENDING
  ACTIVE
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| role | Enum | ADMIN, CAREGIVER, or VIEWER |
| status | Enum | PENDING (invited) or ACTIVE |
| userId | UUID | Foreign key to User |
| childId | UUID | Foreign key to Child |

---

### Schedule

Stores sleep schedule configuration per child.

```prisma
model Schedule {
  id      String @id @default(uuid())
  childId String @unique
  child   Child  @relation(fields: [childId], references: [id])

  // Schedule type
  type ScheduleType @default(TWO_NAP)

  // Wake windows (minutes)
  wakeWindow1Min Int @default(120)
  wakeWindow1Max Int @default(150)
  wakeWindow2Min Int @default(150)
  wakeWindow2Max Int @default(210)
  wakeWindow3Min Int @default(210)
  wakeWindow3Max Int @default(270)

  // Nap 1 constraints
  nap1Earliest    String @default("08:30")
  nap1LatestStart String @default("09:00")
  nap1MaxDuration Int    @default(120)
  nap1EndBy       String @default("11:00")

  // Nap 2 constraints (for 2-nap schedule)
  nap2Earliest    String @default("12:00")
  nap2LatestStart String @default("13:00")
  nap2MaxDuration Int    @default(120)
  nap2EndBy       String @default("15:00")

  // Bedtime constraints
  bedtimeEarliest  String @default("17:30")
  bedtimeLatest    String @default("19:30")
  bedtimeGoalStart String @default("19:00")
  bedtimeGoalEnd   String @default("19:30")

  // Wake time constraints
  wakeTimeEarliest String @default("06:30")
  wakeTimeLatest   String @default("07:30")
  mustWakeBy       String @default("07:30")

  // Caps and rules
  daySleepCap        Int @default(210)
  minimumCribMinutes Int @default(60)

  // Notification settings (minutes before)
  napReminderMinutes          Int @default(30)
  bedtimeReminderMinutes      Int @default(30)
  wakeDeadlineReminderMinutes Int @default(15)

  // Transition state
  transitionActive     Boolean   @default(false)
  transitionStartDate  DateTime?
  transitionTargetTime String?
  transitionGoalTime   String?
  transitionWeek       Int?
  targetWeeks          Int?
  pushIntervalDays     Int?
  lastPushDate         DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum ScheduleType {
  THREE_NAP
  TWO_NAP
  ONE_NAP
  TRANSITION
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | Enum | THREE_NAP, TWO_NAP, ONE_NAP, TRANSITION |
| wakeWindow*Min/Max | Int | Wake window bounds in minutes |
| nap*Earliest | String | Time string (HH:MM) |
| daySleepCap | Int | Maximum day sleep in minutes |
| minimumCribMinutes | Int | Crib time rule in minutes |
| transitionActive | Boolean | Currently in 2-to-1 transition |

---

### SleepSession

Stores individual sleep sessions.

```prisma
model SleepSession {
  id      String @id @default(uuid())
  childId String
  child   Child  @relation(fields: [childId], references: [id])

  type       SessionType
  napNumber  Int?
  status     SessionStatus @default(PENDING)
  location   Location      @default(CRIB)

  // Timestamps
  putDownAt   DateTime
  asleepAt    DateTime?
  wokeUpAt    DateTime?
  outOfCribAt DateTime?

  // Calculated fields
  sleepDuration  Int? // minutes
  cribDuration   Int? // minutes
  qualifiedRest  Int? // minutes

  // Night sleep
  isNightSleep Boolean     @default(false)
  nightWakes   NightWake[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([childId, putDownAt])
}

enum SessionType {
  NAP
  NIGHT
}

enum SessionStatus {
  PENDING   // Put down, not yet asleep
  ASLEEP    // Currently sleeping
  AWAKE     // Woke up, still in crib
  COMPLETED // Out of crib, session ended
}

enum Location {
  CRIB
  CAR_SEAT
  STROLLER
  CARRIER
  SWING
  PLAYPEN
  OTHER
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | Enum | NAP or NIGHT |
| napNumber | Int | Nap number for the day (1, 2, etc.) |
| status | Enum | Current session state |
| location | Enum | Where baby is sleeping |
| putDownAt | DateTime | When placed in crib |
| asleepAt | DateTime | When fell asleep |
| wokeUpAt | DateTime | When woke up |
| outOfCribAt | DateTime | When removed from crib |
| qualifiedRest | Int | Sleep + (awake crib time ÷ 2) |

---

### NightWake

Stores wake events during night sleep.

```prisma
model NightWake {
  id        String       @id @default(uuid())
  sessionId String
  session   SleepSession @relation(fields: [sessionId], references: [id])

  wokeUpAt  DateTime
  asleepAt  DateTime?
  duration  Int? // minutes awake

  createdAt DateTime @default(now())
}
```

| Field | Type | Description |
|-------|------|-------------|
| sessionId | UUID | Parent night sleep session |
| wokeUpAt | DateTime | When baby woke |
| asleepAt | DateTime | When went back to sleep |
| duration | Int | Minutes awake |

---

### Passkey

Stores WebAuthn credentials for passkey login.

```prisma
model Passkey {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])

  credentialId   String   @unique
  publicKey      Bytes
  counter        BigInt
  transports     String[] // ["internal", "usb", etc.]
  deviceType     String   // "singleDevice" or "multiDevice"
  backedUp       Boolean
  authenticatorName String?

  createdAt      DateTime @default(now())
  lastUsedAt     DateTime?
}
```

---

### RefreshToken

Stores refresh tokens for JWT authentication.

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])

  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([token])
}
```

---

### PushSubscription

Stores Web Push subscriptions.

```prisma
model PushSubscription {
  id       String @id @default(uuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id])

  endpoint String @unique
  p256dh   String
  auth     String

  createdAt DateTime @default(now())

  @@index([userId])
}
```

---

## Indexes

Key indexes for performance:

```prisma
// Sleep sessions by child and date
@@index([childId, putDownAt])

// Refresh tokens
@@index([userId])
@@index([token])

// Push subscriptions
@@index([userId])

// Unique constraints
@@unique([userId, childId]) // ChildCaregiver
```

---

## Migrations

### Location

```
prisma/migrations/
├── 20240101000000_initial/
├── 20240115000000_add_passkeys/
├── 20240120000000_add_push_subscriptions/
├── 20260124200000_add_onboarding_completed/
└── migration_lock.toml
```

### Running Migrations

```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy

# Reset (deletes all data!)
npx prisma migrate reset
```

### Creating Migrations

```bash
# After schema changes
npx prisma migrate dev --name add_new_field
```

---

## Database Types

### SQLite (Default)

```env
DB_TYPE=sqlite
```

- File stored at: `./data/database/dreamtime.db`
- No external database required
- Good for single-user or small deployments

### PostgreSQL

```env
DB_TYPE=postgresql
DATABASE_URL=postgresql://user:pass@localhost:5432/dreamtime
```

- Better for multi-user deployments
- Better concurrent access
- More robust for production

---

## Prisma Studio

Browse and edit data visually:

```bash
npx prisma studio
```

Opens at http://localhost:5555

---

## Backup & Restore

### SQLite Backup

```bash
# Backup
cp data/database/dreamtime.db data/database/dreamtime.db.backup

# Restore
cp data/database/dreamtime.db.backup data/database/dreamtime.db
```

### PostgreSQL Backup

```bash
# Backup
pg_dump -h localhost -U user dreamtime > backup.sql

# Restore
psql -h localhost -U user dreamtime < backup.sql
```

---

## Schema Changes

When modifying the schema:

1. **Edit** `prisma/schema.base.prisma`
2. **Copy to** `prisma/schema.prisma` (for IDE support)
3. **Create migration**: `npx prisma migrate dev --name change_name`
4. **Test** the migration
5. **Commit** all files including migration

