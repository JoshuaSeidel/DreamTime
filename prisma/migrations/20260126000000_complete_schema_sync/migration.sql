-- Complete schema sync migration for PostgreSQL
-- This migration ensures ALL tables and columns exist in the production database
-- All statements are idempotent (safe to run multiple times)

-- ===========================================
-- PushSubscription table
-- ===========================================
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- Indexes for PushSubscription
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PushSubscription_endpoint_key') THEN
        CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PushSubscription_userId_idx') THEN
        CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
    END IF;
END $$;

-- Foreign key for PushSubscription
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PushSubscription_userId_fkey') THEN
        ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ===========================================
-- SleepSchedule columns
-- ===========================================

-- mustWakeBy column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='mustWakeBy') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "mustWakeBy" TEXT NOT NULL DEFAULT '07:30';
    END IF;
END $$;

-- napCapMinutes column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='napCapMinutes') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "napCapMinutes" INTEGER NOT NULL DEFAULT 120;
    END IF;
END $$;

-- minimumCribMinutes column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='minimumCribMinutes') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "minimumCribMinutes" INTEGER NOT NULL DEFAULT 60;
    END IF;
END $$;

-- napReminderMinutes column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='napReminderMinutes') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "napReminderMinutes" INTEGER NOT NULL DEFAULT 30;
    END IF;
END $$;

-- bedtimeReminderMinutes column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='bedtimeReminderMinutes') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "bedtimeReminderMinutes" INTEGER NOT NULL DEFAULT 30;
    END IF;
END $$;

-- wakeDeadlineReminderMinutes column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='wakeDeadlineReminderMinutes') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "wakeDeadlineReminderMinutes" INTEGER NOT NULL DEFAULT 15;
    END IF;
END $$;

-- ===========================================
-- SleepSession columns
-- ===========================================

-- createdByUserId column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSession' AND column_name='createdByUserId') THEN
        ALTER TABLE "SleepSession" ADD COLUMN "createdByUserId" TEXT;
    END IF;
END $$;

-- lastUpdatedByUserId column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSession' AND column_name='lastUpdatedByUserId') THEN
        ALTER TABLE "SleepSession" ADD COLUMN "lastUpdatedByUserId" TEXT;
    END IF;
END $$;

-- isAdHoc column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSession' AND column_name='isAdHoc') THEN
        ALTER TABLE "SleepSession" ADD COLUMN "isAdHoc" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- location column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSession' AND column_name='location') THEN
        ALTER TABLE "SleepSession" ADD COLUMN "location" TEXT NOT NULL DEFAULT 'CRIB';
    END IF;
END $$;

-- Index on createdByUserId
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'SleepSession_createdByUserId_idx') THEN
        CREATE INDEX "SleepSession_createdByUserId_idx" ON "SleepSession"("createdByUserId");
    END IF;
END $$;

-- Foreign keys for user tracking
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SleepSession_createdByUserId_fkey') THEN
        ALTER TABLE "SleepSession" ADD CONSTRAINT "SleepSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SleepSession_lastUpdatedByUserId_fkey') THEN
        ALTER TABLE "SleepSession" ADD CONSTRAINT "SleepSession_lastUpdatedByUserId_fkey" FOREIGN KEY ("lastUpdatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- ===========================================
-- SleepCycle table
-- ===========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='SleepCycle') THEN
        CREATE TABLE "SleepCycle" (
            "id" TEXT NOT NULL,
            "sessionId" TEXT NOT NULL,
            "cycleNumber" INTEGER NOT NULL,
            "asleepAt" TIMESTAMP(3) NOT NULL,
            "wokeUpAt" TIMESTAMP(3),
            "sleepMinutes" INTEGER,
            "awakeMinutes" INTEGER,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "SleepCycle_pkey" PRIMARY KEY ("id")
        );

        CREATE INDEX "SleepCycle_sessionId_idx" ON "SleepCycle"("sessionId");
        CREATE INDEX "SleepCycle_sessionId_cycleNumber_idx" ON "SleepCycle"("sessionId", "cycleNumber");

        ALTER TABLE "SleepCycle" ADD CONSTRAINT "SleepCycle_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SleepSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ===========================================
-- ScheduleTransition columns
-- ===========================================

-- targetWeeks column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ScheduleTransition' AND column_name='targetWeeks') THEN
        ALTER TABLE "ScheduleTransition" ADD COLUMN "targetWeeks" INTEGER NOT NULL DEFAULT 6;
    END IF;
END $$;

-- ===========================================
-- User columns
-- ===========================================

-- onboardingCompleted column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='onboardingCompleted') THEN
        ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- ===========================================
-- ChildCaregiver columns
-- ===========================================

-- title column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='title') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "title" TEXT;
    END IF;
END $$;

-- isActive column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='isActive') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- invitedByUserId column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='invitedByUserId') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "invitedByUserId" TEXT;
    END IF;
END $$;

-- inviteEmail column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='inviteEmail') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "inviteEmail" TEXT;
    END IF;
END $$;

-- invitedAt column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='invitedAt') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "invitedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- acceptedAt column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='acceptedAt') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "acceptedAt" TIMESTAMP(3);
    END IF;
END $$;

-- accessChangedAt column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='accessChangedAt') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "accessChangedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Index for ChildCaregiver isActive
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ChildCaregiver_childId_isActive_idx') THEN
        CREATE INDEX "ChildCaregiver_childId_isActive_idx" ON "ChildCaregiver"("childId", "isActive");
    END IF;
END $$;
