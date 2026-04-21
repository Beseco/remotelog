"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Monitor, Plus, Play, Mail } from "lucide-react";
import { buildDeeplink, type RemoteType } from "@/components/devices/remote-deeplink";
import { StartSessionDialog } from "./start-session-dialog";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

type RemoteId = { id: string; type: string; remoteId: string; label: string | null };
type Contact = { id: string; firstName: string; lastName: string };
type Device = {
  id: string;
  name: string;
  ipAddress: string | null;
  remoteIds: RemoteId[];
  contact: Contact | null;
  group: { id: string; name: string } | null;
  sessions: { id: string; startedAt: string; endedAt: string | null; type: string }[];
};

type OrgDevice = {
  id: string;
  name: string;
  customerId: string | null;
  group: { name: string } | null;
};

type ContactOption = {
  id: string;
  firstName: string;
  lastName: string;
};

// ─── Assign Device Dialog ─────────────────────────────────────────────────────

function AssignDeviceDialog({
  open,
  onClose,
  customerId,
  orgDevices,
  existingDeviceIds,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  orgDevices: OrgDevice[];
  existingDeviceIds: string[];
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = orgDevices.filter(d => !existingDeviceIds.includes(d.id));

  async function handleAssign() {
    if (!selectedId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/v1/devices/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (!res.ok) throw new Error("Fehler beim Zuordnen");
      setSelectedId("");
      onClose();
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerät zuordnen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Alle Geräte der Organisation sind bereits einem Kunden zugeordnet.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label>Gerät auswählen</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
              >
                <option value="">— Gerät wählen —</option>
                {available.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.group ? ` (${d.group.name})` : ""}
                    {d.customerId ? " [bereits zugeordnet]" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleAssign} disabled={loading || !selectedId || available.length === 0}>
            {loading ? "Zuordnen…" : "Zuordnen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Contact Dialog ─────────────────────────────────────────────────────

function AssignContactDialog({
  open,
  onClose,
  device,
  contacts,
}: {
  open: boolean;
  onClose: () => void;
  device: Device | null;
  contacts: ContactOption[];
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [contactId, setContactId] = useState(device?.contact?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when device changes
  const currentContactId = device?.contact?.id ?? "";

  async function handleSave() {
    if (!device) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/v1/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contactId || null }),
      });
      if (!res.ok) throw new Error("Fehler");
      onClose();
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ansprechpartner zuordnen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Gerät: <strong>{device?.name}</strong>
          </p>
          <div className="space-y-1.5">
            <Label>Ansprechpartner</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              defaultValue={currentContactId}
              onChange={e => setContactId(e.target.value)}
            >
              <option value="">— Kein Ansprechpartner —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Device List ─────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE");
}

function InviteModal({ onClose, prefilledEmail }: { onClose: () => void; prefilledEmail?: string }) {
  const [email, setEmail] = useState(prefilledEmail ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<{ id: string; name: string; email: string; customerName: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetch("/api/v1/install/contacts")
      .then((r) => r.json() as Promise<{ id: string; name: string; email: string; customerName: string }[]>)
      .then(setContacts)
      .catch(() => null);
  }, []);

  const filtered = email.length >= 1
    ? contacts.filter(
        (c) =>
          c.email.toLowerCase().includes(email.toLowerCase()) ||
          c.name.toLowerCase().includes(email.toLowerCase())
      ).slice(0, 6)
    : [];

  async function send() {
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/install/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: email.trim() }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Fehler");
      } else {
        setSent(true);
        setTimeout(() => onClose(), 2000);
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Einladung per E-Mail</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
        {sent ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-green-700">E-Mail wurde gesendet!</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">Der Empfänger erhält eine Anleitung mit Download-Link.</p>
            <div className="relative">
              <input
                type="email"
                autoFocus
                placeholder="kunde@beispiel.de"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onKeyDown={(e) => e.key === "Enter" && void send()}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showDropdown && filtered.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => { setEmail(c.email); setShowDropdown(false); }}
                      className="w-full flex items-start gap-2 px-3 py-2 hover:bg-blue-50 text-left text-sm"
                    >
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="text-gray-500 truncate">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Abbrechen</button>
              <button
                onClick={() => void send()}
                disabled={!email.trim() || sending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                {sending ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Mail className="h-4 w-4" />}
                Senden
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InviteButton({ prefilledEmail }: { prefilledEmail?: string }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setShow(true)}
        className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100">
        <Mail className="h-3.5 w-3.5 mr-1" /> Einladung senden
      </Button>
      {show && <InviteModal onClose={() => setShow(false)} prefilledEmail={prefilledEmail} />}
    </>
  );
}

export function CustomerDeviceList({
  devices,
  contacts,
  orgDevices,
  customerId,
  customerName,
  canEdit,
  primaryContactEmail,
}: {
  devices: Device[];
  contacts: ContactOption[];
  orgDevices: OrgDevice[];
  customerId: string;
  customerName: string;
  canEdit: boolean;
  primaryContactEmail?: string;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [sessionDevice, setSessionDevice] = useState<Device | null>(null);
  const [customerSessionOpen, setCustomerSessionOpen] = useState(false);
  const [contactDevice, setContactDevice] = useState<Device | null>(null);

  const existingIds = devices.map(d => d.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Zugeordnete Geräte ({devices.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          <InviteButton prefilledEmail={primaryContactEmail} />
          <Button size="sm" variant="outline" onClick={() => setCustomerSessionOpen(true)}>
            <Play className="h-3.5 w-3.5 mr-1" /> Sitzung (Kunde)
          </Button>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Gerät zuordnen
            </Button>
          )}
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          <Monitor className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
          Noch keine Geräte zugeordnet.
          {canEdit && (
            <button
              onClick={() => setAssignOpen(true)}
              className="block mx-auto mt-2 text-xs text-primary hover:underline"
            >
              Gerät zuordnen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map(device => {
            const lastSession = device.sessions[0];
            const isActive = lastSession && !lastSession.endedAt;
            return (
              <Card key={device.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <Monitor className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{device.name}</span>
                        {device.group && (
                          <span className="text-xs text-muted-foreground">{device.group.name}</span>
                        )}
                        {device.contact && (
                          <Badge variant="secondary" className="text-xs">
                            {device.contact.firstName} {device.contact.lastName}
                          </Badge>
                        )}
                        {isActive && (
                          <Badge variant="default" className="text-xs gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                            Aktiv
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {device.remoteIds.map(r => (
                          <a
                            key={r.id}
                            href={buildDeeplink(r.type as RemoteType, r.remoteId, device.ipAddress)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {r.label || r.type}
                          </a>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {lastSession && (
                        <span className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-0.5" />
                          {fmtDate(lastSession.startedAt)}
                        </span>
                      )}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => { setContactDevice(device); }}
                        >
                          Kontakt
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setSessionDevice(device)}
                      >
                        <Play className="h-3 w-3 mr-1" /> Sitzung
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AssignDeviceDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        customerId={customerId}
        orgDevices={orgDevices}
        existingDeviceIds={existingIds}
      />

      {sessionDevice && (
        <StartSessionDialog
          open={!!sessionDevice}
          onClose={() => setSessionDevice(null)}
          context={{ kind: "device", id: sessionDevice.id, name: sessionDevice.name }}
        />
      )}

      <AssignContactDialog
        open={!!contactDevice}
        onClose={() => setContactDevice(null)}
        device={contactDevice}
        contacts={contacts}
      />

      <StartSessionDialog
        open={customerSessionOpen}
        onClose={() => setCustomerSessionOpen(false)}
        context={{ kind: "customer", id: customerId, name: customerName }}
      />
    </div>
  );
}
