"use client";

import { useEffect, useState } from "react";
import { Users, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { normalizeEmail, normalizePhoneKey } from "@/lib/contact-name";

type ContactEntry = {
  id: string;
  firstName: string;
  lastName: string;
  emails: string[];
  email: string | null;
  phones: string[];
  phone: string | null;
  mobile: string | null;
  invoiceNinjaId: string | null;
  zammadUserId: number | null;
  createdAt: string;
  customer: { id: string; name: string };
  _count: { sessions: number };
};

type DuplicateGroup = ContactEntry[];

function displayEmails(c: ContactEntry): string[] {
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

function displayPhones(c: ContactEntry): string[] {
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

export function ContactDuplicatesMerger() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Map of groupIndex → selected primary contact id
  const [primaryIds, setPrimaryIds] = useState<Record<number, string>>({});
  const [merging, setMerging] = useState<Record<number, boolean>>({});
  const [merged, setMerged] = useState<Record<number, boolean>>({});
  const [mergeErrors, setMergeErrors] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/contacts/duplicates");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data: DuplicateGroup[] = await res.json();
      setGroups(data);
      // Default: oldest contact (first by createdAt) is primary
      const defaults: Record<number, string> = {};
      data.forEach((group, i) => {
        defaults[i] = group[0].id;
      });
      setPrimaryIds(defaults);
    } catch {
      setError("Duplikate konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleMerge(groupIndex: number) {
    const primaryId = primaryIds[groupIndex];
    const group = groups[groupIndex];
    if (!primaryId || !group) return;

    setMerging((m) => ({ ...m, [groupIndex]: true }));
    setMergeErrors((e) => ({ ...e, [groupIndex]: "" }));

    const duplicates = group.filter((c) => c.id !== primaryId);
    try {
      for (const dup of duplicates) {
        const res = await fetch("/api/v1/contacts/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ primaryId, duplicateId: dup.id }),
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          throw new Error(data.error ?? "Unbekannter Fehler");
        }
      }
      setMerged((m) => ({ ...m, [groupIndex]: true }));
    } catch (err) {
      setMergeErrors((e) => ({
        ...e,
        [groupIndex]: err instanceof Error ? err.message : "Fehler beim Zusammenführen",
      }));
    } finally {
      setMerging((m) => ({ ...m, [groupIndex]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Duplikate werden gesucht…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive py-8">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  const pendingGroups = groups.filter((_, i) => !merged[i]);

  if (pendingGroups.length === 0) {
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 py-8">
        <CheckCircle className="h-5 w-5" />
        <span className="font-medium">Keine Duplikate gefunden.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {pendingGroups.length} Duplikat-{pendingGroups.length === 1 ? "Gruppe" : "Gruppen"} gefunden.
      </p>

      {groups.map((group, groupIndex) => {
        if (merged[groupIndex]) return null;
        const primaryId = primaryIds[groupIndex] ?? group[0].id;
        const isMerging = !!merging[groupIndex];
        const mergeError = mergeErrors[groupIndex];

        return (
          <div
            key={groupIndex}
            className="rounded-xl border border-border bg-card p-4 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">
                {group[0].firstName} {group[0].lastName}
              </span>
              <span className="text-xs text-muted-foreground">
                bei {group[0].customer.name}
              </span>
              <span className="ml-auto text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                {group.length} Duplikate
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.map((contact) => {
                const isPrimary = contact.id === primaryId;
                return (
                  <button
                    key={contact.id}
                    onClick={() =>
                      setPrimaryIds((p) => ({ ...p, [groupIndex]: contact.id }))
                    }
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      isPrimary
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                      </span>
                      {isPrimary && (
                        <span className="text-xs font-semibold text-primary">
                          Primär
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {displayEmails(contact).map((em) => (
                        <p key={`${contact.id}-email-${em}`}>✉ {em}</p>
                      ))}
                      {displayPhones(contact).map((ph) => (
                        <p key={`${contact.id}-phone-${ph}`}>📞 {ph}</p>
                      ))}
                      <p className="pt-0.5">
                        {contact._count.sessions} Sitzung{contact._count.sessions !== 1 ? "en" : ""}
                      </p>
                      {contact.invoiceNinjaId && (
                        <p className="font-mono">IN: {contact.invoiceNinjaId}</p>
                      )}
                      {contact.zammadUserId && (
                        <p className="font-mono">Zammad: #{contact.zammadUserId}</p>
                      )}
                      <p className="text-muted-foreground/60">
                        Erstellt: {new Date(contact.createdAt).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {mergeError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {mergeError}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Primären Kontakt auswählen, dann zusammenführen.
                Alle Sitzungen werden dem Primär-Kontakt zugeordnet.
              </p>
              <button
                onClick={() => void handleMerge(groupIndex)}
                disabled={isMerging}
                className="rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/90 disabled:opacity-50 transition-colors ml-4 shrink-0"
              >
                {isMerging ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Wird zusammengeführt…
                  </span>
                ) : (
                  "Zusammenführen"
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
