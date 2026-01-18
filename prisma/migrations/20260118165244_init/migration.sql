-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "birthDate" DATETIME NOT NULL,
    "photoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChildCaregiver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CAREGIVER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChildCaregiver_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChildCaregiver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SleepSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "wakeWindow1Min" INTEGER NOT NULL,
    "wakeWindow1Max" INTEGER NOT NULL,
    "wakeWindow2Min" INTEGER,
    "wakeWindow2Max" INTEGER,
    "wakeWindow3Min" INTEGER,
    "wakeWindow3Max" INTEGER,
    "nap1Earliest" TEXT,
    "nap1LatestStart" TEXT,
    "nap1MaxDuration" INTEGER,
    "nap1EndBy" TEXT,
    "nap2Earliest" TEXT,
    "nap2LatestStart" TEXT,
    "nap2MaxDuration" INTEGER,
    "nap2EndBy" TEXT,
    "nap2ExceptionDuration" INTEGER,
    "bedtimeEarliest" TEXT NOT NULL,
    "bedtimeLatest" TEXT NOT NULL,
    "bedtimeGoalStart" TEXT,
    "bedtimeGoalEnd" TEXT,
    "wakeTimeEarliest" TEXT NOT NULL,
    "wakeTimeLatest" TEXT NOT NULL,
    "daySleepCap" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SleepSchedule_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentWeek" INTEGER NOT NULL DEFAULT 1,
    "currentNapTime" TEXT NOT NULL,
    "completedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleTransition_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SleepSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "napNumber" INTEGER,
    "putDownAt" DATETIME,
    "asleepAt" DATETIME,
    "wokeUpAt" DATETIME,
    "outOfCribAt" DATETIME,
    "cryingMinutes" INTEGER,
    "notes" TEXT,
    "totalMinutes" INTEGER,
    "sleepMinutes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SleepSession_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "ChildCaregiver_userId_idx" ON "ChildCaregiver"("userId");

-- CreateIndex
CREATE INDEX "ChildCaregiver_childId_idx" ON "ChildCaregiver"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildCaregiver_childId_userId_key" ON "ChildCaregiver"("childId", "userId");

-- CreateIndex
CREATE INDEX "SleepSchedule_childId_idx" ON "SleepSchedule"("childId");

-- CreateIndex
CREATE INDEX "SleepSchedule_childId_isActive_idx" ON "SleepSchedule"("childId", "isActive");

-- CreateIndex
CREATE INDEX "ScheduleTransition_childId_idx" ON "ScheduleTransition"("childId");

-- CreateIndex
CREATE INDEX "SleepSession_childId_idx" ON "SleepSession"("childId");

-- CreateIndex
CREATE INDEX "SleepSession_childId_createdAt_idx" ON "SleepSession"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "SleepSession_childId_sessionType_idx" ON "SleepSession"("childId", "sessionType");
