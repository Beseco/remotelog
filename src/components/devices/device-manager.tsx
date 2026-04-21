"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeviceCard } from "./device-card";
import { DeviceForm } from "./device-form";
import { Plus, Search, Monitor } from "lucide-react";

type RemoteId = { id: string; type: string; remoteId: string; label: string | null; sshUser?: string | null };
type Session = { id: string; startedAt: string; endedAt: string | null; type: string };
type Group    = { id: string; name: string };
type Customer = { id: string; name: string };
type ContactRef  = { id: string; firstName: string; lastName: string };
type ContactOption = { id: string; firstName: string; lastName: string; customerId: string };
type Device = {
  id: string;
  name: string;
  macAddress: string | null;
  ipAddress: string | null;
  notes: string | null;
  tags: string[];
  remoteIds: RemoteId[];
  group: Group | null;
  customer: Customer | null;
  contact: ContactRef | null;
  sessions: Session[];
};

export function DeviceManager({
  initialDevices,
  groups,
  customers,
  contacts,
  canEdit: canEditProp,
}: {
  initialDevices: Device[];
  groups: Group[];
  customers?: Customer[];
  contacts?: ContactOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [proxmoxStatuses, setProxmoxStatuses] = useState<Map<number, "running" | "stopped" | "paused">>(new Map());
  const [onlineStatuses, setOnlineStatuses] = useState<Map<string, "online" | "offline" | "unknown">>(new Map());

  useEffect(() => {
    const hasProxmoxDevices = initialDevices.some((d) => d.tags.some((t) => t.startsWith("proxmox-vmid:")));
    if (hasProxmoxDevices) {
      fetch("/api/v1/addons/proxmox/status")
        .then((r) => r.json())
        .then((data: { vmid: number; status: string }[]) => {
          if (!Array.isArray(data)) return;
          const map = new Map<number, "running" | "stopped" | "paused">();
          for (const item of data) map.set(item.vmid, item.status as "running" | "stopped" | "paused");
          setProxmoxStatuses(map);
        })
        .catch(() => { /* ignore */ });
    }

    fetch("/api/v1/devices/online-status")
      .then((r) => r.json())
      .then((data: Record<string, "online" | "offline" | "unknown">) => {
        if (!data || typeof data !== "object") return;
        setOnlineStatuses(new Map(Object.entries(data)));
      })
      .catch(() => { /* ignore */ });
  }, [initialDevices]);

  const filtered = initialDevices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.ipAddress?.includes(search) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleCreate(data: {
    name: string; groupId: string; customerId: string; contactId: string; macAddress: string; ipAddress: string;
    notes: string; tags: string[]; remoteIds: { type: string; remoteId: string; label: string; sshUser?: string; sshPassword?: string }[];
  }) {
    const res = await fetch("/api/v1/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        groupId: data.groupId || null,
        customerId: data.customerId || null,
        contactId: data.contactId || null,
        macAddress: data.macAddress || null,
        ipAddress: data.ipAddress || null,
        notes: data.notes || null,
        remoteIds: data.remoteIds.filter((r) => r.remoteId.trim()),
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Fehler");
    }
    startTransition(() => router.refresh());
  }

  async function handleEdit(data: {
    name: string; groupId: string; customerId: string; contactId: string; macAddress: string; ipAddress: string;
    notes: string; tags: string[]; remoteIds: { type: string; remoteId: string; label: string; sshUser?: string; sshPassword?: string }[];
  }) {
    if (!editDevice) return;
    const res = await fetch(`/api/v1/devices/${editDevice.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        groupId: data.groupId || null,
        customerId: data.customerId || null,
        contactId: data.contactId || null,
        macAddress: data.macAddress || null,
        ipAddress: data.ipAddress || null,
        notes: data.notes || null,
        remoteIds: data.remoteIds.filter((r) => r.remoteId.trim()),
      }),
    });
    if (!res.ok) throw new Error("Fehler beim Speichern");
    startTransition(() => router.refresh());
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/v1/devices/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEditProp && (
          <Button size="sm" onClick={() => { setEditDevice(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Neues Gerät
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <Monitor className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>{initialDevices.length === 0 ? "Noch keine Geräte vorhanden." : "Keine Geräte gefunden."}</p>
          {canEditProp && initialDevices.length === 0 && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Erstes Gerät anlegen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((device) => {
            const vmidTag = device.tags.find((t) => t.startsWith("proxmox-vmid:"));
            const vmid = vmidTag ? parseInt(vmidTag.split(":")[1], 10) : undefined;
            return (
              <DeviceCard
                key={device.id}
                device={device}
                canEdit={canEditProp}
                onEdit={(d) => { setEditDevice(d); setFormOpen(true); }}
                onDelete={setDeleteTarget}
                proxmoxStatus={vmid !== undefined ? proxmoxStatuses.get(vmid) : undefined}
                onlineStatus={onlineStatuses.get(device.id)}
              />
            );
          })}
        </div>
      )}

      {/* Create form */}
      <DeviceForm
        open={formOpen && !editDevice}
        onClose={() => setFormOpen(false)}
        onSave={handleCreate}
        groups={groups}
        customers={customers}
        contacts={contacts}
      />

      {/* Edit form */}
      {editDevice && (
        <DeviceForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditDevice(null); }}
          onSave={handleEdit}
          groups={groups}
          initial={{
            id: editDevice.id,
            name: editDevice.name,
            groupId: editDevice.group?.id ?? "",
            customerId: editDevice.customer?.id ?? "",
            contactId: editDevice.contact?.id ?? "",
            macAddress: editDevice.macAddress ?? "",
            ipAddress: editDevice.ipAddress ?? "",
            notes: editDevice.notes ?? "",
            tags: editDevice.tags,
            remoteIds: editDevice.remoteIds.map((r) => ({
              type: r.type,
              remoteId: r.remoteId,
              label: r.label ?? "",
              sshUser: r.sshUser ?? "",
              sshPassword: "",
            })),
          }}
          customers={customers}
          contacts={contacts}
        />
      )}

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerät löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Gerät <strong>{deleteTarget?.name}</strong> und alle zugehörigen Daten (Remote-IDs, Sitzungen) werden dauerhaft gelöscht.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Löschen…" : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
