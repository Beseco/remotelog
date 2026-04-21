import { prisma } from "@/lib/prisma";

export type SetupState = {
  organizationId: string;
  hasAdmin: boolean;
  setupCompleted: boolean;
};

export async function ensurePrimaryOrganization() {
  const existing = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.organization.create({
    data: { name: "Meine IT-Firma" },
    select: { id: true },
  });
  return created.id;
}

export async function getSetupState(): Promise<SetupState> {
  const organizationId = await ensurePrimaryOrganization();
  const [adminCount, org] = await Promise.all([
    prisma.user.count({
      where: { organizationId, role: "admin", active: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { setupCompletedAt: true },
    }),
  ]);

  return {
    organizationId,
    hasAdmin: adminCount > 0,
    setupCompleted: !!org?.setupCompletedAt,
  };
}

export async function setupIsOpen() {
  const state = await getSetupState();
  return !state.setupCompleted || !state.hasAdmin;
}
