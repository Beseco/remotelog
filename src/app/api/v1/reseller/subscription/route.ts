import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: session.user.organizationId },
    include: { plan: true },
  });

  if (!subscription) {
    return NextResponse.json({ subscription: null, plan: null });
  }

  // Current usage counts
  const orgId = session.user.organizationId;
  const [customers, projects, devices, users] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId } }),
    prisma.project.count({ where: { organizationId: orgId } }),
    prisma.device.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId, active: true } }),
  ]);

  return NextResponse.json({
    subscription: {
      id: subscription.id,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    plan: {
      id: subscription.plan.id,
      name: subscription.plan.name,
      price: subscription.plan.price,
      maxCustomers: subscription.plan.maxCustomers,
      maxProjects: subscription.plan.maxProjects,
      maxDevices: subscription.plan.maxDevices,
      maxUsers: subscription.plan.maxUsers,
    },
    usage: { customers, projects, devices, users },
  });
}
