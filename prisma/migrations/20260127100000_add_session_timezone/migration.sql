-- Add timezone column to SleepSession
-- Stores the timezone where the session was recorded so historical data displays correctly
-- even when the user travels to a different timezone

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSession' AND column_name='timezone') THEN
        ALTER TABLE "SleepSession" ADD COLUMN "timezone" TEXT;
    END IF;
END $$;
