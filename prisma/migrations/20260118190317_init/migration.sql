-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "webAuthnChallenge" TEXT,
    "webAuthnChallengeExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAuthnCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "transports" TEXT,
    "friendlyName" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildCaregiver" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CAREGIVER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildCaregiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepSchedule" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleepSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleTransition" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentWeek" INTEGER NOT NULL DEFAULT 1,
    "currentNapTime" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepSession" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "napNumber" INTEGER,
    "putDownAt" TIMESTAMP(3),
    "asleepAt" TIMESTAMP(3),
    "wokeUpAt" TIMESTAMP(3),
    "outOfCribAt" TIMESTAMP(3),
    "cryingMinutes" INTEGER,
    "notes" TEXT,
    "totalMinutes" INTEGER,
    "sleepMinutes" INTEGER,
    "settlingMinutes" INTEGER,
    "postWakeMinutes" INTEGER,
    "awakeCribMinutes" INTEGER,
    "qualifiedRestMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleepSession_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId");

-- CreateIndex
CREATE INDEX "WebAuthnCredential_userId_idx" ON "WebAuthnCredential"("userId");

-- CreateIndex
CREATE INDEX "WebAuthnCredential_credentialId_idx" ON "WebAuthnCredential"("credentialId");

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

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAuthnCredential" ADD CONSTRAINT "WebAuthnCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildCaregiver" ADD CONSTRAINT "ChildCaregiver_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildCaregiver" ADD CONSTRAINT "ChildCaregiver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepSchedule" ADD CONSTRAINT "SleepSchedule_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTransition" ADD CONSTRAINT "ScheduleTransition_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepSession" ADD CONSTRAINT "SleepSession_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
