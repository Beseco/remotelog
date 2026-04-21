import { requireAuth } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OrgForm } from "@/components/settings/org-form";
import { BillingForm } from "@/components/settings/billing-form";
import { UserManagement } from "@/components/settings/user-management";
import { AddonsSection } from "@/components/settings/addons-section";
import { ResellerAdminSection } from "@/components/settings/reseller-admin-section";
import { ExportImportSection } from "@/components/settings/export-import";
import { AppUrlForm } from "@/components/settings/app-url-form";
import { Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminSettingsPage() {
  const session = await requireAuth();
  if (session.user.role !== "admin") redirect("/settings");

  const [org, users, addonRecords] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true, name: true,
        hourlyRate: true, roundUpMins: true, prepMins: true, followUpMins: true, minMins: true,
        appUrl: true,
      },
    }),
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.addon.findMany({
      where: { organizationId: session.user.organizationId },
      select: { key: true, enabled: true, config: true },
    }),
  ]);

  const serializedUsers = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    lastLogin: u.lastLogin?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Admin-Einstellungen</h1>
        <p className="text-muted-foreground">Organisation, Abrechnung und Benutzerverwaltung.</p>
      </div>

      {org && <OrgForm initialName={org.name} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            App-URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AppUrlForm
            initial={org?.appUrl ?? null}
            envFallback={process.env.NEXTAUTH_URL ?? ""}
          />
        </CardContent>
      </Card>

      {org && (
        <BillingForm
          initialSettings={{
            hourlyRate:   org.hourlyRate,
            roundUpMins:  org.roundUpMins,
            prepMins:     org.prepMins,
            followUpMins: org.followUpMins,
            minMins:      org.minMins,
          }}
        />
      )}

      <UserManagement
        initialUsers={serializedUsers}
        currentUserId={session.user.id}
      />

      <AddonsSection
        initialAddons={addonRecords.map((a) => ({
          key: a.key,
          enabled: a.enabled,
          config: a.config as Record<string, unknown>,
        }))}
      />

      {process.env.RESELLER_MODE && <ResellerAdminSection />}

      <div>
        <h2 className="text-lg font-semibold mb-1">Export & Import</h2>
        <p className="text-sm text-muted-foreground mb-4">Daten sichern oder in eine andere RemoteLog-Instanz übertragen.</p>
        <ExportImportSection />
      </div>
    </div>
  );
}
