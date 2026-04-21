import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAuth } from "@/lib/api-auth";

/** Lightweight endpoint for the timer start dialog.
 *  Returns devices (with IP + remote IDs), customers and contacts. */
export async function GET() {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.organizationId;

  const [devices, customers, contacts, projects, org] = await Promise.all([
    prisma.device.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        ipAddress: true,
        customer: { select: { id: true, name: true } },
        remoteIds: { select: { type: true, remoteId: true, label: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.contact.findMany({
      where: { customer: { organizationId: orgId } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.project.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        customer: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where:  { id: orgId },
      select: { minMins: true },
    }),
  ]);

  return NextResponse.json({
    minMins: org?.minMins ?? 0,
    devices: devices.map(d => ({
      id:           d.id,
      name:         d.name,
      ipAddress:    d.ipAddress ?? null,
      customerName: d.customer?.name ?? null,
      remoteIds:    d.remoteIds.map(r => ({
        type:     r.type,
        remoteId: r.remoteId,
        label:    r.label ?? null,
      })),
    })),
    customers,
    contacts: contacts.map(c => ({
      id:           c.id,
      name:         `${c.firstName} ${c.lastName}`,
      customerName: c.customer.name,
    })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      customerName: p.customer.name,
    })),
  });
}
