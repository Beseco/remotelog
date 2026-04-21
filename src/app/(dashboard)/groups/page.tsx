import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { GroupManager } from "@/components/groups/group-manager";
import { canEdit } from "@/lib/permissions";

export default async function GroupsPage() {
  const session = await requireAuth();

  const groups = await prisma.group.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Gruppen</h1>
        <p className="text-muted-foreground">Geräte in Gruppen und Untergruppen organisieren.</p>
      </div>
      <GroupManager
        initialGroups={groups}
        canEdit={canEdit(session.user.role)}
      />
    </div>
  );
}
