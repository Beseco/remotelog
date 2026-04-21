import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resellerGuard } from "@/addons/reseller/guard";
import { encrypt } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");

  const devices = await prisma.device.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...(groupId ? { groupId } : {}),
    },
    include: {
      remoteIds: { select: { id: true, type: true, remoteId: true, label: true, password: true, sshUser: true } },
      group: { select: { id: true, name: true } },
      sessions: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, startedAt: true, endedAt: true, type: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(devices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const guard = await resellerGuard(session.user.organizationId, "devices");
  if (guard) return guard;

  const body = await req.json();
  const { name, groupId, customerId, contactId, macAddress, ipAddress, notes, tags, remoteIds } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });

  const hasSshPassword = (remoteIds ?? []).some((r: { type: string; sshPassword?: string }) => r.type === "ssh" && r.sshPassword);
  if (hasSshPassword && !process.env.ENCRYPTION_KEY) {
    return NextResponse.json({ error: "ENCRYPTION_KEY ist nicht konfiguriert. SSH-Passwort kann nicht verschlüsselt werden." }, { status: 500 });
  }

  const device = await prisma.device.create({
    data: {
      name: name.trim(),
      groupId: groupId ?? null,
      customerId: customerId ?? null,
      contactId: contactId ?? null,
      organizationId: session.user.organizationId,
      macAddress: macAddress ?? null,
      ipAddress: ipAddress ?? null,
      notes: notes ?? null,
      tags: tags ?? [],
      remoteIds: {
        create: (remoteIds ?? []).map((r: { type: string; remoteId: string; label?: string; sshUser?: string; sshPassword?: string }) => ({
          type: r.type,
          remoteId: r.remoteId,
          label: r.label ?? null,
          ...(r.type === "ssh" && {
            sshUser: r.sshUser ?? null,
            sshPasswordEnc: r.sshPassword ? encrypt(r.sshPassword) : null,
          }),
        })),
      },
    },
    include: { remoteIds: { select: { id: true, type: true, remoteId: true, label: true, password: true, sshUser: true } }, group: { select: { id: true, name: true } } },
  });

  return NextResponse.json(device, { status: 201 });
}
