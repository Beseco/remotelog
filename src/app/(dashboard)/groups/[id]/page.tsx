import { requireAuth, canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { DeviceManager } from "@/components/devices/device-manager";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const { id } = await params;
  const orgId = session.user.organizationId;

  const [group, devices, groups, customers, contacts] = await Promise.all([
    prisma.group.findFirst({
      where: { id, organizationId: orgId },
    }),
    prisma.device.findMany({
      where: { groupId: id, organizationId: orgId },
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
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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

  if (!group) notFound();

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
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="text-muted-foreground">
          {devices.length} {devices.length === 1 ? "Gerät" : "Geräte"} in dieser Gruppe.
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
