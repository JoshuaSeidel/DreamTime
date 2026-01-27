-- Add bedtimeMode column to SleepSchedule
-- GOAL_BASED: Start with goal bedtime (7pm) and subtract sleep debt
-- WAKE_WINDOW: Calculate from nap end time using wake window, then subtract sleep debt

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='bedtimeMode') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "bedtimeMode" TEXT NOT NULL DEFAULT 'GOAL_BASED';
    END IF;
END $$;
