"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Group = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

function buildTree(groups: Group[], parentId: string | null = null): Group[] {
  return groups
    .filter((g) => g.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

type DialogState =
  | { type: "create"; parentId?: string }
  | { type: "rename"; group: Group }
  | { type: "delete"; group: Group }
  | null;

function GroupRow({
  group,
  allGroups,
  depth,
  canEdit,
  onAction,
}: {
  group: Group;
  allGroups: Group[];
  depth: number;
  canEdit: boolean;
  onAction: (state: DialogState) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = buildTree(allGroups, group.id);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-accent group",
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <button
          className="w-4 h-4 flex items-center justify-center text-muted-foreground"
          onClick={() => children.length > 0 && setExpanded(!expanded)}
        >
          {children.length > 0 ? (
            expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : null}
        </button>
        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm">{group.name}</span>
        {depth === 0 && <Badge variant="secondary" className="text-xs">{children.length} Untergruppen</Badge>}
        {canEdit && (
          <div className="hidden group-hover:flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onAction({ type: "create", parentId: group.id })}
              title="Untergruppe anlegen"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onAction({ type: "rename", group })}
              title="Umbenennen"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onAction({ type: "delete", group })}
              title="Löschen"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      {expanded &&
        children.map((child) => (
          <GroupRow
            key={child.id}
            group={child}
            allGroups={allGroups}
            depth={depth + 1}
            canEdit={canEdit}
            onAction={onAction}
          />
        ))}
    </div>
  );
}

export function GroupManager({
  initialGroups,
  canEdit,
}: {
  initialGroups: Group[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootGroups = buildTree(initialGroups, null);

  function openCreate(parentId?: string) {
    setNameInput("");
    setError(null);
    setDialog({ type: "create", parentId });
  }

  async function handleCreate() {
    if (!nameInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameInput.trim(),
          parentId: dialog?.type === "create" ? dialog.parentId ?? null : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Fehler");
      }
      setDialog(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRename() {
    if (dialog?.type !== "rename" || !nameInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/groups/${dialog.group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      if (!res.ok) throw new Error("Fehler beim Umbenennen");
      setDialog(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (dialog?.type !== "delete") return;
    setLoading(true);
    try {
      await fetch(`/api/v1/groups/${dialog.group.id}`, { method: "DELETE" });
      setDialog(null);
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderTree className="h-5 w-5" />
          Gruppen ({initialGroups.length})
        </h2>
        {canEdit && (
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-1" />
            Neue Gruppe
          </Button>
        )}
      </div>

      {initialGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <FolderTree className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Noch keine Gruppen vorhanden.</p>
          {canEdit && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => openCreate()}>
              <Plus className="h-4 w-4 mr-1" /> Erste Gruppe anlegen
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          {rootGroups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              allGroups={initialGroups}
              depth={0}
              canEdit={canEdit}
              onAction={(state) => {
                if (state?.type === "rename") setNameInput(state.group.name);
                else setNameInput("");
                setError(null);
                setDialog(state);
              }}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialog?.type === "create"} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Gruppe</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="z.B. Kunde A"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={loading || !nameInput.trim()}>
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={dialog?.type === "rename"} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gruppe umbenennen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">Neuer Name</Label>
            <Input
              id="rename-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button onClick={handleRename} disabled={loading || !nameInput.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={dialog?.type === "delete"} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gruppe löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Gruppe <strong>{dialog?.type === "delete" ? dialog.group.name : ""}</strong> löschen?
            Untergruppen und Geräte werden in die übergeordnete Gruppe verschoben.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
