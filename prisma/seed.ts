import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Default organization
  const org = await prisma.organization.upsert({
    where: { id: "default-org" },
    update: {},
    create: {
      id: "default-org",
      name: "Meine IT-Firma",
    },
  });

  // Default group
  const group = await prisma.group.upsert({
    where: { id: "default-group" },
    update: {},
    create: {
      id: "default-group",
      name: "Alle Geräte",
      organizationId: org.id,
      sortOrder: 0,
    },
  });

  console.log("✅ Seed abgeschlossen:");
  console.log(`   Organisation: ${org.name} (${org.id})`);
  console.log(`   Gruppe: ${group.name}`);
  console.log("");
  console.log("➡️  Admin wird beim ersten Start über /setup erstellt.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
