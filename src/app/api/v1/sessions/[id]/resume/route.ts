import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAuth } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.session.findFirst({
    where: { id, user: { organizationId: user.organizationId } },
  });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (existing.endedAt) return NextResponse.json({ error: "Sitzung bereits beendet" }, { status: 409 });

  const openInterval = await prisma.sessionInterval.findFirst({
    where: { sessionId: id, endedAt: null },
  });
  if (openInterval) return NextResponse.json({ error: "Sitzung läuft bereits" }, { status: 409 });

  const resumedAt = new Date();
  await prisma.sessionInterval.create({
    data: { sessionId: id, startedAt: resumedAt },
  });

  return NextResponse.json({ resumedAt: resumedAt.toISOString() });
}
