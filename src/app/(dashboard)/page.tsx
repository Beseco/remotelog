import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock, Activity, Building2, FolderOpen,
  ArrowRight, Euro, AlertCircle, Zap, Download,
} from "lucide-react";
import { InstallerLink } from "@/components/settings/installer-link";

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function fmtElapsed(startedAt: Date): string {
  const mins = Math.floor((Date.now() - startedAt.getTime()) / 60000);
  return fmtMinutes(mins);
}

function getGreeting(name: string) {
  const h = new Date().getHours();
  if (h < 12) return `Guten Morgen, ${name}`;
  if (h < 18) return `Guten Tag, ${name}`;
  return `Guten Abend, ${name}`;
}

const typeLabels: Record<string, string> = {
  remote: "Remote", onsite: "Vor-Ort", phone: "Telefon",
};
const typeColors: Record<string, string> = {
  remote: "bg-blue-500/10 text-blue-600",
  onsite: "bg-orange-500/10 text-orange-600",
  phone: "bg-purple-500/10 text-purple-600",
};

export default async function DashboardPage() {
  const session = await requireAuth();
  const orgId = session.user.organizationId;
  const userId = session.user.id;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);

  const [
    activeSession,
    todaySessions,
    weekSessions,
    unbilledSessions,
    recentSessions,
    customerCount,
    activeProjects,
    topUnbilledCustomers,
    org,
  ] = await Promise.all([
    // Active session for this user
    prisma.session.findFirst({
      where: { userId, endedAt: null, parentSessionId: null },
      include: {
        device: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    // Today's completed sessions
    prisma.session.findMany({
      where: {
        user: { organizationId: orgId },
        startedAt: { gte: todayStart },
        endedAt: { not: null },
        parentSessionId: null,
      },
      select: { durationMinutes: true, children: { select: { durationMinutes: true } } },
    }),
    // This week's completed sessions
    prisma.session.findMany({
      where: {
        user: { organizationId: orgId },
        startedAt: { gte: weekStart },
        endedAt: { not: null },
        parentSessionId: null,
      },
      select: { durationMinutes: true, children: { select: { durationMinutes: true } } },
    }),
    // Unbilled sessions count
    prisma.session.count({
      where: {
        user: { organizationId: orgId },
        endedAt: { not: null },
        billed: false,
        parentSessionId: null,
      },
    }),
    // Recent 8 sessions
    prisma.session.findMany({
      where: { user: { organizationId: orgId }, parentSessionId: null },
      include: {
        device: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        children: { select: { durationMinutes: true, endedAt: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
    // Customer count
    prisma.customer.count({ where: { organizationId: orgId } }),
    // Active projects count
    prisma.project.count({ where: { organizationId: orgId, status: "active" } }),
    // Top 5 customers with most unbilled time
    prisma.session.groupBy({
      by: ["customerId"],
      where: {
        user: { organizationId: orgId },
        endedAt: { not: null },
        billed: false,
        parentSessionId: null,
        customerId: { not: null },
      },
      _sum: { durationMinutes: true },
      _count: { id: true },
      orderBy: { _sum: { durationMinutes: "desc" } },
      take: 5,
    }),
    // Org billing settings
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { hourlyRate: true },
    }),
  ]);

  // Resolve customer names for unbilled summary
  const unbilledCustomerIds = topUnbilledCustomers
    .map((g) => g.customerId)
    .filter(Boolean) as string[];
  const unbilledCustomerNames = unbilledCustomerIds.length > 0
    ? await prisma.customer.findMany({
        where: { id: { in: unbilledCustomerIds } },
        select: { id: true, name: true },
      })
    : [];
  const customerNameMap = new Map(unbilledCustomerNames.map((c) => [c.id, c.name]));

  // Calculate totals
  function sumMins(sessions: { durationMinutes: number | null; children: { durationMinutes: number | null }[] }[]) {
    return sessions.reduce((sum, s) => {
      const childMins = s.children.reduce((c, ch) => c + (ch.durationMinutes ?? 0), 0);
      return sum + (s.durationMinutes ?? 0) + childMins;
    }, 0);
  }

  const todayMins = sumMins(todaySessions);
  const weekMins = sumMins(weekSessions);
  const hourlyRate = org?.hourlyRate ?? 0;

  const unbilledMins = topUnbilledCustomers.reduce(
    (sum, g) => sum + (g._sum.durationMinutes ?? 0), 0
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{getGreeting(session.user.name ?? "")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Active Session Banner */}
      {activeSession && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
              <div>
                <p className="font-semibold text-sm">Sitzung läuft</p>
                <p className="text-xs text-muted-foreground">
                  {activeSession.customer?.name ?? activeSession.device?.name ?? "Unbekannt"}
                  {activeSession.project && (
                    <span className="ml-1 text-muted-foreground/70">· {activeSession.project.name}</span>
                  )}
                  {" · "}seit {fmtElapsed(activeSession.startedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={typeColors[activeSession.type] ?? ""} variant="outline">
                {typeLabels[activeSession.type] ?? activeSession.type}
              </Badge>
              <Button size="sm" variant="outline" render={<Link href="/sessions" />}>
                <Zap className="h-3.5 w-3.5 mr-1" />
                Verwalten
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Heute</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{fmtMinutes(todayMins)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {todaySessions.length} Sitzung{todaySessions.length !== 1 ? "en" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Diese Woche</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{fmtMinutes(weekMins)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {weekSessions.length} Sitzung{weekSessions.length !== 1 ? "en" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nicht abgerechnet</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{unbilledSessions}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmtMinutes(unbilledMins)}
              {hourlyRate > 0 && unbilledMins > 0 && (
                <span className="ml-1">
                  · ~{((unbilledMins / 60) * hourlyRate).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktive Projekte</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{activeProjects}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customerCount} Kund{customerCount !== 1 ? "en" : "e"} gesamt
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Sessions */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Letzte Sitzungen</h2>
            <Button size="sm" variant="ghost" className="text-xs h-7" render={<Link href="/sessions" />}>
              Alle anzeigen <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {recentSessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <Clock className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Noch keine Sitzungen aufgezeichnet.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {recentSessions.map((s) => {
                    const childMins = s.children.reduce((c, ch) => c + (ch.durationMinutes ?? 0), 0);
                    const totalMins = (s.durationMinutes ?? 0) + childMins;
                    const isActive = !s.endedAt;
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {s.customer?.name ?? s.device?.name ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.startedAt.toLocaleDateString("de-DE")}
                            {" · "}{s.user.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${typeColors[s.type] ?? "bg-muted text-muted-foreground"}`}>
                            {typeLabels[s.type] ?? s.type}
                          </span>
                          <span className="text-xs text-muted-foreground w-16 text-right">
                            {isActive ? (
                              <span className="text-green-600 font-medium">Aktiv</span>
                            ) : totalMins > 0 ? (
                              fmtMinutes(totalMins)
                            ) : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Unbilled by customer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Nicht abgerechnet</h2>
            <Button size="sm" variant="ghost" className="text-xs h-7" render={<Link href="/reports" />}>
              Berichte <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {topUnbilledCustomers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <Euro className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Alles abgerechnet.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {topUnbilledCustomers.map((g) => {
                    const name = customerNameMap.get(g.customerId ?? "") ?? "Unbekannt";
                    const mins = g._sum.durationMinutes ?? 0;
                    const count = g._count.id;
                    return (
                      <Link
                        key={g.customerId}
                        href={`/customers/${g.customerId}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground">
                            {count} Sitzung{count !== 1 ? "en" : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{fmtMinutes(mins)}</p>
                          {hourlyRate > 0 && (
                            <p className="text-xs text-muted-foreground">
                              ~{((mins / 60) * hourlyRate).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Installer widget */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                Fernwartung einrichten
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InstallerLink dashboard />
            </CardContent>
          </Card>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" size="sm" className="text-xs" render={<Link href="/customers" />}>
              <Building2 className="h-3.5 w-3.5 mr-1" />
              Kunden
            </Button>
            <Button variant="outline" size="sm" className="text-xs" render={<Link href="/projects" />}>
              <FolderOpen className="h-3.5 w-3.5 mr-1" />
              Projekte
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
