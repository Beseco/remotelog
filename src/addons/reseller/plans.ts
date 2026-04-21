/**
 * Default plan definitions for RemoteLog Reseller mode.
 * These are seeded into the database via prisma/seed-reseller.ts.
 */
export const DEFAULT_PLANS = [
  {
    name: "Free",
    price: 0,
    maxCustomers: 2,
    maxProjects: 2,
    maxDevices: 5,
    maxUsers: 2,
    paypalPlanId: null,
    sortOrder: 0,
  },
  {
    name: "Starter",
    price: 9,
    maxCustomers: 20,
    maxProjects: 20,
    maxDevices: 50,
    maxUsers: 5,
    paypalPlanId: null, // Set via admin panel after creating in PayPal
    sortOrder: 1,
  },
  {
    name: "Professional",
    price: 29,
    maxCustomers: null, // unlimited
    maxProjects: null,
    maxDevices: null,
    maxUsers: null,
    paypalPlanId: null,
    sortOrder: 2,
  },
] as const;

export type PlanName = (typeof DEFAULT_PLANS)[number]["name"];
