-- Add SleepCycle model for tracking multiple wake-ups within a sleep session
-- This is primarily used for night sleep where baby may wake multiple times

-- CreateTable (PostgreSQL)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='SleepCycle') THEN
        CREATE TABLE "SleepCycle" (
            "id" TEXT NOT NULL,
            "sessionId" TEXT NOT NULL,
            "cycleNumber" INTEGER NOT NULL,
            "asleepAt" TIMESTAMP(3) NOT NULL,
            "wokeUpAt" TIMESTAMP(3),
            "sleepMinutes" INTEGER,
            "awakeMinutes" INTEGER,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "SleepCycle_pkey" PRIMARY KEY ("id")
        );

        -- CreateIndex
        CREATE INDEX "SleepCycle_sessionId_idx" ON "SleepCycle"("sessionId");
        CREATE INDEX "SleepCycle_sessionId_cycleNumber_idx" ON "SleepCycle"("sessionId", "cycleNumber");

        -- AddForeignKey
        ALTER TABLE "SleepCycle" ADD CONSTRAINT "SleepCycle_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SleepSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
