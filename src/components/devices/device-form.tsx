"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Trash2 } from "lucide-react";
import { remoteTypeLabels } from "./remote-deeplink";

type Group    = { id: string; name: string };
type Customer = { id: string; name: string };
type Contact  = { id: string; firstName: string; lastName: string; customerId: string };
type RemoteId = { type: string; remoteId: string; label: string; sshUser?: string; sshPassword?: string };

type DeviceFormData = {
  name: string;
  groupId: string;
  customerId: string;
  contactId: string;
  macAddress: string;
  ipAddress: string;
  notes: string;
  tags: string[];
  remoteIds: RemoteId[];
};

const REMOTE_TYPES = ["rustdesk", "teamviewer", "anydesk", "rdp", "ssh", "vnc"] as const;

export function DeviceForm({
  open,
  onClose,
  onSave,
  groups,
  customers,
  contacts,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: DeviceFormData) => Promise<void>;
  groups: Group[];
  customers?: Customer[];
  contacts?: Contact[];
  initial?: Partial<DeviceFormData> & { id?: string };
}) {
  const [form, setForm] = useState<DeviceFormData>({
    name: initial?.name ?? "",
    groupId: initial?.groupId ?? "",
    customerId: initial?.customerId ?? "",
    contactId: initial?.contactId ?? "",
    macAddress: initial?.macAddress ?? "",
    ipAddress: initial?.ipAddress ?? "",
    notes: initial?.notes ?? "",
    tags: initial?.tags ?? [],
    remoteIds: initial?.remoteIds ?? [],
  });
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof DeviceFormData>(key: K, value: DeviceFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    set("tags", form.tags.filter((t) => t !== tag));
  }

  function addRemoteId() {
    set("remoteIds", [...form.remoteIds, { type: "rustdesk", remoteId: "", label: "", sshUser: "", sshPassword: "" }]);
  }

  function updateRemoteId(idx: number, field: keyof RemoteId, value: string) {
    const updated = form.remoteIds.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    set("remoteIds", updated);
  }

  function removeRemoteId(idx: number) {
    set("remoteIds", form.remoteIds.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Name ist erforderlich"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Gerät bearbeiten" : "Neues Gerät"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="PC-Büro-01" autoFocus />
          </div>

          {/* Group */}
          <div className="space-y-1.5">
            <Label>Gruppe</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.groupId}
              onChange={(e) => set("groupId", e.target.value)}
            >
              <option value="">— Keine Gruppe —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Customer + Contact (two-column if contacts available) */}
          {customers && customers.length > 0 && (
            <div className={contacts && contacts.length > 0 && form.customerId ? "grid grid-cols-2 gap-3" : ""}>
              <div className="space-y-1.5">
                <Label>Kunde</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.customerId}
                  onChange={(e) => {
                    set("customerId", e.target.value);
                    // Reset contact if it doesn't belong to new customer
                    const newCustomerId = e.target.value;
                    if (form.contactId) {
                      const contactBelongs = contacts?.some(
                        c => c.id === form.contactId && c.customerId === newCustomerId,
                      );
                      if (!contactBelongs) set("contactId", "");
                    }
                  }}
                >
                  <option value="">— Kein Kunde —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Contact — only when a customer is selected and it has contacts */}
              {form.customerId && contacts && contacts.filter(c => c.customerId === form.customerId).length > 0 && (
                <div className="space-y-1.5">
                  <Label>Ansprechpartner</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.contactId}
                    onChange={(e) => set("contactId", e.target.value)}
                  >
                    <option value="">— Kein Ansprechpartner —</option>
                    {contacts
                      .filter(c => c.customerId === form.customerId)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Network */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>IP-Adresse</Label>
              <Input value={form.ipAddress} onChange={(e) => set("ipAddress", e.target.value)} placeholder="192.168.1.100" />
            </div>
            <div className="space-y-1.5">
              <Label>MAC-Adresse</Label>
              <Input value={form.macAddress} onChange={(e) => set("macAddress", e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" />
            </div>
          </div>

          {/* Remote IDs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Remote-Verbindungen</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRemoteId}>
                <Plus className="h-3 w-3 mr-1" /> Hinzufügen
              </Button>
            </div>
            {form.remoteIds.map((r, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex gap-2 items-center">
                  <select
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={r.type}
                    onChange={(e) => updateRemoteId(idx, "type", e.target.value)}
                  >
                    {REMOTE_TYPES.map((t) => (
                      <option key={t} value={t}>{remoteTypeLabels[t]}</option>
                    ))}
                  </select>
                  <Input
                    className="h-8 text-xs flex-1"
                    value={r.remoteId}
                    onChange={(e) => updateRemoteId(idx, "remoteId", e.target.value)}
                    placeholder="ID / Adresse"
                  />
                  <Input
                    className="h-8 text-xs w-24"
                    value={r.label}
                    onChange={(e) => updateRemoteId(idx, "label", e.target.value)}
                    placeholder="Label"
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRemoteId(idx)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                {r.type === "ssh" && (
                  <div className="flex gap-2 pl-1">
                    <Input
                      className="h-8 text-xs flex-1"
                      value={r.sshUser ?? ""}
                      onChange={(e) => updateRemoteId(idx, "sshUser", e.target.value)}
                      placeholder="Benutzer (z.B. root)"
                    />
                    <Input
                      type="password"
                      className="h-8 text-xs flex-1"
                      value={r.sshPassword ?? ""}
                      onChange={(e) => updateRemoteId(idx, "sshPassword", e.target.value)}
                      placeholder="Passwort (optional)"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Tag eingeben…"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>Hinzufügen</Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => removeTag(tag)}><X className="h-2.5 w-2.5" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Freitext-Notizen zum Gerät…"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
