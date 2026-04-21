"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone, Mail, Smartphone, FileText, Pencil, Monitor,
  ExternalLink, Play, Clock, Plus, Trash,
} from "lucide-react";
import { buildDeeplink, type RemoteType } from "@/components/devices/remote-deeplink";
import { StartSessionDialog } from "./start-session-dialog";
import { normalizeEmail, normalizePhoneKey } from "@/lib/contact-name";

// ─── Types ────────────────────────────────────────────────────────────────────

type RemoteId = { id: string; type: string; remoteId: string; label: string | null };

type Device = {
  id: string;
  name: string;
  ipAddress: string | null;
  remoteIds: RemoteId[];
  group: { id: string; name: string } | null;
  sessions: { id: string; startedAt: string; endedAt: string | null; type: string }[];
};

type Session = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  type: string;
  device: { id: string; name: string } | null;
  user: { id: string; name: string };
};

type ContactData = {
  id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emails: string[];
  phone: string | null;
  mobile: string | null;
  phones: string[];
  notes: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function displayEmails(contact: ContactData): string[] {
  const byNorm = new Map<string, string>();
  function add(raw: string | null | undefined) {
    const display = raw?.normalize("NFKC").trim();
    if (!display) return;
    const key = normalizeEmail(display);
    if (!key) return;
    if (!byNorm.has(key)) byNorm.set(key, display);
  }
  for (const e of contact.emails ?? []) add(e);
  add(contact.email);
  return [...byNorm.values()];
}

function displayPhones(contact: ContactData): string[] {
  const byKey = new Map<string, string>();
  function add(raw: string | null | undefined) {
    const display = raw?.normalize("NFKC").trim();
    if (!display) return;
    const key = normalizePhoneKey(display);
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, display);
  }
  for (const p of contact.phones ?? []) add(p);
  add(contact.phone);
  add(contact.mobile);
  return [...byKey.values()];
}

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

const typeLabels: Record<string, string> = {
  remote: "Remote", onsite: "Vor-Ort", phone: "Telefon",
};

function MultiTextListEditor({
  label,
  placeholder,
  values,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  type?: "text" | "email" | "tel";
}) {
  function updateAt(idx: number, v: string) {
    const next = [...values];
    next[idx] = v;
    onChange(next);
  }
  function removeAt(idx: number) {
    const next = values.filter((_, i) => i !== idx);
    onChange(next.length ? next : [""]);
  }
  function add() {
    onChange([...values, ""]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Eintrag
        </Button>
      </div>
      <div className="space-y-2">
        {values.map((v, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              type={type}
              value={v}
              onChange={(e) => updateAt(idx, e.target.value)}
              placeholder={placeholder}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeAt(idx)}
              disabled={values.length <= 1}
              title="Entfernen"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

function EditContactDialog({
  open,
  onClose,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  contact: ContactData;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const initialEmails = (() => {
    const byNorm = new Map<string, string>();
    function add(raw: string | null | undefined) {
      const display = raw?.normalize("NFKC").trim();
      if (!display) return;
      const key = normalizeEmail(display);
      if (!key) return;
      if (!byNorm.has(key)) byNorm.set(key, display);
    }
    for (const e of contact.emails ?? []) add(e);
    add(contact.email);
    const deduped = [...byNorm.values()];
    return deduped.length ? [...deduped, ""] : [""];
  })();

  const initialPhones = (() => {
    const byKey = new Map<string, string>();
    function add(raw: string | null | undefined) {
      const display = raw?.normalize("NFKC").trim();
      if (!display) return;
      const key = normalizePhoneKey(display);
      if (!key) return;
      if (!byKey.has(key)) byKey.set(key, display);
    }
    for (const p of contact.phones ?? []) add(p);
    add(contact.phone);
    add(contact.mobile);
    const deduped = [...byKey.values()];
    return deduped.length ? [...deduped, ""] : [""];
  })();

  const [form, setForm] = useState({
    firstName: contact.firstName,
    lastName:  contact.lastName,
    emails:    initialEmails,
    phones:    initialPhones,
    notes:     contact.notes  ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function set(k: "firstName" | "lastName" | "notes", v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Vor- und Nachname sind erforderlich");
      return;
    }
    setLoading(true); setError(null);
    try {
      const emails = form.emails.map(e => e.normalize("NFKC").trim()).filter(Boolean);
      const phones = form.phones.map(p => p.normalize("NFKC").trim()).filter(Boolean);
      const res = await fetch(
        `/api/v1/customers/${contact.customerId}/contacts/${contact.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            emails,
            phones,
            email: emails[0] ?? null,
            phone: phones[0] ?? null,
            mobile: phones[1] ?? null,
            notes: form.notes,
          }),
        },
      );
      if (!res.ok) throw new Error("Fehler beim Speichern");
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
          <DialogTitle>Ansprechpartner bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vorname *</Label>
              <Input value={form.firstName} onChange={e => set("firstName", e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Nachname *</Label>
              <Input value={form.lastName} onChange={e => set("lastName", e.target.value)} />
            </div>
          </div>
          <MultiTextListEditor
            label="E-Mail-Adressen"
            placeholder="name@example.com"
            type="email"
            values={form.emails}
            onChange={(emails) => setForm(f => ({ ...f, emails }))}
          />
          <MultiTextListEditor
            label="Telefonnummern"
            placeholder="+49 123 456789"
            type="tel"
            values={form.phones}
            onChange={(phones) => setForm(f => ({ ...f, phones }))}
          />
          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <textarea
              className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="z.B. Zuständig für IT, erreichbar nachmittags"
            />
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContactDetail({
  contact,
  devices,
  sessions,
  canEdit,
}: {
  contact: ContactData;
  devices: Device[];
  sessions: Session[];
  canEdit: boolean;
}) {
  const [editOpen, setEditOpen]             = useState(false);
  const [sessionDevice, setSessionDevice]   = useState<Device | null>(null);
  const [contactSessionOpen, setContactSessionOpen] = useState(false);

  const totalMinutes = sessions
    .filter(s => s.endedAt)
    .reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  const emails = displayEmails(contact);
  const phones = displayPhones(contact);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ── Left: Contact Info ── */}
      <div className="space-y-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
            {contact.firstName[0]}{contact.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight">
              {contact.firstName} {contact.lastName}
            </h2>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setContactSessionOpen(true)}>
              <Play className="h-3.5 w-3.5 mr-1" /> Sitzung
            </Button>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Bearbeiten
              </Button>
            )}
          </div>
        </div>

        {/* Contact details card */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm text-muted-foreground font-medium">Kontaktdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {phones.length ? (
              phones.map((p) => {
                const isMobile = !!contact.mobile && normalizePhoneKey(p) === normalizePhoneKey(contact.mobile);
                const Icon = isMobile ? Smartphone : Phone;
                return (
                  <a key={p} href={`tel:${p}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{p}</span>
                  </a>
                );
              })
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground/50">
                <Phone className="h-4 w-4 shrink-0" />
                <span className="italic">Keine Telefonnummer</span>
              </div>
            )}
            {emails.length ? (
              emails.map((e) => (
                <a key={e} href={`mailto:${e}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{e}</span>
                </a>
              ))
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground/50">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="italic">Keine E-Mail</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Notizen
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {contact.notes ? (
              <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Keine Notizen vorhanden.
                {canEdit && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="ml-1 text-primary hover:underline"
                  >
                    Notiz hinzufügen
                  </button>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Right: Devices + Sessions ── */}
      <div className="lg:col-span-2 space-y-6">
        {/* Devices */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Zugeordnete Geräte ({devices.length})
            </h2>
          </div>
          {devices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
              <Monitor className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
              Keine Geräte direkt diesem Ansprechpartner zugewiesen.
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map(device => {
                const last = device.sessions[0];
                const isActive = last && !last.endedAt;
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
                          {last && (
                            <span className="text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 inline mr-0.5" />
                              {fmtDate(last.startedAt)}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setSessionDevice(device)}
                          >
                            <Play className="h-3 w-3 mr-1" /> Gerät
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Verbindungshistorie ({sessions.filter(s => s.endedAt).length})
            </h2>
            {totalMinutes > 0 && (
              <span className="text-xs text-muted-foreground font-medium">
                Gesamt: {fmtMinutes(totalMinutes)}
              </span>
            )}
          </div>
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
              <Clock className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
              Noch keine Verbindungen aufgezeichnet.
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Datum</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Gerät</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Techniker</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Typ</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Dauer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                        <td className="px-4 py-2 whitespace-nowrap text-xs">{fmtDate(s.startedAt)}</td>
                        <td className="px-4 py-2 font-medium text-xs">{s.device?.name ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs hidden sm:table-cell">{s.user.name}</td>
                        <td className="px-4 py-2">
                          <Badge variant={s.endedAt ? "outline" : "default"} className="text-xs">
                            {s.endedAt ? (typeLabels[s.type] ?? s.type) : "Aktiv"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {s.durationMinutes !== null ? fmtMinutes(s.durationMinutes) : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Dialogs ── */}
      <EditContactDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        contact={contact}
      />
      <StartSessionDialog
        open={contactSessionOpen}
        onClose={() => setContactSessionOpen(false)}
        context={{ kind: "contact", id: contact.id, name: `${contact.firstName} ${contact.lastName}` }}
      />

      {sessionDevice && (
        <StartSessionDialog
          open={!!sessionDevice}
          onClose={() => setSessionDevice(null)}
          context={{ kind: "device", id: sessionDevice.id, name: sessionDevice.name }}
        />
      )}
    </div>
  );
}
