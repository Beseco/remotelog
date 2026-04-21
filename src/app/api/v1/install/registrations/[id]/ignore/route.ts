import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  const { id } = await params;

  const registration = await prisma.deviceRegistration.findUnique({
    where: { id },
    select: { organizationId: true, status: true },
  });

  if (!registration || registration.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  await prisma.deviceRegistration.update({
    where: { id },
    data: { status: "ignored" },
  });

  return NextResponse.json({ ok: true });
}
