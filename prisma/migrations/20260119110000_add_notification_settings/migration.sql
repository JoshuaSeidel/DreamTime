-- Add notification reminder settings to SleepSchedule
-- These control how many minutes before each event type to send reminders

-- AlterTable: Add napReminderMinutes column to SleepSchedule (default 30 minutes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='napReminderMinutes') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "napReminderMinutes" INTEGER NOT NULL DEFAULT 30;
    END IF;
END $$;

-- AlterTable: Add bedtimeReminderMinutes column to SleepSchedule (default 30 minutes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='bedtimeReminderMinutes') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "bedtimeReminderMinutes" INTEGER NOT NULL DEFAULT 30;
    END IF;
END $$;

-- AlterTable: Add wakeDeadlineReminderMinutes column to SleepSchedule (default 15 minutes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SleepSchedule' AND column_name='wakeDeadlineReminderMinutes') THEN
        ALTER TABLE "SleepSchedule" ADD COLUMN "wakeDeadlineReminderMinutes" INTEGER NOT NULL DEFAULT 15;
    END IF;
END $$;
