-- Reseller / SaaS feature: Plan + Subscription tables
-- Only required when RESELLER_MODE=true

CREATE TABLE "Plan" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "price"        DOUBLE PRECISION NOT NULL,
  "maxCustomers" INTEGER,
  "maxProjects"  INTEGER,
  "maxDevices"   INTEGER,
  "maxUsers"     INTEGER,
  "paypalPlanId" TEXT,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
  "id"                   TEXT NOT NULL,
  "organizationId"       TEXT NOT NULL,
  "planId"               TEXT NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'trialing',
  "paypalSubscriptionId" TEXT,
  "trialEndsAt"          TIMESTAMP(3),
  "currentPeriodEnd"     TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON UPDATE CASCADE;
