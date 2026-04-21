import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FolderOpen, Clock, Euro, Building2 } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "Aktiv", variant: "default" },
  paused: { label: "Pausiert", variant: "secondary" },
  completed: { label: "Abgeschlossen", variant: "outline" },
};

export default async function ProjectsPage() {
  const session = await requireAuth();
  const orgId = session.user.organizationId;

  const projects = await prisma.project.findMany({
    where: { organizationId: orgId },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { sessions: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const active = projects.filter((p) => p.status === "active");
  const paused = projects.filter((p) => p.status === "paused");
  const completed = projects.filter((p) => p.status === "completed");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Projekte</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {projects.length} Projekt{projects.length !== 1 ? "e" : ""} insgesamt
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Noch keine Projekte angelegt.</p>
            <p className="text-xs mt-1">
              Projekte werden auf der{" "}
              <Link href="/customers" className="underline hover:text-foreground">
                Kunden-Detailseite
              </Link>{" "}
              angelegt.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {[
            { label: "Aktiv", items: active },
            { label: "Pausiert", items: paused },
            { label: "Abgeschlossen", items: completed },
          ]
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <div key={group.label} className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.label} ({group.items.length})
                </h2>
                <div className="space-y-2">
                  {group.items.map((project) => {
                    const cfg = statusConfig[project.status] ?? statusConfig.active;
                    return (
                      <Card key={project.id}>
                        <CardContent className="p-4 flex items-start justify-between gap-4">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{project.name}</span>
                              <Badge variant={cfg.variant} className="text-xs shrink-0">
                                {cfg.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <Link
                                href={`/customers/${project.customer.id}`}
                                className="hover:underline truncate"
                              >
                                {project.customer.name}
                              </Link>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              {project.taskRate != null && (
                                <span className="flex items-center gap-1">
                                  <Euro className="h-3 w-3" />
                                  {project.taskRate.toFixed(2)}/h
                                </span>
                              )}
                              {project.dueDate && (
                                <span>
                                  Fällig: {new Date(project.dueDate).toLocaleDateString("de-DE")}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {project._count.sessions} Sitzung{project._count.sessions !== 1 ? "en" : ""}
                              </span>
                              {project.budgetedHours != null && (
                                <span>{project.budgetedHours} h Budget</span>
                              )}
                            </div>
                            {project.notes && (
                              <p className="text-xs text-muted-foreground truncate">{project.notes}</p>
                            )}
                          </div>
                          <Link
                            href={`/customers/${project.customer.id}`}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline shrink-0"
                          >
                            Zum Kunden →
                          </Link>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
