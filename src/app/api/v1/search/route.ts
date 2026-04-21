import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ customers: [], contacts: [] });

  const orgId = user.organizationId;

  const [customers, contacts, projects] = await Promise.all([
    prisma.customer.findMany({
      where: {
        organizationId: orgId,
        name: { contains: q, mode: "insensitive" },
      },
      include: {
        contacts: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
        devices: {
          include: {
            remoteIds: true,
            contact: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.contact.findMany({
      where: {
        customer: { organizationId: orgId },
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { emails: { has: q } },
          { emails: { has: q.toLowerCase() } },
          { phone: { contains: q, mode: "insensitive" } },
          { mobile: { contains: q, mode: "insensitive" } },
          { phones: { has: q } },
        ],
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        devices: {
          include: { remoteIds: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.project.findMany({
      where: {
        organizationId: orgId,
        name: { contains: q, mode: "insensitive" },
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // For contacts, also include the full customer device list (devices assigned to the customer)
  const customerIds = [...new Set(contacts.map(c => c.customer.id))];
  const contactCustomerDevices: Record<string, { id: string; name: string; remoteIds: { id: string; type: string; remoteId: string; label: string | null }[]; ipAddress: string | null; contact: { id: string; firstName: string; lastName: string } | null }[]> = {};
  if (customerIds.length > 0) {
    const devs = await prisma.device.findMany({
      where: { customerId: { in: customerIds } },
      include: {
        remoteIds: true,
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { name: "asc" },
    });
    for (const d of devs) {
      if (!d.customerId) continue;
      if (!contactCustomerDevices[d.customerId]) contactCustomerDevices[d.customerId] = [];
      contactCustomerDevices[d.customerId].push(d);
    }
  }

  // Deduplicate contacts by id (same contact can match multiple OR conditions)
  const seenContactIds = new Set<string>();
  const uniqueContacts = contacts.filter(c => {
    if (seenContactIds.has(c.id)) return false;
    seenContactIds.add(c.id);
    return true;
  });

  return NextResponse.json({
    customers,
    projects,
    contacts: uniqueContacts.map(c => ({
      ...c,
      customerDevices: contactCustomerDevices[c.customer.id] ?? [],
    })),
  });
}
