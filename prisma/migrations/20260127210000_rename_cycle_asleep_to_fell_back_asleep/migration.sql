-- Rename asleepAt to fellBackAsleepAt and make wokeUpAt required
-- This changes the model from tracking sleep cycles to tracking wake events

-- Step 1: For any cycles where wokeUpAt is NULL, copy asleepAt to wokeUpAt
-- (This handles edge case where old data had asleepAt but no wokeUpAt)
UPDATE "SleepCycle" SET "wokeUpAt" = "asleepAt" WHERE "wokeUpAt" IS NULL;

-- Step 2: Rename asleepAt to fellBackAsleepAt
ALTER TABLE "SleepCycle" RENAME COLUMN "asleepAt" TO "fellBackAsleepAt";

-- Step 3: Make wokeUpAt NOT NULL (it's now the primary required field)
ALTER TABLE "SleepCycle" ALTER COLUMN "wokeUpAt" SET NOT NULL;

-- Step 4: Make fellBackAsleepAt nullable (it's optional - only if baby fell back asleep)
ALTER TABLE "SleepCycle" ALTER COLUMN "fellBackAsleepAt" DROP NOT NULL;
