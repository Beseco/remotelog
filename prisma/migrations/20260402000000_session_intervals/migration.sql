CREATE TABLE "SessionInterval" (
    "id"        TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt"   TIMESTAMP(3),
    CONSTRAINT "SessionInterval_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SessionInterval" ADD CONSTRAINT "SessionInterval_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
