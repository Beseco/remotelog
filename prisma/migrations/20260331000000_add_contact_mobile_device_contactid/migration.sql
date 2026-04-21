-- Add mobile field to Contact
ALTER TABLE "Contact" ADD COLUMN "mobile" TEXT;

-- Add contactId field to Device
ALTER TABLE "Device" ADD COLUMN "contactId" TEXT;

-- Add foreign key constraint
ALTER TABLE "Device" ADD CONSTRAINT "Device_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
