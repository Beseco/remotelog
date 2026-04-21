/**
 * Seed default reseller plans.
 * Run with: npx tsx prisma/seed-reseller.ts
 * Or call seedResellerPlans() from prisma/seed.ts if present.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("../src/generated/prisma") as typeof import("../src/generated/prisma");
import { DEFAULT_PLANS } from "../src/addons/reseller/plans";

const prisma = new PrismaClient();

export async function seedResellerPlans() {
  for (const plan of DEFAULT_PLANS) {
    const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.plan.create({ data: plan });
      console.log(`Created plan: ${plan.name} (${plan.price} €/mo)`);
    } else {
      console.log(`Plan already exists: ${plan.name}`);
    }
  }
}

// Run directly
seedResellerPlans()
  .then(() => console.log("Reseller plans seeded."))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
