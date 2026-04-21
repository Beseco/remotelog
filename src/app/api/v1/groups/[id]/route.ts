import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, parentId, sortOrder } = body;

  const group = await prisma.group.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!group) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const updated = await prisma.group.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(parentId !== undefined && { parentId: parentId ?? null }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const group = await prisma.group.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!group) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // Move child groups and devices to parent
  await prisma.group.updateMany({ where: { parentId: id }, data: { parentId: group.parentId } });
  await prisma.device.updateMany({ where: { groupId: id }, data: { groupId: group.parentId } });
  await prisma.group.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
