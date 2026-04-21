import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAuth } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

async function findSession(id: string, orgId: string) {
  return prisma.session.findFirst({
    where: { id, user: { organizationId: orgId } },
  });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.session.findFirst({
    where: { id, user: { organizationId: user.organizationId } },
    include: {
      device:    { select: { id: true, name: true } },
      customer:  { select: { id: true, name: true } },
      contact:   { select: { id: true, firstName: true, lastName: true } },
      project:   { select: { id: true, name: true } },
      user:      { select: { id: true, name: true } },
      notes:     { orderBy: { createdAt: "asc" } },
      intervals: { orderBy: { startedAt: "asc" } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  return NextResponse.json({
    ...existing,
    startedAt: existing.startedAt.toISOString(),
    endedAt:   existing.endedAt?.toISOString() ?? null,
    intervals: existing.intervals.map((iv) => ({
      id:        iv.id,
      startedAt: iv.startedAt.toISOString(),
      endedAt:   iv.endedAt?.toISOString() ?? null,
    })),
    notes: existing.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await findSession(id, user.organizationId);
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // ── Edit mode: startedAt / endedAt / type provided ────────────────────────
  if (
    body.startedAt !== undefined ||
    body.endedAt !== undefined ||
    body.type !== undefined ||
    body.deviceId !== undefined ||
    body.customerId !== undefined ||
    body.contactId !== undefined ||
    body.projectId !== undefined
  ) {
    if (existing.billed) {
      return NextResponse.json(
        { error: "Abgerechnete Sitzungen können nicht mehr bearbeitet werden" },
        { status: 409 },
      );
    }

    const newStartedAt = body.startedAt ? new Date(body.startedAt) : existing.startedAt;
    const newEndedAt   = body.endedAt   ? new Date(body.endedAt)   : existing.endedAt;

    if (isNaN(newStartedAt.getTime())) {
      return NextResponse.json({ error: "Ungültiges Startdatum" }, { status: 400 });
    }
    if (newEndedAt && isNaN(newEndedAt.getTime())) {
      return NextResponse.json({ error: "Ungültiges Enddatum" }, { status: 400 });
    }
    if (newEndedAt && newEndedAt <= newStartedAt) {
      return NextResponse.json(
        { error: "Endzeitpunkt muss nach dem Startzeitpunkt liegen" },
        { status: 400 },
      );
    }

    const validTypes = ["remote", "onsite", "phone"];
    if (body.type && !validTypes.includes(body.type)) {
      return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 });
    }

    const nextDeviceId = body.deviceId !== undefined ? body.deviceId : existing.deviceId;
    const nextCustomerId = body.customerId !== undefined ? body.customerId : existing.customerId;
    const nextContactId = body.contactId !== undefined ? body.contactId : existing.contactId;
    const nextProjectId = body.projectId !== undefined ? body.projectId : existing.projectId;

    const targetCount = [nextDeviceId, nextCustomerId, nextContactId].filter(Boolean).length;
    if (targetCount !== 1) {
      return NextResponse.json(
        { error: "Genau ein Ziel (Gerät, Kunde oder Ansprechpartner) ist erforderlich" },
        { status: 400 },
      );
    }

    if (nextDeviceId) {
      const device = await prisma.device.findFirst({
        where: { id: nextDeviceId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!device) return NextResponse.json({ error: "Gerät nicht gefunden" }, { status: 404 });
    }
    if (nextCustomerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: nextCustomerId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!customer) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }
    if (nextContactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: nextContactId, customer: { organizationId: user.organizationId } },
        select: { id: true },
      });
      if (!contact) {
        return NextResponse.json({ error: "Ansprechpartner nicht gefunden" }, { status: 404 });
      }
    }
    if (nextProjectId) {
      const project = await prisma.project.findFirst({
        where: { id: nextProjectId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    }

    const newDuration = newEndedAt
      ? Math.round((newEndedAt.getTime() - newStartedAt.getTime()) / 60000)
      : null;

    const updated = await prisma.session.update({
      where: { id },
      data: {
        startedAt:       newStartedAt,
        endedAt:         newEndedAt ?? existing.endedAt,
        durationMinutes: newDuration ?? existing.durationMinutes,
        deviceId:        nextDeviceId ?? null,
        customerId:      nextCustomerId ?? null,
        contactId:       nextContactId ?? null,
        projectId:       nextProjectId ?? null,
        ...(body.type ? { type: body.type } : {}),
        ...(body.note?.trim()
          ? { notes: { create: { content: body.note.trim() } } }
          : {}),
      },
      include: {
        device:   { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        contact:  { select: { id: true, firstName: true, lastName: true } },
        project:  { select: { id: true, name: true } },
        user:     { select: { id: true, name: true } },
        notes:    true,
      },
    });

    // When times were edited, replace intervals with a single closed one
    if (newEndedAt && (body.startedAt !== undefined || body.endedAt !== undefined)) {
      await prisma.sessionInterval.deleteMany({ where: { sessionId: id } });
      await prisma.sessionInterval.create({
        data: { sessionId: id, startedAt: newStartedAt, endedAt: newEndedAt },
      });
    }

    return NextResponse.json({
      ...updated,
      startedAt: updated.startedAt.toISOString(),
      endedAt:   updated.endedAt?.toISOString() ?? null,
    });
  }

  // ── Stop mode: Sitzung beenden ────────────────────────────────────────────
  const endedAt = new Date();

  // Close any still-open interval
  if (!existing.endedAt) {
    await prisma.sessionInterval.updateMany({
      where: { sessionId: id, endedAt: null },
      data:  { endedAt },
    });
  }

  let durationMinutes: number | null;
  if (typeof body.durationMinutes === "number") {
    // Explicit override from client (e.g. legacy timer)
    durationMinutes = body.durationMinutes;
  } else if (existing.endedAt) {
    durationMinutes = existing.durationMinutes;
  } else {
    // Sum all intervals
    const intervals = await prisma.sessionInterval.findMany({ where: { sessionId: id } });
    const totalMs = intervals.reduce((sum, iv) => {
      const end = iv.endedAt ?? endedAt;
      return sum + (end.getTime() - iv.startedAt.getTime());
    }, 0);
    durationMinutes = Math.round(totalMs / 60000);
  }

  const updated = await prisma.session.update({
    where: { id },
    data: {
      endedAt: existing.endedAt ?? endedAt,
      durationMinutes,
      ...(body.note?.trim()
        ? { notes: { create: { content: body.note.trim() } } }
        : {}),
    },
    include: {
      device:   { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      contact:  { select: { id: true, firstName: true, lastName: true } },
      project:  { select: { id: true, name: true } },
      user:     { select: { id: true, name: true } },
      notes:    true,
    },
  });

  return NextResponse.json({
    ...updated,
    startedAt: updated.startedAt.toISOString(),
    endedAt:   updated.endedAt?.toISOString() ?? null,
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await findSession(id, user.organizationId);
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // Admins can delete any session; others only their own unbilled sessions
  const isAdmin      = user.role === "admin";
  const isOwnSession = existing.userId === user.id;
  if (!isAdmin && (!isOwnSession || existing.billed)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If this is a root session, delete all child sessions first
  if (!existing.parentSessionId) {
    await prisma.session.deleteMany({
      where: { parentSessionId: id },
    });
  }

  await prisma.session.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
