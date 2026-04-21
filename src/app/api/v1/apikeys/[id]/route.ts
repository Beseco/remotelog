import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { active, name } = body;

  // Verify ownership
  const key = await prisma.apiKey.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.apiKey.update({
    where: { id },
    data: {
      ...(typeof active === "boolean" ? { active } : {}),
      ...(name?.trim() ? { name: name.trim() } : {}),
    },
    select: {
      id: true,
      name: true,
      type: true,
      active: true,
      expiresAt: true,
      lastUsedAt: true,
      ipWhitelist: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ...updated,
    expiresAt: updated.expiresAt?.toISOString() ?? null,
    lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const key = await prisma.apiKey.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.apiKey.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
