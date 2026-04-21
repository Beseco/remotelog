ALTER TABLE "User"
  ADD COLUMN "notifIntervalMins"   INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "notifSoundEnabled"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifDesktopEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifBadgeEnabled"   BOOLEAN NOT NULL DEFAULT true;
