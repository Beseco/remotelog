import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  ExportCategory,
  RemoteLogExport,
  ExportCustomer,
  ExportGroup,
  ExportDevice,
  ExportProject,
  ExportSession,
  ExportAddon,
  ExportUser,
  ExportSettings,
} from "@/lib/export-types";
import { EXPORT_VERSION } from "@/lib/export-types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgId = session.user.organizationId;
  const { searchParams } = new URL(req.url);
  const includeParam = searchParams.get("include") ?? "settings,customers,groups,devices,projects,sessions,addons,users";
  const includes = includeParam.split(",").map((s) => s.trim()) as ExportCategory[];

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

  const result: RemoteLogExport = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    organizationName: org.name,
    includes,
  };

  if (includes.includes("settings")) {
    result.settings = {
      hourlyRate: org.hourlyRate,
      roundUpMins: org.roundUpMins,
      prepMins: org.prepMins,
      followUpMins: org.followUpMins,
      minMins: org.minMins,
      rustdeskIdServer: org.rustdeskIdServer,
      rustdeskRelay: org.rustdeskRelay,
      rustdeskKey: org.rustdeskKey,
      smtpHost: org.smtpHost,
      smtpPort: org.smtpPort,
      smtpSecure: org.smtpSecure,
      smtpUser: org.smtpUser,
      smtpPass: org.smtpPass,
      smtpFrom: org.smtpFrom,
    } satisfies ExportSettings;
  }

  if (includes.includes("customers")) {
    const customers = await prisma.customer.findMany({
      where: { organizationId: orgId },
      include: { contacts: true },
      orderBy: { name: "asc" },
    });
    result.customers = customers.map((c): ExportCustomer => ({
      originalId: c.id,
      name: c.name,
      notes: c.notes,
      email: c.email,
      phone: c.phone,
      website: c.website,
      customerNumber: c.customerNumber,
      street: c.street,
      zip: c.zip,
      city: c.city,
      country: c.country,
      zammadOrgId: c.zammadOrgId,
      invoiceNinjaId: c.invoiceNinjaId,
      contacts: c.contacts.map((ct) => ({
        originalId: ct.id,
        firstName: ct.firstName,
        lastName: ct.lastName,
        email: ct.email,
        phone: ct.phone,
        mobile: ct.mobile,
        emails: ct.emails,
        phones: ct.phones,
        notes: ct.notes,
        zammadUserId: ct.zammadUserId,
        invoiceNinjaId: ct.invoiceNinjaId,
      })),
    }));
  }

  if (includes.includes("groups")) {
    const groups = await prisma.group.findMany({
      where: { organizationId: orgId },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    });
    result.groups = groups.map((g): ExportGroup => ({
      originalId: g.id,
      name: g.name,
      originalParentId: g.parentId,
      originalCustomerId: g.customerId,
      sortOrder: g.sortOrder,
    }));
  }

  if (includes.includes("devices")) {
    const devices = await prisma.device.findMany({
      where: { organizationId: orgId },
      include: { remoteIds: true },
      orderBy: { name: "asc" },
    });
    result.devices = devices.map((d): ExportDevice => ({
      originalId: d.id,
      name: d.name,
      originalGroupId: d.groupId,
      originalCustomerId: d.customerId,
      macAddress: d.macAddress,
      ipAddress: d.ipAddress,
      notes: d.notes,
      tags: d.tags,
      remoteIds: d.remoteIds.map((r) => ({
        type: r.type,
        remoteId: r.remoteId,
        label: r.label,
        password: r.password,
        sshUser: r.sshUser,
        sshPasswordEnc: r.sshPasswordEnc,
      })),
    }));
  }

  if (includes.includes("projects")) {
    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    });
    result.projects = projects.map((p): ExportProject => ({
      originalId: p.id,
      name: p.name,
      status: p.status,
      originalCustomerId: p.customerId,
      taskRate: p.taskRate,
      dueDate: p.dueDate?.toISOString() ?? null,
      notes: p.notes,
      budgetedHours: p.budgetedHours,
      invoiceNinjaProjectId: p.invoiceNinjaProjectId,
    }));
  }

  if (includes.includes("sessions")) {
    const sessions = await prisma.session.findMany({
      where: { userId: { in: (await prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((u) => u.id) } },
      include: { notes: true, intervals: true },
      orderBy: { startedAt: "asc" },
      take: 50000,
    });
    result.sessions = sessions.map((s): ExportSession => ({
      originalId: s.id,
      originalDeviceId: s.deviceId,
      originalCustomerId: s.customerId,
      originalProjectId: s.projectId,
      originalUserId: s.userId,
      originalParentSessionId: s.parentSessionId,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      durationMinutes: s.durationMinutes,
      type: s.type,
      tags: s.tags,
      billed: s.billed,
      billedAt: s.billedAt?.toISOString() ?? null,
      notes: s.notes.map((n) => ({ content: n.content, createdAt: n.createdAt.toISOString() })),
      intervals: s.intervals.map((i) => ({ startedAt: i.startedAt.toISOString(), endedAt: i.endedAt?.toISOString() ?? null })),
    }));
  }

  if (includes.includes("addons")) {
    const addons = await prisma.addon.findMany({ where: { organizationId: orgId } });
    result.addons = addons.map((a): ExportAddon => ({
      key: a.key,
      enabled: a.enabled,
      config: a.config as Record<string, unknown>,
    }));
  }

  if (includes.includes("users")) {
    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    });
    result.users = users.map((u): ExportUser => ({
      originalId: u.id,
      name: u.name,
      email: u.email,
      passwordHash: u.passwordHash,
      role: u.role,
      active: u.active,
    }));
  }

  const date = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify(result, null, 2);

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="remotelog-export-${date}.json"`,
    },
  });
}
