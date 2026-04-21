import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAuth();

  const registrations = await prisma.deviceRegistration.findMany({
    where: {
      organizationId: session.user.organizationId,
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      computerName: true,
      rustdeskId: true,
      createdAt: true,
    },
  });

  return NextResponse.json(registrations);
}
