import { requireAuth, canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { ContactDetail } from "@/components/customers/contact-detail";

type Params = { params: Promise<{ id: string; contactId: string }> };

export default async function ContactDetailPage({ params }: Params) {
  const session = await requireAuth();
  const { id: customerId, contactId } = await params;
  const orgId = session.user.organizationId;

  const [contact, customer] = await Promise.all([
    prisma.contact.findFirst({
      where: {
        id: contactId,
        customerId,
        customer: { organizationId: orgId },
      },
    }),
    prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
      select: { id: true, name: true },
    }),
  ]);

  if (!contact || !customer) notFound();

  // Devices assigned directly to this contact
  const devices = await prisma.device.findMany({
    where: { contactId, organizationId: orgId },
    include: {
      remoteIds: true,
      group: { select: { id: true, name: true } },
      sessions: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, startedAt: true, endedAt: true, type: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // All sessions from those devices (root sessions only)
  const sessions = await prisma.session.findMany({
    where: {
      deviceId: { in: devices.map(d => d.id) },
      parentSessionId: null,
    },
    include: {
      device: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  // Serialize dates
  const serializedDevices = devices.map(d => ({
    ...d,
    sessions: d.sessions.map(s => ({
      ...s,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
    })),
  }));

  const serializedSessions = sessions.map(s => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }));

  const editable = canEdit(session.user.role);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" className="-ml-2" render={<Link href="/customers" />}>
            Kunden
          </Button>
          <span>/</span>
          <Button variant="ghost" size="sm" render={<Link href={`/customers/${customer.id}`} />}>
            {customer.name}
          </Button>
          <span>/</span>
          <span className="px-2 font-medium text-foreground">
            {contact.firstName} {contact.lastName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
            render={<Link href={`/customers/${customer.id}`} />}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {customer.name}
          </Button>
        </div>
      </div>

      <ContactDetail
        contact={contact}
        devices={serializedDevices}
        sessions={serializedSessions}
        canEdit={editable}
      />
    </div>
  );
}
