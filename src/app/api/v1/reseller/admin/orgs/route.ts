import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgs = await prisma.organization.findMany({
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { users: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    orgs.map((org) => ({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
      planName: org.subscription?.plan.name ?? null,
      status: org.subscription?.status ?? null,
      trialEndsAt: org.subscription?.trialEndsAt?.toISOString() ?? null,
      userCount: org._count.users,
    }))
  );
}
