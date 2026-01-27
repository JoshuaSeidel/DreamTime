-- Add wakeType column to SleepCycle for tracking wake period quality
-- QUIET = 50% rest credit (default), RESTLESS/CRYING = 0% credit
-- This allows retroactive editing when reviewing video recordings

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='SleepCycle' AND column_name='wakeType'
    ) THEN
        ALTER TABLE "SleepCycle" ADD COLUMN "wakeType" TEXT NOT NULL DEFAULT 'QUIET';
    END IF;
END $$;
