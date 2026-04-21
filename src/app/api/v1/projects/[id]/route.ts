import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAuth } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      customer: { select: { id: true, name: true } },
      sessions: {
        where: { parentSessionId: null },
        include: {
          device: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 50,
      },
      _count: { select: { sessions: true } },
    },
  });

  if (!project) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!project) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const body = await req.json();
  const { name, status, taskRate, dueDate, notes, budgetedHours } = body;

  const validStatuses = ["active", "completed", "paused"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(name != null ? { name: String(name).trim() } : {}),
      ...(status != null ? { status } : {}),
      ...(taskRate !== undefined ? { taskRate: taskRate != null ? Number(taskRate) : null } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() ?? null } : {}),
      ...(budgetedHours !== undefined ? { budgetedHours: budgetedHours != null ? Number(budgetedHours) : null } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!project) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
