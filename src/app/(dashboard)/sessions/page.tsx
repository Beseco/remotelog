import { requireAuth, canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { SessionList } from "@/components/sessions/session-list";

export default async function SessionsPage() {
  const session = await requireAuth();

  const [org, sessions] = await Promise.all([
    prisma.organization.findUnique({
      where:  { id: session.user.organizationId },
      select: { minMins: true },
    }),
    prisma.session.findMany({
      where: {
        user: { organizationId: session.user.organizationId },
        parentSessionId: null,
      },
      include: {
        device:   { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        contact:  { select: { id: true, firstName: true, lastName: true } },
        project:  { select: { id: true, name: true } },
        user:     { select: { id: true, name: true } },
        children: {
          select: {
            id:              true,
            startedAt:       true,
            endedAt:         true,
            durationMinutes: true,
            type:            true,
            billed:          true,
            billedAt:        true,
            project:         { select: { id: true, name: true } },
          },
          orderBy: { startedAt: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
  ]);

  const serialized = sessions.map((s) => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
    endedAt:   s.endedAt?.toISOString() ?? null,
    billedAt:  s.billedAt?.toISOString() ?? null,
    children:  s.children.map((c) => ({
      ...c,
      startedAt: c.startedAt.toISOString(),
      endedAt:   c.endedAt?.toISOString() ?? null,
      billedAt:  c.billedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sitzungen</h1>
        <p className="text-muted-foreground">
          Aktive und vergangene Sitzungen deiner Organisation.
        </p>
      </div>
      <SessionList sessions={serialized} canEdit={canEdit(session.user.role)} minMins={org?.minMins ?? 0} />
    </div>
  );
}
