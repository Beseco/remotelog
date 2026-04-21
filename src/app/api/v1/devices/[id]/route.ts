import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const device = await prisma.device.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      remoteIds: { select: { id: true, type: true, remoteId: true, label: true, password: true, sshUser: true } },
      group: { select: { id: true, name: true } },
      sessions: {
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { notes: true },
      },
    },
  });

  if (!device) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(device);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, groupId, customerId, contactId, macAddress, ipAddress, notes, tags, remoteIds } = body;

  const existing = await prisma.device.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const hasSshPassword = (remoteIds ?? []).some((r: { type: string; sshPassword?: string }) => r.type === "ssh" && r.sshPassword);
  if (hasSshPassword && !process.env.ENCRYPTION_KEY) {
    return NextResponse.json({ error: "ENCRYPTION_KEY ist nicht konfiguriert. SSH-Passwort kann nicht verschlüsselt werden." }, { status: 500 });
  }

  const device = await prisma.device.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(groupId !== undefined && { groupId: groupId ?? null }),
      ...(customerId !== undefined && { customerId: customerId ?? null }),
      ...(contactId !== undefined && { contactId: contactId ?? null }),
      ...(macAddress !== undefined && { macAddress: macAddress ?? null }),
      ...(ipAddress !== undefined && { ipAddress: ipAddress ?? null }),
      ...(notes !== undefined && { notes: notes ?? null }),
      ...(tags !== undefined && { tags }),
      ...(remoteIds !== undefined && {
        remoteIds: {
          deleteMany: {},
          create: remoteIds.map((r: { type: string; remoteId: string; label?: string; sshUser?: string; sshPassword?: string }) => ({
            type: r.type,
            remoteId: r.remoteId,
            label: r.label ?? null,
            ...(r.type === "ssh" && {
              sshUser: r.sshUser ?? null,
              sshPasswordEnc: r.sshPassword ? encrypt(r.sshPassword) : null,
            }),
          })),
        },
      }),
    },
    include: { remoteIds: { select: { id: true, type: true, remoteId: true, label: true, password: true, sshUser: true } }, group: { select: { id: true, name: true } } },
  });

  return NextResponse.json(device);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.device.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const data: Record<string, string | null> = {};
  if ("customerId" in body) data.customerId = body.customerId ?? null;
  if ("contactId" in body) data.contactId = body.contactId ?? null;

  const device = await prisma.device.update({
    where: { id },
    data,
    include: {
      remoteIds: { select: { id: true, type: true, remoteId: true, label: true, password: true, sshUser: true } },
      group: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(device);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const device = await prisma.device.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!device) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.device.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
