-- Add session token to DeviceRegistration for the EXE install flow
ALTER TABLE "DeviceRegistration" ADD COLUMN "sessionToken" TEXT;
CREATE UNIQUE INDEX "DeviceRegistration_sessionToken_key" ON "DeviceRegistration"("sessionToken");
