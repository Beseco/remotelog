-- Organization: public download token
ALTER TABLE "Organization" ADD COLUMN "registrationToken" TEXT;
CREATE UNIQUE INDEX "Organization_registrationToken_key" ON "Organization"("registrationToken");

-- RemoteId: optional permanent password
ALTER TABLE "RemoteId" ADD COLUMN "password" TEXT;

-- DeviceRegistration: new devices that report in after self-install
CREATE TABLE "DeviceRegistration" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email"          TEXT,
    "computerName"   TEXT,
    "rustdeskId"     TEXT NOT NULL,
    "password"       TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'pending',
    "deviceId"       TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceRegistration_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeviceRegistration"
    ADD CONSTRAINT "DeviceRegistration_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeviceRegistration"
    ADD CONSTRAINT "DeviceRegistration_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
