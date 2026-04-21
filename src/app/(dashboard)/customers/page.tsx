import { requireAuth, canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CustomerManager } from "@/components/customers/customer-manager";

export default async function CustomersPage() {
  const session = await requireAuth();

  const customers = await prisma.customer.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      contacts: { orderBy: { lastName: "asc" } },
      _count: { select: { devices: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kunden</h1>
        <p className="text-muted-foreground">
          Unternehmen verwalten und Geräte zuordnen.
        </p>
      </div>
      <CustomerManager
        initialCustomers={customers}
        canEdit={canEdit(session.user.role)}
      />
    </div>
  );
}
