-- Add targetWeeks column to ScheduleTransition
-- This allows users to customize the transition duration (2-6 weeks, default 6)

-- PostgreSQL version: Uses DO block for idempotent migration
-- SQLite version: Uses simple ALTER TABLE (SQLite ignores IF NOT EXISTS for columns)

-- For PostgreSQL:
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ScheduleTransition' AND column_name='targetWeeks') THEN
        ALTER TABLE "ScheduleTransition" ADD COLUMN "targetWeeks" INTEGER NOT NULL DEFAULT 6;
    END IF;
END $$;
