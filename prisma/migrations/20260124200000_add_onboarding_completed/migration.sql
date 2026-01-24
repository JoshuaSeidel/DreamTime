-- Add onboardingCompleted column to User
-- This tracks whether users have completed the getting started wizard
-- New users default to false, existing users are set to true (already using the app)

-- For PostgreSQL:
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='onboardingCompleted') THEN
        -- Add column with default false
        ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
        -- Set existing users as completed (they're already using the app)
        UPDATE "User" SET "onboardingCompleted" = true;
    END IF;
END $$;
