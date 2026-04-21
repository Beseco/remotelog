import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ReportView } from "@/components/reports/report-view";

export default async function ReportsPage() {
  const session = await requireAuth();
  const orgId = session.user.organizationId;

  const [devices, groups, users, customers, org] = await Promise.all([
    prisma.device.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.group.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, hourlyRate: true, roundUpMins: true, prepMins: true, followUpMins: true, minMins: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Berichte</h1>
        <p className="text-muted-foreground">
          Tätigkeitsnachweise auswerten, exportieren und abrechnen.
        </p>
      </div>
      <ReportView
        devices={devices}
        groups={groups}
        users={users}
        customers={customers}
        currentUserName={session.user.name ?? ""}
        orgName={org?.name ?? ""}
        isAdmin={session.user.role === "admin"}
        billingEnabled={(org?.hourlyRate ?? 0) > 0}
      />
    </div>
  );
}
