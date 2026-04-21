"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Pencil, Trash2, FolderOpen, Clock, Euro } from "lucide-react";

type Project = {
  id: string;
  name: string;
  status: string;
  taskRate: number | null;
  dueDate: string | null;
  notes: string | null;
  budgetedHours: number | null;
  _count: { sessions: number };
};

type DialogState =
  | { type: "create" }
  | { type: "edit"; project: Project }
  | { type: "delete"; project: Project }
  | null;

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "Aktiv", variant: "default" },
  paused: { label: "Pausiert", variant: "secondary" },
  completed: { label: "Abgeschlossen", variant: "outline" },
};

function ProjectForm({
  initial,
  onSave,
  onClose,
  loading,
  error,
}: {
  initial?: Partial<Project>;
  onSave: (data: Omit<Project, "id" | "_count">) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [taskRate, setTaskRate] = useState(initial?.taskRate?.toString() ?? "");
  const [dueDate, setDueDate] = useState(
    initial?.dueDate ? initial.dueDate.split("T")[0] : ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [budgetedHours, setBudgetedHours] = useState(initial?.budgetedHours?.toString() ?? "");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Projektname *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Netzwerkausbau 2026" />
      </div>
      <div className="space-y-1">
        <Label>Status</Label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="active">Aktiv</option>
          <option value="paused">Pausiert</option>
          <option value="completed">Abgeschlossen</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Stundensatz (€/h)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={taskRate}
            onChange={(e) => setTaskRate(e.target.value)}
            placeholder="z.B. 95.00"
          />
        </div>
        <div className="space-y-1">
          <Label>Budgetierte Stunden</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={budgetedHours}
            onChange={(e) => setBudgetedHours(e.target.value)}
            placeholder="z.B. 20"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Fälligkeitsdatum</Label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Notizen</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optionale Beschreibung..."
          rows={3}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>Abbrechen</Button>
        <Button
          disabled={loading || !name.trim()}
          onClick={() =>
            onSave({
              name,
              status,
              taskRate: taskRate ? Number(taskRate) : null,
              dueDate: dueDate || null,
              notes: notes || null,
              budgetedHours: budgetedHours ? Number(budgetedHours) : null,
            })
          }
        >
          {loading ? "Speichern…" : "Speichern"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function ProjectManager({
  customerId,
  initialProjects,
}: {
  customerId: string;
  initialProjects: Project[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(data: Omit<Project, "id" | "_count">) {
    setError(null);
    const res = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, ...data }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Fehler beim Erstellen");
      return;
    }
    setDialog(null);
    startTransition(() => router.refresh());
  }

  async function handleEdit(project: Project, data: Omit<Project, "id" | "_count">) {
    setError(null);
    const res = await fetch(`/api/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Fehler beim Speichern");
      return;
    }
    setDialog(null);
    startTransition(() => router.refresh());
  }

  async function handleDelete(project: Project) {
    setError(null);
    const res = await fetch(`/api/v1/projects/${project.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Fehler beim Löschen");
      return;
    }
    setDialog(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          Projekte
        </h3>
        <Button size="sm" variant="outline" onClick={() => { setError(null); setDialog({ type: "create" }); }}>
          <Plus className="h-4 w-4 mr-1" />
          Neu
        </Button>
      </div>

      {initialProjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Projekte angelegt.</p>
      ) : (
        <div className="space-y-2">
          {initialProjects.map((project) => {
            const cfg = statusConfig[project.status] ?? statusConfig.active;
            return (
              <Card key={project.id}>
                <CardContent className="p-3 flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{project.name}</span>
                      <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
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
                    </div>
                    {project.notes && (
                      <p className="text-xs text-muted-foreground truncate">{project.notes}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setError(null); setDialog({ type: "edit", project }); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => { setError(null); setDialog({ type: "delete", project }); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialog?.type === "create"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Projekt</DialogTitle>
          </DialogHeader>
          <ProjectForm
            onSave={handleCreate}
            onClose={() => setDialog(null)}
            loading={isPending}
            error={error}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {dialog?.type === "edit" && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Projekt bearbeiten</DialogTitle>
            </DialogHeader>
            <ProjectForm
              initial={dialog.project}
              onSave={(data) => handleEdit(dialog.project, data)}
              onClose={() => setDialog(null)}
              loading={isPending}
              error={error}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Dialog */}
      {dialog?.type === "delete" && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Projekt löschen</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Projekt <strong>{dialog.project.name}</strong> wirklich löschen? Sitzungen bleiben erhalten,
              werden aber keinem Projekt mehr zugeordnet.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={isPending}>Abbrechen</Button>
              <Button variant="destructive" disabled={isPending} onClick={() => handleDelete(dialog.project)}>
                {isPending ? "Löschen…" : "Löschen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
