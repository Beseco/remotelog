import { requireAuth, canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { DeviceManager } from "@/components/devices/device-manager";

export default async function DevicesPage() {
  const session = await requireAuth();
  const orgId = session.user.organizationId;

  const [devices, groups, customers, contacts] = await Promise.all([
    prisma.device.findMany({
      where: { organizationId: orgId },
      include: {
        remoteIds: true,
        group: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        sessions: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { id: true, startedAt: true, endedAt: true, type: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.group.findMany({
      where: { organizationId: orgId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.contact.findMany({
      where: { customer: { organizationId: orgId } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, customerId: true },
    }),
  ]);

  // Serialize dates for Client Component
  const serializedDevices = devices.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    sessions: d.sessions.map((s) => ({
      ...s,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Geräte</h1>
        <p className="text-muted-foreground">
          {devices.length} {devices.length === 1 ? "Gerät" : "Geräte"} in deiner Organisation.
        </p>
      </div>
      <DeviceManager
        initialDevices={serializedDevices}
        groups={groups}
        customers={customers}
        contacts={contacts}
        canEdit={canEdit(session.user.role)}
      />
    </div>
  );
}
