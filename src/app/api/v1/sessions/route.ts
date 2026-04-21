import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId   = searchParams.get("deviceId");
  const customerId = searchParams.get("customerId");
  const contactId  = searchParams.get("contactId");
  const activeOnly = searchParams.get("active") === "true";

  const sessions = await prisma.session.findMany({
    where: {
      // Sessions belong to the org via the user who created them
      user: { organizationId: user.organizationId },
      // Only return root sessions to avoid showing child sessions as duplicates
      parentSessionId: null,
      ...(deviceId   ? { deviceId }   : {}),
      ...(customerId ? { customerId } : {}),
      ...(contactId  ? { contactId }  : {}),
      ...(activeOnly ? { endedAt: null } : {}),
    },
    include: {
      device:   { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      contact:  { select: { id: true, firstName: true, lastName: true } },
      project:  { select: { id: true, name: true } },
      user:     { select: { id: true, name: true } },
      notes:    { orderBy: { createdAt: "desc" } },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { deviceId, customerId, contactId, projectId, type, startedAt: manualStart, endedAt: manualEnd, note, parentSessionId } = body;

  if (!deviceId && !customerId && !contactId) {
    return NextResponse.json({ error: "deviceId, customerId oder contactId ist erforderlich" }, { status: 400 });
  }

  const validTypes = ["remote", "onsite", "phone"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 });
  }

  const orgId = user.organizationId;

  // Validate parentSessionId if provided
  if (parentSessionId) {
    const parent = await prisma.session.findFirst({
      where: { id: parentSessionId, user: { organizationId: orgId } },
      select: { parentSessionId: true },
    });
    if (!parent) return NextResponse.json({ error: "Übergeordnete Sitzung nicht gefunden" }, { status: 404 });
    if (parent.parentSessionId) return NextResponse.json({ error: "parentSessionId muss auf eine Root-Sitzung zeigen" }, { status: 400 });
  }

  // Validate projectId if provided
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  // Validate whichever reference was provided
  if (deviceId) {
    const device = await prisma.device.findFirst({ where: { id: deviceId, organizationId: orgId } });
    if (!device) return NextResponse.json({ error: "Gerät nicht gefunden" }, { status: 404 });
  }
  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId: orgId } });
    if (!customer) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  }
  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, customer: { organizationId: orgId } },
    });
    if (!contact) return NextResponse.json({ error: "Ansprechpartner nicht gefunden" }, { status: 404 });
  }

  // ── Manual past entry (startedAt + endedAt provided) ─────────────────────
  if (manualStart && manualEnd) {
    const startedAt = new Date(manualStart);
    const endedAt   = new Date(manualEnd);
    if (isNaN(startedAt.getTime())) return NextResponse.json({ error: "Ungültiges Startdatum" }, { status: 400 });
    if (isNaN(endedAt.getTime()))   return NextResponse.json({ error: "Ungültiges Enddatum" }, { status: 400 });
    if (endedAt <= startedAt)
      return NextResponse.json({ error: "Endzeitpunkt muss nach dem Startzeitpunkt liegen" }, { status: 400 });

    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
    const newSession = await prisma.session.create({
      data: {
        deviceId:   deviceId   ?? null,
        customerId: customerId ?? null,
        contactId:  contactId  ?? null,
        projectId:  projectId  ?? null,
        userId:     user.id,
        type,
        startedAt,
        endedAt,
        durationMinutes,
      },
      include: {
        device:   { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        contact:  { select: { id: true, firstName: true, lastName: true } },
        project:  { select: { id: true, name: true } },
        user:     { select: { id: true, name: true } },
      },
    });

    await prisma.sessionInterval.create({
      data: { sessionId: newSession.id, startedAt, endedAt },
    });

    if (note?.trim()) {
      await prisma.sessionNote.create({
        data: { sessionId: newSession.id, content: note.trim() },
      });
    }

    return NextResponse.json(newSession, { status: 201 });
  }

  // ── Live session (timer-based) ────────────────────────────────────────────
  const startedAt = new Date();

  // Auto-parenting: if no explicit parentSessionId was given, check if there's already
  // a root session for the same device (or customer/contact) today → make this a child.
  let resolvedParentId: string | null = parentSessionId ?? null;
  if (!resolvedParentId) {
    const todayStart = new Date(startedAt);
    todayStart.setHours(0, 0, 0, 0);
    const rootToday = await prisma.session.findFirst({
      where: {
        userId:          user.id,
        parentSessionId: null,
        startedAt:       { gte: todayStart },
        endedAt:         { not: null },
        ...(deviceId   ? { deviceId }   : customerId ? { customerId } : contactId ? { contactId } : {}),
      },
      orderBy: { startedAt: "asc" },
      select: { id: true },
    });
    if (rootToday) resolvedParentId = rootToday.id;
  }

  const newSession = await prisma.session.create({
    data: {
      deviceId:        deviceId        ?? null,
      customerId:      customerId      ?? null,
      contactId:       contactId       ?? null,
      projectId:       projectId       ?? null,
      userId:          user.id,
      type,
      startedAt,
      parentSessionId: resolvedParentId,
    },
    include: {
      device:   { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      contact:  { select: { id: true, firstName: true, lastName: true } },
      project:  { select: { id: true, name: true } },
      user:     { select: { id: true, name: true } },
    },
  });

  await prisma.sessionInterval.create({
    data: { sessionId: newSession.id, startedAt },
  });

  return NextResponse.json(newSession, { status: 201 });
}
