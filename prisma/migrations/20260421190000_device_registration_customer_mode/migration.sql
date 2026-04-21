ALTER TABLE "DeviceRegistration" ADD COLUMN "customerId" TEXT;
ALTER TABLE "DeviceRegistration" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'unattended';
