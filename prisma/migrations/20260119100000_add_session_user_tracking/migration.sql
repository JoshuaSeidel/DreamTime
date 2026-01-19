-- Add user tracking fields to SleepSession for multi-caregiver support
-- Tracks who created and last updated each session

-- AlterTable: Add createdByUserId column to SleepSession
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSession' AND column_name='createdByUserId') THEN
        ALTER TABLE "SleepSession" ADD COLUMN "createdByUserId" TEXT;
    END IF;
END $$;

-- AlterTable: Add lastUpdatedByUserId column to SleepSession
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSession' AND column_name='lastUpdatedByUserId') THEN
        ALTER TABLE "SleepSession" ADD COLUMN "lastUpdatedByUserId" TEXT;
    END IF;
END $$;

-- CreateIndex: Add index on createdByUserId (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'SleepSession_createdByUserId_idx') THEN
        CREATE INDEX "SleepSession_createdByUserId_idx" ON "SleepSession"("createdByUserId");
    END IF;
END $$;

-- AddForeignKey: createdByUserId -> User.id (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SleepSession_createdByUserId_fkey') THEN
        ALTER TABLE "SleepSession" ADD CONSTRAINT "SleepSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: lastUpdatedByUserId -> User.id (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SleepSession_lastUpdatedByUserId_fkey') THEN
        ALTER TABLE "SleepSession" ADD CONSTRAINT "SleepSession_lastUpdatedByUserId_fkey" FOREIGN KEY ("lastUpdatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
