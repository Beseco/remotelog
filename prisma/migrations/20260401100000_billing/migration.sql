-- AlterTable Organization: billing settings
ALTER TABLE "Organization" ADD COLUMN "hourlyRate"   DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN "roundUpMins"  INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Organization" ADD COLUMN "prepMins"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN "followUpMins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN "minMins"      INTEGER NOT NULL DEFAULT 0;

-- AlterTable Session: billing state
ALTER TABLE "Session" ADD COLUMN "billed"   BOOLEAN   NOT NULL DEFAULT false;
ALTER TABLE "Session" ADD COLUMN "billedAt" TIMESTAMP(3);
