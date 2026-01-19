-- Add mustWakeBy and napCapMinutes to SleepSchedule
-- Add PushSubscription table

-- AlterTable: Add mustWakeBy column to SleepSchedule
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='mustWakeBy') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "mustWakeBy" TEXT NOT NULL DEFAULT '07:30';
    END IF;
END $$;

-- AlterTable: Add napCapMinutes column to SleepSchedule
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='napCapMinutes') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "napCapMinutes" INTEGER NOT NULL DEFAULT 120;
    END IF;
END $$;

-- CreateTable: PushSubscription
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PushSubscription_endpoint_idx') THEN
        CREATE INDEX "PushSubscription_endpoint_idx" ON "PushSubscription"("endpoint");
    END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PushSubscription_userId_fkey') THEN
        ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
