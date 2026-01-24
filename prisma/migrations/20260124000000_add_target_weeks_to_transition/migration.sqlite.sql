-- Add targetWeeks column to ScheduleTransition (SQLite version)
-- This allows users to customize the transition duration (2-6 weeks, default 6)

-- SQLite doesn't support IF NOT EXISTS for columns, so this may fail if column exists
-- The migration runner should handle this gracefully
ALTER TABLE "ScheduleTransition" ADD COLUMN "targetWeeks" INTEGER NOT NULL DEFAULT 6;
