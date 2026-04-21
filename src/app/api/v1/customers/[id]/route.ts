import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      contacts: { orderBy: { lastName: "asc" } },
      devices: {
        include: {
          remoteIds: true,
          group: { select: { id: true, name: true } },
          sessions: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { id: true, startedAt: true, endedAt: true, type: true },
          },
        },
        orderBy: { name: "asc" },
      },
      groups: { orderBy: { name: "asc" } },
    },
  });

  if (!customer) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // Recent sessions across all customer devices
  const recentSessions = await prisma.session.findMany({
    where: { device: { customerId: id, organizationId: session.user.organizationId } },
    include: {
      device: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      notes: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    ...customer,
    recentSessions: recentSessions.map(s => ({
      ...s,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
    })),
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, notes, customerNumber, email, phone, website, street, zip, city, country } = body;

  const existing = await prisma.customer.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(notes !== undefined && { notes: notes?.trim() || null }),
      ...(customerNumber !== undefined && { customerNumber: customerNumber?.trim() || null }),
      ...(email !== undefined && { email: email?.trim() || null }),
      ...(phone !== undefined && { phone: phone?.trim() || null }),
      ...(website !== undefined && { website: website?.trim() || null }),
      ...(street !== undefined && { street: street?.trim() || null }),
      ...(zip !== undefined && { zip: zip?.trim() || null }),
      ...(city !== undefined && { city: city?.trim() || null }),
      ...(country !== undefined && { country: country?.trim() || null }),
    },
    include: {
      contacts: true,
      _count: { select: { devices: true } },
    },
  });

  return NextResponse.json(customer);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.customer.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // Unlink devices and groups before deleting
  await prisma.device.updateMany({ where: { customerId: id }, data: { customerId: null } });
  await prisma.group.updateMany({ where: { customerId: id }, data: { customerId: null } });
  await prisma.customer.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
