"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Pencil, Trash2, Mail, Phone, UserRound, ExternalLink, Trash } from "lucide-react";
import Link from "next/link";
import { normalizeEmail, normalizePhoneKey } from "@/lib/contact-name";

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emails: string[];
  phone: string | null;
  mobile: string | null;
  phones: string[];
  notes: string | null;
};

type DialogState =
  | { type: "create" }
  | { type: "edit"; contact: Contact }
  | { type: "delete"; contact: Contact }
  | null;

function displayEmails(contact: Contact): string[] {
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

function displayPhones(contact: Contact): string[] {
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
        {(values.length ? values : [""]).map((v, idx) => (
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

function ContactForm({
  initial,
  onSave,
  onClose,
  loading,
  error,
}: {
  initial?: Contact;
  onSave: (data: Omit<Contact, "id">) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}) {
  const initialEmails = (() => {
    const byNorm = new Map<string, string>();
    function add(raw: string | null | undefined) {
      const display = raw?.normalize("NFKC").trim();
      if (!display) return;
      const key = normalizeEmail(display);
      if (!key) return;
      if (!byNorm.has(key)) byNorm.set(key, display);
    }
    for (const e of initial?.emails ?? []) add(e);
    add(initial?.email);
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
    for (const p of initial?.phones ?? []) add(p);
    add(initial?.phone);
    add(initial?.mobile);
    const vals = [...byKey.values()];
    return vals.length ? [...vals, ""] : [""];
  })();

  const [form, setForm] = useState({
    firstName: initial?.firstName ?? "",
    lastName:  initial?.lastName  ?? "",
    emails:    initialEmails,
    phones:    initialPhones,
    notes:     initial?.notes     ?? "",
  });

  function set(k: "firstName" | "lastName" | "notes", v: string) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <>
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
            className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder="z.B. Zuständig für IT, erreichbar nachmittags"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Abbrechen</Button>
        <Button
          onClick={() => {
            const emails = form.emails.map(e => e.normalize("NFKC").trim()).filter(Boolean);
            const phones = form.phones.map(p => p.normalize("NFKC").trim()).filter(Boolean);
            const email = emails[0] ?? null;
            const phone = phones[0] ?? null;
            const mobile = phones[1] ?? null;
            onSave({
              firstName: form.firstName,
              lastName: form.lastName,
              email,
              emails,
              phone,
              mobile,
              phones,
              notes: form.notes,
            });
          }}
          disabled={loading || !form.firstName.trim() || !form.lastName.trim()}
        >
          {loading ? "Speichern…" : "Speichern"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ContactManager({
  customerId,
  initialContacts,
  canEdit,
}: {
  customerId: string;
  initialContacts: Contact[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() { startTransition(() => router.refresh()); }

  async function handleCreate(data: Omit<Contact, "id">) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      setDialog(null); refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleEdit(data: Omit<Contact, "id">) {
    if (dialog?.type !== "edit") return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/contacts/${dialog.contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Fehler");
      setDialog(null); refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (dialog?.type !== "delete") return;
    setLoading(true);
    await fetch(`/api/v1/customers/${customerId}/contacts/${dialog.contact.id}`, { method: "DELETE" });
    setDialog(null); setLoading(false); refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Ansprechpartner ({initialContacts.length})</h2>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => { setError(null); setDialog({ type: "create" }); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Hinzufügen
          </Button>
        )}
      </div>

      {initialContacts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          <UserRound className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
          Noch keine Ansprechpartner hinterlegt.
        </div>
      ) : (
        <div className="space-y-2">
          {initialContacts.map(contact => (
            <Card key={contact.id}>
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                  {contact.firstName[0]}{contact.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{contact.firstName} {contact.lastName}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {displayPhones(contact).map((p) => (
                      <a key={p} href={`tel:${p}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {p}
                      </a>
                    ))}
                    {displayEmails(contact).map((e) => (
                      <a key={e} href={`mailto:${e}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {e}
                      </a>
                    ))}
                  </div>
                  {contact.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{contact.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    render={<Link href={`/customers/${customerId}/contacts/${contact.id}`} />}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setError(null); setDialog({ type: "edit", contact }); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDialog({ type: "delete", contact })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialog?.type === "create"} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ansprechpartner hinzufügen</DialogTitle></DialogHeader>
          <ContactForm onSave={handleCreate} onClose={() => setDialog(null)} loading={loading} error={error} />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.type === "edit"} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ansprechpartner bearbeiten</DialogTitle></DialogHeader>
          {dialog?.type === "edit" && (
            <ContactForm initial={dialog.contact} onSave={handleEdit} onClose={() => setDialog(null)} loading={loading} error={error} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.type === "delete"} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ansprechpartner löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{dialog?.type === "delete" ? `${dialog.contact.firstName} ${dialog.contact.lastName}` : ""}</strong> wird dauerhaft gelöscht.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
