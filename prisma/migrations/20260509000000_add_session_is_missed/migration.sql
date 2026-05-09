-- Add isMissed column to SleepSession
-- Tracks naps that were skipped entirely (baby never put in crib).
-- Missed naps stop the schedule from recommending this slot again, but
-- contribute zero qualified rest so sleep debt naturally rises.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='SleepSession' AND column_name='isMissed'
    ) THEN
        ALTER TABLE "SleepSession" ADD COLUMN "isMissed" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
