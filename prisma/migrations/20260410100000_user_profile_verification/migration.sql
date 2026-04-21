-- User profile fields (for reseller registration)
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName"  TEXT;
ALTER TABLE "User" ADD COLUMN "company"   TEXT;
ALTER TABLE "User" ADD COLUMN "street"    TEXT;
ALTER TABLE "User" ADD COLUMN "zip"       TEXT;
ALTER TABLE "User" ADD COLUMN "city"      TEXT;
ALTER TABLE "User" ADD COLUMN "country"   TEXT;

-- E-Mail verification fields (enforced only when RESELLER_MODE=true)
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt"            TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "verificationToken"          TEXT;
ALTER TABLE "User" ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");
