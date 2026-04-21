import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  RemoteLogExport,
  ImportSummary,
  ImportSummaryEntry,
  ExportCustomer,
  ExportContact,
  ExportGroup,
  ExportDevice,
  ExportProject,
  ExportSession,
} from "@/lib/export-types";

function emptySummary(): ImportSummaryEntry {
  return { created: 0, updated: 0, skipped: 0 };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgId = session.user.organizationId;
  const currentUserEmail = session.user.email;

  let data: RemoteLogExport;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });
    }
    const text = await (file as File).text();
    data = JSON.parse(text) as RemoteLogExport;
    if (data.version !== "1") {
      return NextResponse.json({ error: `Unbekannte Export-Version: ${data.version}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Datei" }, { status: 400 });
  }

  const summary: ImportSummary = { errors: [] };

  // ID-Mapping: originalId → neue DB-ID
  const customerIdMap = new Map<string, string>();
  const contactIdMap = new Map<string, string>();
  const groupIdMap = new Map<string, string>();
  const deviceIdMap = new Map<string, string>();
  const projectIdMap = new Map<string, string>();
  const userIdMap = new Map<string, string>();
  const sessionIdMap = new Map<string, string>();

  // ── 1. Einstellungen ───────────────────────────────────────────────────────
  if (data.settings) {
    summary.settings = emptySummary();
    try {
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          hourlyRate: data.settings.hourlyRate,
          roundUpMins: data.settings.roundUpMins,
          prepMins: data.settings.prepMins,
          followUpMins: data.settings.followUpMins,
          minMins: data.settings.minMins,
          rustdeskIdServer: data.settings.rustdeskIdServer,
          rustdeskRelay: data.settings.rustdeskRelay,
          rustdeskKey: data.settings.rustdeskKey,
          smtpHost: data.settings.smtpHost,
          smtpPort: data.settings.smtpPort,
          smtpSecure: data.settings.smtpSecure,
          smtpUser: data.settings.smtpUser,
          smtpPass: data.settings.smtpPass,
          smtpFrom: data.settings.smtpFrom,
        },
      });
      summary.settings.updated = 1;
    } catch (err) {
      summary.errors.push(`Einstellungen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── 2. Gruppen (Hierarchie: Eltern vor Kindern) ────────────────────────────
  if (data.groups?.length) {
    summary.groups = emptySummary();
    const groups = [...data.groups];

    // Sortiere: null-parent zuerst, dann iterativ nach bekannten IDs
    const sorted: typeof groups = [];
    const remaining = [...groups];
    let iterations = 0;
    while (remaining.length > 0 && iterations < groups.length + 1) {
      iterations++;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const g = remaining[i];
        if (!g.originalParentId || groupIdMap.has(g.originalParentId)) {
          sorted.push(g);
          remaining.splice(i, 1);
        }
      }
    }
    // Rest anhängen (zyklische Refs o.ä.)
    sorted.push(...remaining);

    for (const g of sorted) {
      try {
        const parentId = g.originalParentId ? (groupIdMap.get(g.originalParentId) ?? null) : null;
        const customerId = g.originalCustomerId ? (customerIdMap.get(g.originalCustomerId) ?? null) : null;

        const existing = await prisma.group.findFirst({
          where: { organizationId: orgId, name: g.name, parentId: parentId ?? undefined },
          select: { id: true },
        });
        if (existing) {
          await prisma.group.update({
            where: { id: existing.id },
            data: { sortOrder: g.sortOrder, customerId },
          });
          groupIdMap.set(g.originalId, existing.id);
          summary.groups.updated++;
        } else {
          const created = await prisma.group.create({
            data: { name: g.name, organizationId: orgId, parentId, customerId, sortOrder: g.sortOrder },
            select: { id: true },
          });
          groupIdMap.set(g.originalId, created.id);
          summary.groups.created++;
        }
      } catch (err) {
        summary.errors.push(`Gruppe "${g.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── 3. Kunden + Kontakte ───────────────────────────────────────────────────
  if (data.customers?.length) {
    summary.customers = emptySummary();
    summary.contacts = emptySummary();

    for (const c of data.customers) {
      try {
        await importCustomer(c, orgId, customerIdMap, contactIdMap, summary);
      } catch (err) {
        summary.errors.push(`Kunde "${c.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── 4. Benutzer ────────────────────────────────────────────────────────────
  if (data.users?.length) {
    summary.users = emptySummary();
    for (const u of data.users) {
      try {
        if (u.email.toLowerCase() === currentUserEmail?.toLowerCase()) {
          // Eigenen Account nie überschreiben — nur ID mappen
          const self = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
          if (self) userIdMap.set(u.originalId, self.id);
          summary.users.skipped++;
          continue;
        }

        const existing = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
        if (existing) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { name: u.name, role: u.role, active: u.active, passwordHash: u.passwordHash },
          });
          userIdMap.set(u.originalId, existing.id);
          summary.users.updated++;
        } else {
          const created = await prisma.user.create({
            data: { name: u.name, email: u.email, passwordHash: u.passwordHash, role: u.role, active: u.active, organizationId: orgId },
            select: { id: true },
          });
          userIdMap.set(u.originalId, created.id);
          summary.users.created++;
        }
      } catch (err) {
        summary.errors.push(`Benutzer "${u.email}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── 5. Projekte ────────────────────────────────────────────────────────────
  if (data.projects?.length) {
    summary.projects = emptySummary();
    for (const p of data.projects) {
      try {
        const customerId = customerIdMap.get(p.originalCustomerId);
        if (!customerId) {
          summary.errors.push(`Projekt "${p.name}": Kunde nicht gefunden (${p.originalCustomerId})`);
          continue;
        }

        const existing = await prisma.project.findFirst({
          where: { organizationId: orgId, customerId, name: p.name },
          select: { id: true },
        });
        if (existing) {
          await prisma.project.update({
            where: { id: existing.id },
            data: { status: p.status, taskRate: p.taskRate, dueDate: p.dueDate ? new Date(p.dueDate) : null, notes: p.notes, budgetedHours: p.budgetedHours },
          });
          projectIdMap.set(p.originalId, existing.id);
          summary.projects.updated++;
        } else {
          const created = await prisma.project.create({
            data: { name: p.name, organizationId: orgId, customerId, status: p.status, taskRate: p.taskRate, dueDate: p.dueDate ? new Date(p.dueDate) : null, notes: p.notes, budgetedHours: p.budgetedHours, invoiceNinjaProjectId: p.invoiceNinjaProjectId },
            select: { id: true },
          });
          projectIdMap.set(p.originalId, created.id);
          summary.projects.created++;
        }
      } catch (err) {
        summary.errors.push(`Projekt "${p.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── 6. Geräte ──────────────────────────────────────────────────────────────
  if (data.devices?.length) {
    summary.devices = emptySummary();
    for (const d of data.devices) {
      try {
        await importDevice(d, orgId, groupIdMap, customerIdMap, deviceIdMap, summary);
      } catch (err) {
        summary.errors.push(`Gerät "${d.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── 7. Sitzungen ───────────────────────────────────────────────────────────
  if (data.sessions?.length) {
    summary.sessions = emptySummary();

    // Eltern-Sitzungen zuerst
    const sorted = [...data.sessions].sort((a, b) => {
      if (!a.originalParentSessionId && b.originalParentSessionId) return -1;
      if (a.originalParentSessionId && !b.originalParentSessionId) return 1;
      return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
    });

    // Sicherstellen dass alle User gemappt sind (auch wenn kein User-Import)
    const allOrgUsers = await prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true } });
    const orgUserIds = new Set(allOrgUsers.map((u) => u.id));

    for (const s of sorted) {
      try {
        await importSession(s, orgId, orgUserIds, deviceIdMap, customerIdMap, projectIdMap, userIdMap, sessionIdMap, summary);
      } catch (err) {
        summary.errors.push(`Sitzung ${s.originalId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── 8. Addons ──────────────────────────────────────────────────────────────
  if (data.addons?.length) {
    summary.addons = emptySummary();
    for (const a of data.addons) {
      try {
        const existing = await prisma.addon.findFirst({ where: { organizationId: orgId, key: a.key } });
        if (existing) {
          await prisma.addon.update({ where: { id: existing.id }, data: { enabled: a.enabled, config: a.config as object } });
          summary.addons.updated++;
        } else {
          await prisma.addon.create({ data: { organizationId: orgId, key: a.key, enabled: a.enabled, config: a.config as object } });
          summary.addons.created++;
        }
      } catch (err) {
        summary.errors.push(`Addon "${a.key}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return NextResponse.json(summary);
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

async function importCustomer(
  c: ExportCustomer,
  orgId: string,
  customerIdMap: Map<string, string>,
  contactIdMap: Map<string, string>,
  summary: ImportSummary
) {
  const existing = await prisma.customer.findFirst({
    where: { organizationId: orgId, name: { equals: c.name, mode: "insensitive" } },
    select: { id: true },
  });

  let customerId: string;
  if (existing) {
    await prisma.customer.update({
      where: { id: existing.id },
      data: { notes: c.notes, email: c.email, phone: c.phone, website: c.website, customerNumber: c.customerNumber, street: c.street, zip: c.zip, city: c.city, country: c.country, zammadOrgId: c.zammadOrgId, invoiceNinjaId: c.invoiceNinjaId },
    });
    customerId = existing.id;
    summary.customers!.updated++;
  } else {
    const created = await prisma.customer.create({
      data: { name: c.name, organizationId: orgId, notes: c.notes, email: c.email, phone: c.phone, website: c.website, customerNumber: c.customerNumber, street: c.street, zip: c.zip, city: c.city, country: c.country, zammadOrgId: c.zammadOrgId, invoiceNinjaId: c.invoiceNinjaId },
      select: { id: true },
    });
    customerId = created.id;
    summary.customers!.created++;
  }
  customerIdMap.set(c.originalId, customerId);

  for (const ct of c.contacts) {
    await importContact(ct, customerId, contactIdMap, summary);
  }
}

async function importContact(
  ct: ExportContact,
  customerId: string,
  contactIdMap: Map<string, string>,
  summary: ImportSummary
) {
  const existing = await prisma.contact.findFirst({
    where: {
      customerId,
      OR: [
        ...(ct.email ? [{ email: { equals: ct.email, mode: "insensitive" as const } }] : []),
        { firstName: { equals: ct.firstName, mode: "insensitive" }, lastName: { equals: ct.lastName, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.contact.update({
      where: { id: existing.id },
      data: { firstName: ct.firstName, lastName: ct.lastName, email: ct.email, phone: ct.phone, mobile: ct.mobile, emails: ct.emails, phones: ct.phones, notes: ct.notes, zammadUserId: ct.zammadUserId, invoiceNinjaId: ct.invoiceNinjaId },
    });
    contactIdMap.set(ct.originalId, existing.id);
    summary.contacts!.updated++;
  } else {
    const created = await prisma.contact.create({
      data: { customerId, firstName: ct.firstName, lastName: ct.lastName, email: ct.email, phone: ct.phone, mobile: ct.mobile, emails: ct.emails, phones: ct.phones, notes: ct.notes, zammadUserId: ct.zammadUserId, invoiceNinjaId: ct.invoiceNinjaId },
      select: { id: true },
    });
    contactIdMap.set(ct.originalId, created.id);
    summary.contacts!.created++;
  }
}

async function importDevice(
  d: ExportDevice,
  orgId: string,
  groupIdMap: Map<string, string>,
  customerIdMap: Map<string, string>,
  deviceIdMap: Map<string, string>,
  summary: ImportSummary
) {
  const groupId = d.originalGroupId ? (groupIdMap.get(d.originalGroupId) ?? null) : null;
  const customerId = d.originalCustomerId ? (customerIdMap.get(d.originalCustomerId) ?? null) : null;

  const existing = await prisma.device.findFirst({
    where: { organizationId: orgId, name: d.name },
    select: { id: true },
  });

  let deviceId: string;
  if (existing) {
    await prisma.device.update({
      where: { id: existing.id },
      data: { groupId, customerId, macAddress: d.macAddress, ipAddress: d.ipAddress, notes: d.notes, tags: d.tags },
    });
    await prisma.remoteId.deleteMany({ where: { deviceId: existing.id } });
    deviceId = existing.id;
    summary.devices!.updated++;
  } else {
    const created = await prisma.device.create({
      data: { name: d.name, organizationId: orgId, groupId, customerId, macAddress: d.macAddress, ipAddress: d.ipAddress, notes: d.notes, tags: d.tags },
      select: { id: true },
    });
    deviceId = created.id;
    summary.devices!.created++;
  }
  deviceIdMap.set(d.originalId, deviceId);

  if (d.remoteIds.length > 0) {
    await prisma.remoteId.createMany({
      data: d.remoteIds.map((r) => ({ deviceId, type: r.type, remoteId: r.remoteId, label: r.label, password: r.password, sshUser: r.sshUser, sshPasswordEnc: r.sshPasswordEnc })),
    });
  }
}

async function importSession(
  s: ExportSession,
  orgId: string,
  orgUserIds: Set<string>,
  deviceIdMap: Map<string, string>,
  customerIdMap: Map<string, string>,
  projectIdMap: Map<string, string>,
  userIdMap: Map<string, string>,
  sessionIdMap: Map<string, string>,
  summary: ImportSummary
) {
  // userId auflösen: erst über Map, dann direkten ID-Check (gleiche Instanz)
  let userId = userIdMap.get(s.originalUserId) ?? (orgUserIds.has(s.originalUserId) ? s.originalUserId : null);
  if (!userId) {
    // Fallback: ersten Admin der Org nehmen
    const admin = await prisma.user.findFirst({ where: { organizationId: orgId, role: "admin" }, select: { id: true } });
    userId = admin?.id ?? null;
  }
  if (!userId) {
    summary.sessions!.skipped++;
    return;
  }

  const deviceId = s.originalDeviceId ? (deviceIdMap.get(s.originalDeviceId) ?? null) : null;
  const customerId = s.originalCustomerId ? (customerIdMap.get(s.originalCustomerId) ?? null) : null;
  const projectId = s.originalProjectId ? (projectIdMap.get(s.originalProjectId) ?? null) : null;
  const parentSessionId = s.originalParentSessionId ? (sessionIdMap.get(s.originalParentSessionId) ?? null) : null;
  const startedAt = new Date(s.startedAt);

  // Duplikat-Check: gleiche startedAt + userId
  const existing = await prisma.session.findFirst({
    where: { userId, startedAt },
    select: { id: true },
  });

  let sessionId: string;
  if (existing) {
    await prisma.session.update({
      where: { id: existing.id },
      data: { deviceId, customerId, projectId, endedAt: s.endedAt ? new Date(s.endedAt) : null, durationMinutes: s.durationMinutes, type: s.type, tags: s.tags, billed: s.billed, billedAt: s.billedAt ? new Date(s.billedAt) : null, parentSessionId },
    });
    sessionId = existing.id;
    summary.sessions!.updated++;
  } else {
    const created = await prisma.session.create({
      data: { userId, deviceId, customerId, projectId, startedAt, endedAt: s.endedAt ? new Date(s.endedAt) : null, durationMinutes: s.durationMinutes, type: s.type, tags: s.tags, billed: s.billed, billedAt: s.billedAt ? new Date(s.billedAt) : null, parentSessionId },
      select: { id: true },
    });
    sessionId = created.id;
    summary.sessions!.created++;
  }
  sessionIdMap.set(s.originalId, sessionId);

  if (s.notes.length > 0) {
    await prisma.sessionNote.deleteMany({ where: { sessionId } });
    await prisma.sessionNote.createMany({
      data: s.notes.map((n) => ({ sessionId, content: n.content, createdAt: new Date(n.createdAt) })),
    });
  }
  if (s.intervals.length > 0) {
    await prisma.sessionInterval.deleteMany({ where: { sessionId } });
    await prisma.sessionInterval.createMany({
      data: s.intervals.map((i) => ({ sessionId, startedAt: new Date(i.startedAt), endedAt: i.endedAt ? new Date(i.endedAt) : null })),
    });
  }
}
