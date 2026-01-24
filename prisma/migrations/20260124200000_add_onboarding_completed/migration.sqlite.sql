-- Add onboardingCompleted column to User (SQLite version)
-- This tracks whether users have completed the getting started wizard
-- New users default to false, existing users are set to true (already using the app)

-- SQLite doesn't support IF NOT EXISTS for columns, so this may fail if column exists
-- The migration runner should handle this gracefully
ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT 0;

-- Set existing users as completed (they're already using the app)
UPDATE "User" SET "onboardingCompleted" = 1;
