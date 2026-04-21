ALTER TABLE "Session" ADD COLUMN "parentSessionId" TEXT;

ALTER TABLE "Session" ADD CONSTRAINT "Session_parentSessionId_fkey"
    FOREIGN KEY ("parentSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
