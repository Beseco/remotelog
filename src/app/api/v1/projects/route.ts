import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAuth } from "@/lib/api-auth";
import { resellerGuard } from "@/addons/reseller/guard";

export async function GET(req: NextRequest) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const status = searchParams.get("status");

  const projects = await prisma.project.findMany({
    where: {
      organizationId: user.organizationId,
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const guard = await resellerGuard(user.organizationId, "projects");
  if (guard) return guard;

  const body = await req.json();
  const { customerId, name, status, taskRate, dueDate, notes, budgetedHours } = body;

  if (!customerId || !name?.trim()) {
    return NextResponse.json({ error: "customerId und name sind erforderlich" }, { status: 400 });
  }

  const validStatuses = ["active", "completed", "paused"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: user.organizationId },
  });
  if (!customer) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

  const project = await prisma.project.create({
    data: {
      organizationId: user.organizationId,
      customerId,
      name: name.trim(),
      status: status ?? "active",
      taskRate: taskRate != null ? Number(taskRate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes?.trim() ?? null,
      budgetedHours: budgetedHours != null ? Number(budgetedHours) : null,
    },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json(project, { status: 201 });
}
