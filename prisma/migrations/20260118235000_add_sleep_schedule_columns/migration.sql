-- AlterTable: Add missing columns to SleepSchedule
-- Using DO blocks for idempotent column additions

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='minimumCribMinutes') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "minimumCribMinutes" INTEGER NOT NULL DEFAULT 90;
    END IF;
END $$;
