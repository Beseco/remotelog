import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { sessionIds } = body;

  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return NextResponse.json({ error: "sessionIds muss ein nicht-leeres Array sein" }, { status: 400 });
  }

  const now = new Date();
  const orgId = session.user.organizationId;

  // Mark root sessions as billed
  const rootResult = await prisma.session.updateMany({
    where: {
      id:             { in: sessionIds },
      user:           { organizationId: orgId },
      parentSessionId: null,
      endedAt:        { not: null },
      billed:         false,
    },
    data: { billed: true, billedAt: now },
  });

  // Also mark all child sessions of the affected roots
  await prisma.session.updateMany({
    where: {
      parentSessionId: { in: sessionIds },
      user:            { organizationId: orgId },
      billed:          false,
    },
    data: { billed: true, billedAt: now },
  });

  return NextResponse.json({ updated: rootResult.count });
}
