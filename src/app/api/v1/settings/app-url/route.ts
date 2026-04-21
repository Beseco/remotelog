import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await requireAuth();
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Nur Administratoren können diese Einstellung ändern" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { appUrl } = body as Record<string, string | null>;

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { appUrl: appUrl?.trim() || null },
  });

  return NextResponse.json({ ok: true });
}
