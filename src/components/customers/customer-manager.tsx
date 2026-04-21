"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Building2, Plus, Search, MoreVertical, Pencil, Trash2, Users, Monitor, ChevronRight, MapPin, Mail, Merge } from "lucide-react";

type Contact = { id: string; firstName: string; lastName: string };
type Customer = {
  id: string;
  name: string;
  notes: string | null;
  customerNumber: string | null;
  invoiceNinjaId: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  contacts: Contact[];
  _count: { devices: number };
};

type CustomerFormData = {
  name: string;
  notes: string;
  customerNumber: string;
  email: string;
  phone: string;
  website: string;
  street: string;
  zip: string;
  city: string;
  country: string;
};

type DialogState =
  | { type: "create" }
  | { type: "edit"; customer: Customer }
  | { type: "delete"; customer: Customer }
  | { type: "merge-pick"; source: Customer }
  | { type: "merge-confirm"; source: Customer; target: Customer }
  | null;

function CustomerForm({
  initial,
  onSave,
  onClose,
  loading,
  error,
}: {
  initial?: Partial<CustomerFormData>;
  onSave: (data: CustomerFormData) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<CustomerFormData>({
    name: initial?.name ?? "",
    notes: initial?.notes ?? "",
    customerNumber: initial?.customerNumber ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    website: initial?.website ?? "",
    street: initial?.street ?? "",
    zip: initial?.zip ?? "",
    city: initial?.city ?? "",
    country: initial?.country ?? "",
  });

  function set(key: keyof CustomerFormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Unternehmensname *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Musterfirma GmbH" autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label>Kundennummer</Label>
            <Input value={form.customerNumber} onChange={e => set("customerNumber", e.target.value)} placeholder="K-0001" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>E-Mail</Label>
            <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="info@firma.de" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+49 123 456789" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Website</Label>
          <Input type="url" value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://www.firma.de" />
        </div>

        <div className="space-y-1.5">
          <Label>Straße + Hausnummer</Label>
          <Input value={form.street} onChange={e => set("street", e.target.value)} placeholder="Musterstraße 1" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>PLZ</Label>
            <Input value={form.zip} onChange={e => set("zip", e.target.value)} placeholder="12345" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Stadt</Label>
            <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Musterstadt" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Land</Label>
          <Input value={form.country} onChange={e => set("country", e.target.value)} placeholder="Deutschland" />
        </div>

        <div className="space-y-1.5">
          <Label>Notizen</Label>
          <textarea
            className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder="Interne Notizen zum Kunden…"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Abbrechen</Button>
        <Button onClick={() => onSave(form)} disabled={loading || !form.name.trim()}>
          {loading ? "Speichern…" : "Speichern"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CustomerManager({
  initialCustomers,
  canEdit,
}: {
  initialCustomers: Customer[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = initialCustomers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  function refresh() { startTransition(() => router.refresh()); }

  async function handleCreate(data: CustomerFormData) {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      setDialog(null);
      refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleEdit(data: CustomerFormData) {
    if (dialog?.type !== "edit") return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/v1/customers/${dialog.customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      setDialog(null);
      refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (dialog?.type !== "delete") return;
    setLoading(true);
    await fetch(`/api/v1/customers/${dialog.customer.id}`, { method: "DELETE" });
    setDialog(null); setLoading(false); refresh();
  }

  async function handleMerge() {
    if (dialog?.type !== "merge-confirm") return;
    setLoading(true); setError(null);
    // source is absorbed into target (target = primary, source = secondary)
    try {
      const res = await fetch("/api/v1/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryId: dialog.target.id,
          secondaryId: dialog.source.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      setDialog(null);
      refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setError(null); setDialog({ type: "create" }); }}>
            <Plus className="h-4 w-4 mr-1" /> Neuer Kunde
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>{initialCustomers.length === 0 ? "Noch keine Kunden angelegt." : "Keine Kunden gefunden."}</p>
          {canEdit && initialCustomers.length === 0 && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setDialog({ type: "create" })}>
              <Plus className="h-4 w-4 mr-1" /> Ersten Kunden anlegen
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(customer => (
            <Card key={customer.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{customer.name}</span>
                    {customer.customerNumber && (
                      <span className="text-xs text-muted-foreground">#{customer.customerNumber}</span>
                    )}
                    {customer._count.devices > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Monitor className="h-3 w-3" />
                        {customer._count.devices} {customer._count.devices === 1 ? "Gerät" : "Geräte"}
                      </Badge>
                    )}
                    {customer.contacts.length > 0 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Users className="h-3 w-3" />
                        {customer.contacts.length} {customer.contacts.length === 1 ? "Kontakt" : "Kontakte"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {customer.city && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{customer.city}
                      </span>
                    )}
                    {customer.email && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />{customer.email}
                      </span>
                    )}
                    {!customer.city && !customer.email && customer.notes && (
                      <p className="text-xs text-muted-foreground truncate">{customer.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" render={<Link href={`/customers/${customer.id}`} />}>
                    Details
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setError(null); setDialog({ type: "edit", customer }); }}>
                          <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setError(null); setDialog({ type: "merge-pick", source: customer }); }}>
                          <Merge className="mr-2 h-4 w-4" /> Zusammenführen
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDialog({ type: "delete", customer })}
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

      {/* Create */}
      <Dialog open={dialog?.type === "create"} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Neuer Kunde</DialogTitle></DialogHeader>
          <CustomerForm onSave={handleCreate} onClose={() => setDialog(null)} loading={loading} error={error} />
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={dialog?.type === "edit"} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Kunde bearbeiten</DialogTitle></DialogHeader>
          {dialog?.type === "edit" && (
            <CustomerForm
              initial={{
                name: dialog.customer.name,
                notes: dialog.customer.notes ?? "",
                customerNumber: dialog.customer.customerNumber ?? "",
                email: dialog.customer.email ?? "",
                phone: dialog.customer.phone ?? "",
                website: dialog.customer.website ?? "",
                street: dialog.customer.street ?? "",
                zip: dialog.customer.zip ?? "",
                city: dialog.customer.city ?? "",
                country: dialog.customer.country ?? "",
              }}
              onSave={handleEdit}
              onClose={() => setDialog(null)}
              loading={loading}
              error={error}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={dialog?.type === "delete"} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Kunden löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{dialog?.type === "delete" ? dialog.customer.name : ""}</strong> wird gelöscht.
            Zugewiesene Geräte und Gruppen bleiben erhalten.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Löschen…" : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Step 1: pick target */}
      <Dialog open={dialog?.type === "merge-pick"} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Zusammenführen – Ziel wählen</DialogTitle>
          </DialogHeader>
          {dialog?.type === "merge-pick" && (
            <>
              <p className="text-sm text-muted-foreground">
                <strong>{dialog.source.name}</strong> wird in den gewählten Kunden aufgenommen.
                Alle Geräte, Kontakte und Sitzungen werden übertragen. Der gewählte Kunde bleibt erhalten.
              </p>
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {initialCustomers
                  .filter((c) => c.id !== dialog.source.id)
                  .map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left rounded-md border px-3 py-2.5 hover:bg-accent transition-colors"
                      onClick={() => setDialog({ type: "merge-confirm", source: dialog.source, target: c })}
                    >
                      <span className="font-medium text-sm">{c.name}</span>
                      {c.customerNumber && (
                        <span className="ml-2 text-xs text-muted-foreground">#{c.customerNumber}</span>
                      )}
                      {c.invoiceNinjaId && (
                        <span className="ml-2 text-xs text-muted-foreground">[IN]</span>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c._count.devices} Gerät(e) · {c.contacts.length} Kontakt(e)
                      </div>
                    </button>
                  ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Step 2: confirm */}
      <Dialog open={dialog?.type === "merge-confirm"} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zusammenführen bestätigen</DialogTitle>
          </DialogHeader>
          {dialog?.type === "merge-confirm" && (
            <>
              <div className="space-y-3 text-sm">
                <div className="rounded-md border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Wird aufgelöst</p>
                  <p className="font-semibold">{dialog.source.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {dialog.source._count.devices} Gerät(e) · {dialog.source.contacts.length} Kontakt(e)
                    {dialog.source.invoiceNinjaId && " · verknüpft mit Invoice Ninja"}
                  </p>
                </div>
                <div className="flex justify-center text-muted-foreground">↓ wird zusammengeführt in</div>
                <div className="rounded-md border p-3 space-y-1 border-primary">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Bleibt erhalten</p>
                  <p className="font-semibold">{dialog.target.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {dialog.target._count.devices} Gerät(e) · {dialog.target.contacts.length} Kontakt(e)
                    {dialog.target.invoiceNinjaId && " · verknüpft mit Invoice Ninja"}
                  </p>
                </div>
                {(dialog.source.invoiceNinjaId || dialog.target.invoiceNinjaId) && (
                  <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                    In Invoice Ninja wird nichts gelöscht oder verändert.
                    {!dialog.target.invoiceNinjaId && dialog.source.invoiceNinjaId &&
                      " Die Invoice-Ninja-Verknüpfung wird auf den verbleibenden Kunden übertragen."}
                  </p>
                )}
                {error && <p className="text-destructive">{error}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
                <Button onClick={handleMerge} disabled={loading}>
                  {loading ? "Zusammenführen…" : "Zusammenführen"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
