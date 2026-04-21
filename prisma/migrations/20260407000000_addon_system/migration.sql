-- CreateTable
CREATE TABLE "Addon" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Addon_organizationId_key_key" ON "Addon"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add zammadOrgId to Customer
ALTER TABLE "Customer" ADD COLUMN "zammadOrgId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_zammadOrgId_key" ON "Customer"("organizationId", "zammadOrgId") WHERE "zammadOrgId" IS NOT NULL;

-- AlterTable: add zammadUserId to Contact
ALTER TABLE "Contact" ADD COLUMN "zammadUserId" INTEGER;
