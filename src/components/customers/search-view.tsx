"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Building2, UserRound, Monitor, ExternalLink,
  Phone, Mail, Smartphone, ChevronRight, Play, Loader2,
} from "lucide-react";
import { buildDeeplink, type RemoteType } from "@/components/devices/remote-deeplink";
import { StartSessionDialog } from "@/components/customers/start-session-dialog";
import { normalizeEmail, normalizePhoneKey } from "@/lib/contact-name";

type RemoteId = { id: string; type: string; remoteId: string; label: string | null };
type ContactRef = { id: string; firstName: string; lastName: string } | null;
type Device = {
  id: string;
  name: string;
  ipAddress: string | null;
  remoteIds: RemoteId[];
  contact: ContactRef;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  emails: string[];
  email: string | null;
  phones: string[];
  phone: string | null;
  mobile: string | null;
  notes: string | null;
};

type CustomerResult = {
  id: string;
  name: string;
  notes: string | null;
  contacts: Contact[];
  devices: Device[];
};

type ContactResult = {
  id: string;
  firstName: string;
  lastName: string;
  emails: string[];
  email: string | null;
  phones: string[];
  phone: string | null;
  mobile: string | null;
  notes: string | null;
  customer: { id: string; name: string };
  devices: Device[];
  customerDevices: Device[];
};

type SearchResults = {
  customers: CustomerResult[];
  contacts: ContactResult[];
};

function displayEmails(c: { emails: string[]; email: string | null }): string[] {
  const raw = [...c.emails, c.email];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const t = v?.trim();
    if (!t) continue;
    const k = normalizeEmail(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function displayPhones(c: { phones: string[]; phone: string | null; mobile: string | null }): string[] {
  const raw = [...c.phones, c.phone, c.mobile];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const t = v?.trim();
    if (!t) continue;
    const k = normalizePhoneKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function DeviceRow({ device }: { device: Device }) {
  const [sessionOpen, setSessionOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 py-1.5 border-b last:border-0">
      <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{device.name}</span>
        {device.contact && (
          <span className="ml-2 text-xs text-muted-foreground">
            ({device.contact.firstName} {device.contact.lastName})
          </span>
        )}
        {device.remoteIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
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
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs shrink-0"
        onClick={() => setSessionOpen(true)}
      >
        <Play className="h-3 w-3 mr-1" />
        Sitzung
      </Button>
      <StartSessionDialog
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        context={{ kind: "device", id: device.id, name: device.name }}
      />
    </div>
  );
}

function CustomerCard({ customer }: { customer: CustomerResult }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="font-semibold">{customer.name}</p>
              {customer.notes && (
                <p className="text-xs text-muted-foreground">{customer.notes}</p>
              )}
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" render={<Link href={`/customers/${customer.id}`} />}>
            Details <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>

        {customer.contacts.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ansprechpartner</p>
            <div className="flex flex-wrap gap-2">
              {customer.contacts.map(c => (
                <div key={c.id} className="flex items-center gap-1.5 text-xs bg-muted rounded-md px-2 py-1">
                  <UserRound className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{c.firstName} {c.lastName}</span>
                  {displayPhones(c).map(ph => {
                    const isMobile = !!c.mobile?.trim() && normalizePhoneKey(ph) === normalizePhoneKey(c.mobile);
                    return (
                      <a
                        key={`${c.id}-ph-${ph}`}
                        href={`tel:${ph}`}
                        className="text-muted-foreground hover:text-foreground"
                        title={ph}
                      >
                        {isMobile ? <Smartphone className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                      </a>
                    );
                  })}
                  {displayEmails(c).map(em => (
                    <a
                      key={`${c.id}-em-${em}`}
                      href={`mailto:${em}`}
                      className="text-muted-foreground hover:text-foreground"
                      title={em}
                    >
                      <Mail className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {customer.devices.length > 0 && (
          <div className="space-y-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Geräte ({customer.devices.length})
            </p>
            <div className="rounded-md border divide-y">
              {customer.devices.map(d => (
                <DeviceRow key={d.id} device={d} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContactCard({ contact }: { contact: ContactResult }) {
  // Show devices assigned directly to this contact, or all customer devices if none
  const devices = contact.devices.length > 0 ? contact.devices : contact.customerDevices;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
              {contact.firstName[0]}{contact.lastName[0]}
            </div>
            <div>
              <p className="font-semibold">{contact.firstName} {contact.lastName}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {displayPhones(contact).map(ph => {
                  const isMobile = !!contact.mobile?.trim()
                    && normalizePhoneKey(ph) === normalizePhoneKey(contact.mobile);
                  return (
                    <a
                      key={`${contact.id}-ph-${ph}`}
                      href={`tel:${ph}`}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {isMobile ? <Smartphone className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                      {ph}
                    </a>
                  );
                })}
                {displayEmails(contact).map(em => (
                  <a
                    key={`${contact.id}-em-${em}`}
                    href={`mailto:${em}`}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" /> {em}
                  </a>
                ))}
              </div>
              {contact.notes && (
                <p className="text-xs text-muted-foreground mt-0.5">{contact.notes}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs" render={<Link href={`/customers/${contact.customer.id}/contacts/${contact.id}`} />}>
              Details <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" render={<Link href={`/customers/${contact.customer.id}`} />}>
              {contact.customer.name}
            </Button>
          </div>
        </div>

        {devices.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Geräte
            </p>
            <div className="rounded-md border divide-y">
              {devices.map(d => (
                <DeviceRow key={d.id} device={d} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SearchView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const total = (results?.customers.length ?? 0) + (results?.contacts.length ?? 0);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        <Input
          className="pl-9 pr-9 h-11 text-base"
          placeholder="Firmenname oder Ansprechpartner suchen…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query.trim().length >= 2 && !loading && results && total === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Keine Ergebnisse für <strong>&ldquo;{query}&rdquo;</strong></p>
        </div>
      )}

      {results && results.customers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              Unternehmen
              <Badge variant="secondary" className="ml-2">{results.customers.length}</Badge>
            </h2>
          </div>
          <div className="space-y-3">
            {results.customers.map(c => (
              <CustomerCard key={c.id} customer={c} />
            ))}
          </div>
        </div>
      )}

      {results && results.contacts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              Ansprechpartner
              <Badge variant="secondary" className="ml-2">{results.contacts.length}</Badge>
            </h2>
          </div>
          <div className="space-y-3">
            {results.contacts.map(c => (
              <ContactCard key={c.id} contact={c} />
            ))}
          </div>
        </div>
      )}

      {!results && query.trim().length < 2 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Mindestens 2 Zeichen eingeben um zu suchen</p>
          <p className="text-xs mt-1 opacity-70">Suche in Firmennamen, Vor- und Nachnamen, Telefonnummern und E-Mail-Adressen</p>
        </div>
      )}
    </div>
  );
}
