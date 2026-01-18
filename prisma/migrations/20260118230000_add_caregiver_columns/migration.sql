-- AlterTable: Add missing columns to ChildCaregiver
-- Using DO blocks for idempotent column additions

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='title') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "title" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='isActive') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='invitedByUserId') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "invitedByUserId" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='inviteEmail') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "inviteEmail" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='invitedAt') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='acceptedAt') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "acceptedAt" TIMESTAMP(3);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChildCaregiver' AND column_name='accessChangedAt') THEN
        ALTER TABLE "ChildCaregiver" ADD COLUMN "accessChangedAt" TIMESTAMP(3);
    END IF;
END $$;

-- CreateIndex (if not exists)
CREATE INDEX IF NOT EXISTS "ChildCaregiver_childId_isActive_idx" ON "ChildCaregiver"("childId", "isActive");
