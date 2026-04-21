import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PasswordForm } from "@/components/settings/password-form";
import { ApiKeyManagement } from "@/components/settings/api-key-management";
import { ReminderForm } from "@/components/settings/reminder-form";
import { InstallerLink } from "@/components/settings/installer-link";
import { RustdeskServerForm } from "@/components/settings/rustdesk-server-form";
import { User, Download, Server } from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  techniker: "Techniker",
  readonly: "Nur lesen",
};

export default async function SettingsPage() {
  const session = await requireAuth();

  const [org, apiKeys, userPrefs] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true, rustdeskIdServer: true, rustdeskRelay: true, rustdeskKey: true, rustdeskApiPasswordEnc: true },
    }),
    prisma.apiKey.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        type: true,
        active: true,
        expiresAt: true,
        lastUsedAt: true,
        ipWhitelist: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        notifIntervalMins:   true,
        notifSoundEnabled:   true,
        notifDesktopEnabled: true,
        notifBadgeEnabled:   true,
      },
    }),
  ]);

  const serializedKeys = apiKeys.map((k) => ({
    ...k,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">Profil, Passwort und persönliche Einstellungen.</p>
      </div>

      {/* Profil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Mein Profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-20">Name</span>
            <span className="font-medium">{session.user.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-20">E-Mail</span>
            <span>{session.user.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-20">Rolle</span>
            <Badge variant="secondary" className="text-xs">
              {roleLabels[session.user.role] ?? session.user.role}
            </Badge>
          </div>
          {org && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20">Organisation</span>
              <span>{org.name}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passwort */}
      <PasswordForm />

      {/* Erinnerungen */}
      {userPrefs && (
        <ReminderForm initialPrefs={userPrefs} />
      )}

      {/* Installer-Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            Fernwartung installieren
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InstallerLink />
        </CardContent>
      </Card>

      {/* RustDesk Server (nur Admin) */}
      {session.user.role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              RustDesk Server
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RustdeskServerForm initial={{
              rustdeskIdServer: org?.rustdeskIdServer ?? null,
              rustdeskRelay: org?.rustdeskRelay ?? null,
              rustdeskKey: org?.rustdeskKey ?? null,
              hasApiPassword: !!org?.rustdeskApiPasswordEnc,
            }} />
          </CardContent>
        </Card>
      )}

      {/* API-Keys */}
      <ApiKeyManagement initialKeys={serializedKeys} />
    </div>
  );
}
