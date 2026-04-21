import { requireAuth, canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ContactManager } from "@/components/customers/contact-manager";
import { CustomerDeviceList } from "@/components/customers/customer-detail-actions";
import {
  ChevronLeft, Clock, Activity, Mail, Phone, Globe, MapPin, Hash, ExternalLink,
} from "lucide-react";
import { ZammadTicketsCard } from "@/components/customers/zammad-tickets-card";
import { InvoiceNinjaInvoicesCard } from "@/components/customers/invoiceninja-invoices-card";
import { SessionTransferButton } from "@/components/customers/session-transfer-button";
import { ProjectManager } from "@/components/customers/project-manager";
import { CustomerInstallerButton } from "@/components/customers/installer-button";

type Params = { params: Promise<{ id: string }> };

const typeLabels: Record<string, string> = {
  remote: "Remote", onsite: "Vor-Ort", phone: "Telefon",
};

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export default async function CustomerDetailPage({ params }: Params) {
  const session = await requireAuth();
  const { id } = await params;
  const orgId = session.user.organizationId;

  const [customer, orgDevices, recentSessions, projects] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, organizationId: orgId },
      include: {
        contacts: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
        devices: {
          include: {
            remoteIds: true,
            group: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true } },
            sessions: {
              orderBy: { startedAt: "desc" },
              take: 1,
              select: { id: true, startedAt: true, endedAt: true, type: true },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.device.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        customerId: true,
        group: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.session.findMany({
      where: {
        device: { customerId: id, organizationId: orgId },
        parentSessionId: null,
      },
      include: {
        device: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        children: { select: { durationMinutes: true, endedAt: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.project.findMany({
      where: { customerId: id, organizationId: orgId },
      include: { _count: { select: { sessions: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!customer) notFound();

  const [zammadAddon, inAddon] = await Promise.all([
    customer.zammadOrgId
      ? prisma.addon.findFirst({
          where: { organizationId: orgId, key: "zammad", enabled: true },
          select: { config: true },
        })
      : null,
    customer.invoiceNinjaId
      ? prisma.addon.findFirst({
          where: { organizationId: orgId, key: "invoiceninja", enabled: true },
          select: { config: true },
        })
      : null,
  ]);
  const zammadUrl = (zammadAddon?.config as { zammadUrl?: string } | null)?.zammadUrl;
  const invoiceNinjaUrl = (inAddon?.config as { invoiceNinjaUrl?: string } | null)?.invoiceNinjaUrl;

  const totalMinutes = recentSessions
    .filter(s => s.endedAt)
    .reduce((sum, s) => {
      const childMins = s.children.reduce((c, ch) => c + (ch.durationMinutes ?? 0), 0);
      return sum + (s.durationMinutes ?? 0) + childMins;
    }, 0);

  const editable = canEdit(session.user.role);

  // Serialize dates for Client Components
  const serializedDevices = customer.devices.map(d => ({
    ...d,
    sessions: d.sessions.map(s => ({
      ...s,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
    })),
  }));

  const serializedSessions = recentSessions.map(({ children: _children, ...s }) => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" render={<Link href="/customers" />}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Alle Kunden
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            {customer.notes && (
              <p className="text-muted-foreground text-sm mt-1">{customer.notes}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0 items-center">
            <CustomerInstallerButton customerId={customer.id} customerName={customer.name} />
            <Badge variant="secondary" className="gap-1">
              <Activity className="h-3 w-3" />
              {recentSessions.filter(s => s.endedAt).length} Sitzungen
            </Badge>
          </div>
        </div>
      </div>

      {/* Customer Info Card */}
      {(customer.customerNumber || customer.email || customer.phone || customer.website || customer.street || customer.city) && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {customer.customerNumber && (
                <span className="flex items-center gap-1.5 text-sm">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {customer.customerNumber}
                </span>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-sm hover:underline">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {customer.email}
                </a>
              )}
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-sm hover:underline">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {customer.phone}
                </a>
              )}
              {customer.website && (
                <a href={customer.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm hover:underline">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {customer.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {zammadUrl && customer.zammadOrgId && (
                <a
                  href={`${zammadUrl.replace(/\/$/, "")}/#organizations/${customer.zammadOrgId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  In Zammad öffnen
                </a>
              )}
              {invoiceNinjaUrl && customer.invoiceNinjaId && (
                <a
                  href={`${invoiceNinjaUrl.replace(/\/$/, "")}/clients/${customer.invoiceNinjaId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  In Invoice Ninja öffnen
                </a>
              )}
              {(customer.street || customer.city) && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {[customer.street, [customer.zip, customer.city].filter(Boolean).join(" "), customer.country]
                    .filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Contacts */}
        <div className="lg:col-span-1">
          <ContactManager
            customerId={customer.id}
            initialContacts={customer.contacts}
            canEdit={editable}
          />
        </div>

        {/* Right column: Devices + Sessions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Device list with actions */}
          <CustomerDeviceList
            devices={serializedDevices}
            contacts={customer.contacts.map(c => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
            orgDevices={orgDevices}
            customerId={customer.id}
            customerName={customer.name}
            canEdit={editable}
            primaryContactEmail={customer.contacts.find(c => c.email)?.email ?? undefined}
          />

          {/* Projekte */}
          <ProjectManager
            customerId={customer.id}
            initialProjects={projects.map(p => ({
              ...p,
              dueDate: p.dueDate?.toISOString() ?? null,
            }))}
          />

          {/* Zammad Tickets */}
          {zammadUrl && customer.zammadOrgId && (
            <ZammadTicketsCard customerId={customer.id} zammadUrl={zammadUrl} />
          )}

          {/* Invoice Ninja Rechnungen */}
          {invoiceNinjaUrl && customer.invoiceNinjaId && (
            <InvoiceNinjaInvoicesCard customerId={customer.id} invoiceNinjaUrl={invoiceNinjaUrl} />
          )}

          {/* Recent Sessions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Letzte Verbindungen ({recentSessions.filter(s => s.endedAt).length})
              </h2>
              {totalMinutes > 0 && (
                <span className="text-xs text-muted-foreground font-medium">
                  Gesamt: {fmtMinutes(totalMinutes)}
                </span>
              )}
            </div>

            {serializedSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                <Clock className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
                Noch keine Verbindungen aufgezeichnet.
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Datum</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Gerät</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Techniker</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Typ</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Dauer</th>
                        {invoiceNinjaUrl && customer.invoiceNinjaId && (
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">IN</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {serializedSessions.map((s, i) => (
                        <tr key={s.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                          <td className="px-4 py-2 whitespace-nowrap text-xs">
                            {new Date(s.startedAt).toLocaleDateString("de-DE")}
                          </td>
                          <td className="px-4 py-2 font-medium text-xs">{s.device?.name ?? "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs hidden sm:table-cell">{s.user.name}</td>
                          <td className="px-4 py-2">
                            <Badge variant={s.endedAt ? "outline" : "default"} className="text-xs">
                              {s.endedAt ? (typeLabels[s.type] ?? s.type) : "Aktiv"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {s.durationMinutes !== null ? fmtMinutes(s.durationMinutes) : "–"}
                          </td>
                          {invoiceNinjaUrl && customer.invoiceNinjaId && s.endedAt && (
                            <td className="px-4 py-2">
                              <SessionTransferButton
                                sessionId={s.id}
                                taskId={s.invoiceNinjaTaskId ?? null}
                                invoiceNinjaUrl={invoiceNinjaUrl}
                              />
                            </td>
                          )}
                          {invoiceNinjaUrl && customer.invoiceNinjaId && !s.endedAt && (
                            <td className="px-4 py-2" />
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
