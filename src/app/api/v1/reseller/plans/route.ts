import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      price: true,
      maxCustomers: true,
      maxProjects: true,
      maxDevices: true,
      maxUsers: true,
      paypalPlanId: true,
      sortOrder: true,
    },
  });

  return NextResponse.json(plans);
}
