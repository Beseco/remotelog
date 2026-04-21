import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { role, active } = body;

  // Can't modify own role/active status
  if (id === session.user.id) {
    return NextResponse.json({ error: "Eigenes Konto kann nicht geändert werden" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!target) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const validRoles = ["admin", "techniker", "readonly"];
  if (role !== undefined && !validRoles.includes(role)) {
    return NextResponse.json({ error: "Ungültige Rolle" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined && { role }),
      ...(active !== undefined && { active }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      lastLogin: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Eigenes Konto kann nicht gelöscht werden" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!target) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
