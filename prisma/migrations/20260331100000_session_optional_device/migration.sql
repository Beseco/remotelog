-- Make deviceId optional on Session
ALTER TABLE "Session" ALTER COLUMN "deviceId" DROP NOT NULL;

-- Add customerId and contactId to Session
ALTER TABLE "Session" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Session" ADD COLUMN "contactId" TEXT;

-- Foreign key constraints
ALTER TABLE "Session" ADD CONSTRAINT "Session_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
