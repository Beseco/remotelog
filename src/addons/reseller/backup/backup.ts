import { prisma } from "@/lib/prisma";

export interface OrgBackup {
  exportedAt: string;
  organization: {
    id: string;
    name: string;
    createdAt: string;
  };
  subscription?: {
    planName: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  };
  users: unknown[];
  customers: unknown[];
  contacts: unknown[];
  devices: unknown[];
  groups: unknown[];
  projects: unknown[];
  sessions: unknown[];
  addons: unknown[];
}

/**
 * Creates a JSON backup of one or all organizations.
 * If orgId is provided, only that org is exported.
 */
export async function createBackup(orgId?: string): Promise<OrgBackup[]> {
  const orgs = await prisma.organization.findMany({
    where: orgId ? { id: orgId } : undefined,
    include: { subscription: { include: { plan: true } } },
  });

  const backups: OrgBackup[] = [];

  for (const org of orgs) {
    const [users, customers, contacts, devices, groups, projects, sessions, addons] =
      await Promise.all([
        prisma.user.findMany({
          where: { organizationId: org.id },
          select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, lastLogin: true },
        }),
        prisma.customer.findMany({ where: { organizationId: org.id } }),
        prisma.contact.findMany({
          where: { customer: { organizationId: org.id } },
        }),
        prisma.device.findMany({
          where: { organizationId: org.id },
          include: { remoteIds: true },
        }),
        prisma.group.findMany({ where: { organizationId: org.id } }),
        prisma.project.findMany({ where: { organizationId: org.id } }),
        prisma.session.findMany({
          where: { user: { organizationId: org.id } },
          include: { notes: true, intervals: true },
          orderBy: { startedAt: "desc" },
          take: 10_000, // Limit to 10k sessions per org per backup
        }),
        prisma.addon.findMany({ where: { organizationId: org.id } }),
      ]);

    backups.push({
      exportedAt: new Date().toISOString(),
      organization: {
        id: org.id,
        name: org.name,
        createdAt: org.createdAt.toISOString(),
      },
      subscription: org.subscription
        ? {
            planName: org.subscription.plan.name,
            status: org.subscription.status,
            trialEndsAt: org.subscription.trialEndsAt?.toISOString() ?? null,
            currentPeriodEnd: org.subscription.currentPeriodEnd?.toISOString() ?? null,
          }
        : undefined,
      users,
      customers,
      contacts,
      devices,
      groups,
      projects,
      sessions,
      addons,
    });
  }

  return backups;
}
