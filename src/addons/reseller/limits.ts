import { prisma } from "@/lib/prisma";

export type LimitResource = "customers" | "projects" | "devices" | "users";

export interface LimitResult {
  allowed: boolean;
  current: number;
  limit: number | null;
}

/**
 * Checks whether the organization has room to create another resource.
 * Returns { allowed: true } immediately if RESELLER_MODE is not set.
 */
export async function checkLimit(
  orgId: string,
  resource: LimitResource
): Promise<LimitResult> {
  if (!process.env.RESELLER_MODE) {
    return { allowed: true, current: 0, limit: null };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    include: { plan: true },
  });

  // No subscription → treat as free (most restrictive limits)
  const plan = subscription?.plan;

  // Determine the relevant limit
  const limitMap: Record<LimitResource, number | null | undefined> = {
    customers: plan?.maxCustomers,
    projects:  plan?.maxProjects,
    devices:   plan?.maxDevices,
    users:     plan?.maxUsers,
  };
  const limit = limitMap[resource] ?? null;

  // Null means unlimited
  if (limit === null || limit === undefined) {
    return { allowed: true, current: 0, limit: null };
  }

  // Also allow if subscription is still in trial
  const isTrialing =
    subscription?.status === "trialing" &&
    subscription.trialEndsAt != null &&
    subscription.trialEndsAt > new Date();

  // Count current usage
  let current = 0;
  switch (resource) {
    case "customers":
      current = await prisma.customer.count({ where: { organizationId: orgId } });
      break;
    case "projects":
      current = await prisma.project.count({ where: { organizationId: orgId } });
      break;
    case "devices":
      current = await prisma.device.count({ where: { organizationId: orgId } });
      break;
    case "users":
      current = await prisma.user.count({ where: { organizationId: orgId, active: true } });
      break;
  }

  const allowed = isTrialing || current < limit;
  return { allowed, current, limit };
}
