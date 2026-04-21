"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Monitor,
  Clock,
  Square,
  Building2,
  UserRound,
  Pencil,
  Trash2,
  RotateCcw,
  Plus,
  Laptop,
  User,
} from "lucide-react";
import { useTimer, formatElapsed } from "@/lib/timer-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChildSession = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  type: string;
  billed: boolean;
  billedAt: string | null;
  project?: { id: string; name: string } | null;
};

type Session = {
  id: string;
  type: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  billed: boolean;
  billedAt: string | null;
  device:   { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  contact:  { id: string; firstName: string; lastName: string } | null;
  project?: { id: string; name: string } | null;
  user: { id: string; name: string };
  children: ChildSession[];
};

type Interval = {
  id: string;
  startedAt: string;
  endedAt: string | null;
};

type ApiTargets = {
  devices:   { id: string; name: string; ipAddress: string | null; customerName: string | null }[];
  customers: { id: string; name: string }[];
  contacts:  { id: string; name: string; customerName: string }[];
  projects:  { id: string; name: string; customerName: string }[];
};

type FlatTarget = { id: string; type: "device" | "customer" | "contact"; name: string; sub?: string };

const typeLabels: Record<string, string> = {
  remote: "Remote",
  onsite: "Vor-Ort",
  phone:  "Telefon",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sessionLabel(s: Session): { icon: React.ReactNode; name: string } {
  if (s.device)   return { icon: <Monitor   className="h-4 w-4 text-muted-foreground shrink-0" />, name: s.device.name };
  if (s.contact)  return { icon: <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />, name: `${s.contact.firstName} ${s.contact.lastName}` };
  if (s.customer) return { icon: <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />, name: s.customer.name };
  return { icon: <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />, name: "—" };
}

function fmtMins(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** Sum durationMinutes of root session + all children */
function totalDuration(s: Session): number | null {
  const all = [s, ...s.children];
  const finished = all.filter(e => e.durationMinutes !== null);
  if (finished.length === 0) return null;
  return finished.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
}

/** Last endedAt among root + children */
function lastEndedAt(s: Session): string | null {
  const candidates = [s.endedAt, ...s.children.map(c => c.endedAt)].filter(Boolean) as string[];
  if (candidates.length === 0) return null;
  return candidates.sort().at(-1) ?? null;
}

/** The currently active session ID within a group (root or child without endedAt) */
function activeSessionIdInGroup(s: Session): string | null {
  if (!s.endedAt) return s.id;
  const active = s.children.find(c => !c.endedAt);
  return active?.id ?? null;
}

/** True if the group has an actively running or paused session */
function isGroupActive(s: Session): boolean {
  return activeSessionIdInGroup(s) !== null;
}

/** Convert ISO string to datetime-local value in browser local time */
function toLocalDatetimeValue(iso: string): string {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function flattenTargets(api: ApiTargets): FlatTarget[] {
  return [
    ...api.devices.map((d) => ({ id: d.id, type: "device"   as const, name: d.name, sub: d.customerName ?? d.ipAddress ?? undefined })),
    ...api.customers.map((c) => ({ id: c.id, type: "customer" as const, name: c.name })),
    ...api.contacts.map((c)  => ({ id: c.id, type: "contact"  as const, name: c.name, sub: c.customerName })),
  ];
}

function TargetIcon({ type, className }: { type: FlatTarget["type"]; className?: string }) {
  if (type === "device")   return <Laptop    className={className} />;
  if (type === "contact")  return <User      className={className} />;
  return                          <Building2 className={className} />;
}

// ─── Interval Timeline ────────────────────────────────────────────────────────

function IntervalTimeline({ intervals }: { intervals: Interval[] }) {
  const sorted = [...intervals].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  let totalWorkMins = 0;
  let totalPauseMins = 0;
  const rows: React.ReactNode[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const iv    = sorted[i];
    const start = new Date(iv.startedAt);
    const end   = iv.endedAt ? new Date(iv.endedAt) : null;
    const mins  = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
    if (mins !== null) totalWorkMins += mins;

    rows.push(
      <div key={`w-${iv.id}`} className="flex items-center gap-2 text-xs">
        <span className="text-green-600 shrink-0">▶</span>
        <span className="text-muted-foreground tabular-nums">
          {fmtTime(iv.startedAt)}
          {" – "}
          {iv.endedAt ? fmtTime(iv.endedAt) : "läuft"}
        </span>
        <span className="ml-auto text-muted-foreground">{mins !== null ? `${mins} min` : "…"}</span>
      </div>,
    );

    const next = sorted[i + 1];
    if (next && iv.endedAt) {
      const pauseMins = Math.round(
        (new Date(next.startedAt).getTime() - new Date(iv.endedAt).getTime()) / 60000,
      );
      totalPauseMins += pauseMins;
      rows.push(
        <div key={`p-${iv.id}`} className="flex items-center gap-2 text-xs text-muted-foreground/60 pl-3">
          <span className="shrink-0">⏸</span>
          <span className="tabular-nums">
            {fmtTime(iv.endedAt)}
            {" – "}
            {fmtTime(next.startedAt)}
          </span>
          <span className="ml-auto">{pauseMins} min Pause</span>
        </div>,
      );
    }
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
      {rows}
      <div className="border-t pt-2 mt-1 flex gap-4 text-xs text-muted-foreground">
        <span><span className="text-green-600 font-medium">{fmtMins(totalWorkMins)}</span> Arbeit</span>
        {totalPauseMins > 0 && (
          <span><span className="font-medium">{fmtMins(totalPauseMins)}</span> Pause</span>
        )}
      </div>
    </div>
  );
}

// ─── Stop-Dialog ──────────────────────────────────────────────────────────────

function StopButton({ sessionId, label, minMins }: { sessionId: string; label: string; minMins: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { state, elapsedMs, stop: timerStop } = useTimer();
  const [open, setOpen]       = useState(false);
  const [note, setNote]       = useState("");
  const [loading, setLoading] = useState(false);

  const isTimerSession = state.sessionId === sessionId;
  const isTooShort     = isTimerSession && minMins > 0 && elapsedMs < minMins * 60_000;

  async function handleStop() {
    setLoading(true);
    try {
      if (isTimerSession) {
        await timerStop(note);
      } else {
        await fetch(`/api/v1/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        });
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  async function handleDiscard() {
    setLoading(true);
    try {
      await fetch(`/api/v1/sessions/${sessionId}`, { method: "DELETE" });
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  const displayDuration = isTimerSession ? formatElapsed(elapsedMs) : "läuft";

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="h-7 text-xs shrink-0"
        onClick={() => setOpen(true)}
      >
        <Square className="h-3 w-3 mr-1 fill-current" />
        Beenden
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Sitzung beenden</DialogTitle></DialogHeader>

          {isTooShort && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              Die Sitzung ist kürzer als die Mindestdauer ({minMins} min). Sitzung verwerfen oder trotzdem speichern?
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Sitzung für <strong>{label}</strong> beenden?{" "}
            Laufzeit: {displayDuration}
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notiz (optional)</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder="Was wurde gemacht?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {isTooShort ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Abbrechen</Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDiscard} disabled={loading}>
                  Verwerfen
                </Button>
                <Button variant="destructive" onClick={handleStop} disabled={loading}>
                  {loading ? "Beende…" : "Speichern"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Abbrechen</Button>
                <Button variant="destructive" onClick={handleStop} disabled={loading}>
                  {loading ? "Beende…" : "Beenden"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Edit-Dialog ──────────────────────────────────────────────────────────────

type EditTarget = { id: string; startedAt: string; endedAt: string | null; type: string };
type EditSessionDetails = {
  intervals?: Interval[];
  device?: { id: string; name: string } | null;
  customer?: { id: string; name: string } | null;
  contact?: { id: string; firstName: string; lastName: string } | null;
  project?: { id: string; name: string } | null;
};

function EditButton({ entry, label }: { entry: EditTarget; label: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen]     = useState(false);

  const [startedAt,  setStartedAt]  = useState("");
  const [endedAt,    setEndedAt]    = useState("");
  const [type,       setType]       = useState(entry.type);
  const [note,       setNote]       = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [intervals,  setIntervals]  = useState<Interval[] | null>(null);
  const [apiTargets, setApiTargets] = useState<ApiTargets | null>(null);
  const [targetSearch, setTargetSearch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<FlatTarget | null>(null);
  const [projectId, setProjectId] = useState("");

  const flatTargets = useMemo(
    () => (apiTargets ? flattenTargets(apiTargets) : []),
    [apiTargets],
  );
  const filteredTargets = useMemo(() => {
    if (!targetSearch.trim()) return flatTargets;
    const q = targetSearch.toLowerCase();
    return flatTargets.filter((t) => (
      t.name.toLowerCase().includes(q) || t.sub?.toLowerCase().includes(q)
    ));
  }, [flatTargets, targetSearch]);

  function targetFromSession(data: EditSessionDetails): FlatTarget | null {
    if (data.device) return { id: data.device.id, type: "device", name: data.device.name };
    if (data.contact) {
      return {
        id: data.contact.id,
        type: "contact",
        name: `${data.contact.firstName} ${data.contact.lastName}`,
      };
    }
    if (data.customer) return { id: data.customer.id, type: "customer", name: data.customer.name };
    return null;
  }

  async function handleOpen() {
    setStartedAt(toLocalDatetimeValue(entry.startedAt));
    setEndedAt(entry.endedAt ? toLocalDatetimeValue(entry.endedAt) : "");
    setType(entry.type);
    setNote("");
    setError(null);
    setIntervals(null);
    setTargetSearch("");
    setSelectedTarget(null);
    setProjectId("");
    setOpen(true);

    // Fetch full session detail incl. intervals + available targets/projects
    try {
      const [sessionRes, targetsRes] = await Promise.all([
        fetch(`/api/v1/sessions/${entry.id}`),
        fetch("/api/v1/timer/targets"),
      ]);
      const data = await sessionRes.json();
      const targets = await targetsRes.json();
      setIntervals(data.intervals ?? []);
      setApiTargets(targets);
      setSelectedTarget(targetFromSession(data));
      setProjectId(data.project?.id ?? "");
    } catch {
      setIntervals([]);
      setApiTargets(null);
    }
  }

  function previewDuration(): string | null {
    if (!startedAt || !endedAt) return null;
    const start = new Date(startedAt);
    const end   = new Date(endedAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
    return fmtMins(Math.round((end.getTime() - start.getTime()) / 60000));
  }

  async function handleSave() {
    setError(null);
    if (!startedAt) { setError("Startzeitpunkt ist erforderlich"); return; }
    if (!endedAt)   { setError("Endzeitpunkt ist erforderlich"); return; }
    if (!selectedTarget) {
      setError("Bitte ein Ziel (Gerät, Kunde oder Ansprechpartner) auswählen");
      return;
    }
    if (new Date(endedAt) <= new Date(startedAt)) {
      setError("Endzeitpunkt muss nach dem Startzeitpunkt liegen");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/sessions/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: new Date(startedAt).toISOString(),
          endedAt:   new Date(endedAt).toISOString(),
          type,
          deviceId: selectedTarget.type === "device" ? selectedTarget.id : null,
          customerId: selectedTarget.type === "customer" ? selectedTarget.id : null,
          contactId: selectedTarget.type === "contact" ? selectedTarget.id : null,
          projectId: projectId || null,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Fehler beim Speichern");
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const preview = previewDuration();
  const hasMultipleIntervals = intervals !== null && intervals.length > 1;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
        onClick={handleOpen}
        title="Bearbeiten"
      >
        <Pencil className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teilsitzung bearbeiten</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            <strong>{label}</strong> – Zeitstempel und Typ korrigieren.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gestartet</Label>
                <Input
                  type="datetime-local"
                  value={startedAt}
                  onChange={e => setStartedAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Beendet</Label>
                <Input
                  type="datetime-local"
                  value={endedAt}
                  onChange={e => setEndedAt(e.target.value)}
                />
              </div>
            </div>

            {preview && (
              <p className="text-sm">
                Neue Dauer: <strong>{preview}</strong>
                {hasMultipleIntervals && (
                  <span className="text-muted-foreground text-xs ml-2">
                    (Pausenstruktur wird durch ein einzelnes Intervall ersetzt)
                  </span>
                )}
              </p>
            )}
            {startedAt && endedAt && !preview && (
              <p className="text-xs text-destructive">
                Endzeitpunkt muss nach dem Startzeitpunkt liegen.
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Typ</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={type}
                onChange={e => setType(e.target.value)}
              >
                <option value="remote">Remote</option>
                <option value="onsite">Vor-Ort</option>
                <option value="phone">Telefon</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Ziel <span className="text-muted-foreground font-normal">(Gerät, Kunde oder Kontakt)</span></Label>
              <Input
                placeholder="Suchen…"
                value={targetSearch}
                onChange={(e) => { setTargetSearch(e.target.value); setSelectedTarget(null); }}
              />
              {selectedTarget && (
                <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 px-3 py-2 text-sm">
                  <TargetIcon type={selectedTarget.type} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{selectedTarget.name}</span>
                  {selectedTarget.sub && <span className="text-muted-foreground text-xs">· {selectedTarget.sub}</span>}
                </div>
              )}
              {!selectedTarget && (targetSearch.trim() || !apiTargets) && (
                <div className="max-h-48 overflow-y-auto rounded-md border bg-popover shadow-sm">
                  {!apiTargets ? (
                    <p className="text-xs text-muted-foreground p-3">Lädt…</p>
                  ) : filteredTargets.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Keine Ergebnisse</p>
                  ) : (
                    filteredTargets.map((t) => (
                      <button
                        key={`${t.type}-${t.id}`}
                        onClick={() => { setSelectedTarget(t); setTargetSearch(""); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <TargetIcon type={t.type} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{t.name}</span>
                        {t.sub && <span className="text-xs text-muted-foreground truncate">{t.sub}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Projekt <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Kein Projekt</option>
                {(apiTargets?.projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{`${p.name} (${p.customerName})`}</option>
                ))}
              </select>
            </div>

            {/* Interval timeline */}
            {hasMultipleIntervals && (
              <div className="space-y-1.5">
                <Label>Arbeitszeitverlauf</Label>
                <IntervalTimeline intervals={intervals!} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Änderungsnotiz <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder="Warum wurde die Sitzung korrigiert?"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={loading || !preview}>
              {loading ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Delete-Button ────────────────────────────────────────────────────────────

function DeleteButton({ id, label, isRoot }: { id: string; label: string; isRoot?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Löschen fehlgeschlagen");
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => setOpen(true)}
        title="Löschen"
      >
        <Trash2 className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isRoot ? "Sitzungsgruppe löschen" : "Teilsitzung löschen"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isRoot
              ? <>Sitzungsgruppe für <strong>{label}</strong> wird mit allen Teilsitzungen unwiderruflich gelöscht.</>
              : <>Teilsitzung für <strong>{label}</strong> wird unwiderruflich gelöscht.</>
            }
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Lösche…" : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Restart-Button ───────────────────────────────────────────────────────────

function RestartButton({ session }: { session: Session }) {
  const { state, start } = useTimer();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const timerActive = state.status !== "idle";

  function deriveTarget() {
    if (session.device)   return { type: "device"   as const, id: session.device.id,   name: session.device.name };
    if (session.contact)  return { type: "contact"  as const, id: session.contact.id,  name: `${session.contact.firstName} ${session.contact.lastName}` };
    if (session.customer) return { type: "customer" as const, id: session.customer.id, name: session.customer.name };
    return null;
  }

  async function handleRestart() {
    const target = deriveTarget();
    if (!target || timerActive) return;
    setLoading(true);
    setError(null);
    try {
      // Always link to the root session (session.id since page only shows roots)
      await start(target, session.type as "remote" | "onsite" | "phone", session.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!deriveTarget()) return null;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary shrink-0"
        onClick={handleRestart}
        disabled={loading || timerActive}
        title={timerActive ? "Zeiterfassung läuft bereits" : "Erneut starten"}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
      {error && (
        <p className="absolute right-0 top-8 z-10 w-48 rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Log-Button (Sitzung nacherfassen) ───────────────────────────────────────

function LogButton() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open,    setOpen]    = useState(false);

  const [apiTargets,      setApiTargets]      = useState<ApiTargets | null>(null);
  const [search,          setSearch]          = useState("");
  const [selectedTarget,  setSelectedTarget]  = useState<FlatTarget | null>(null);
  const [selectedType,    setSelectedType]    = useState<"remote" | "onsite" | "phone">("remote");
  const [startedAt,       setStartedAt]       = useState("");
  const [endedAt,         setEndedAt]         = useState("");
  const [note,            setNote]            = useState("");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  // Fetch targets when dialog opens
  useEffect(() => {
    if (open && !apiTargets) {
      fetch("/api/v1/timer/targets")
        .then((r) => r.json())
        .then(setApiTargets)
        .catch(() => {});
    }
  }, [open, apiTargets]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedTarget(null);
      setStartedAt("");
      setEndedAt("");
      setNote("");
      setError(null);
    }
  }, [open]);

  const flatTargets = useMemo(() => (apiTargets ? flattenTargets(apiTargets) : []), [apiTargets]);
  const filtered    = useMemo(() => {
    if (!search.trim()) return flatTargets;
    const q = search.toLowerCase();
    return flatTargets.filter((t) => t.name.toLowerCase().includes(q) || t.sub?.toLowerCase().includes(q));
  }, [flatTargets, search]);

  function previewDuration(): string | null {
    if (!startedAt || !endedAt) return null;
    const s = new Date(startedAt);
    const e = new Date(endedAt);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
    return fmtMins(Math.round((e.getTime() - s.getTime()) / 60000));
  }

  async function handleSave() {
    setError(null);
    if (!selectedTarget)          { setError("Bitte ein Ziel auswählen");                           return; }
    if (!startedAt)                { setError("Startzeitpunkt ist erforderlich");                    return; }
    if (!endedAt)                  { setError("Endzeitpunkt ist erforderlich");                      return; }
    if (new Date(endedAt) <= new Date(startedAt)) {
      setError("Endzeitpunkt muss nach dem Startzeitpunkt liegen");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/sessions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [`${selectedTarget.type}Id`]: selectedTarget.id,
          type:      selectedType,
          startedAt: new Date(startedAt).toISOString(),
          endedAt:   new Date(endedAt).toISOString(),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Fehler beim Speichern");
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const preview = previewDuration();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Sitzung nacherfassen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sitzung nacherfassen</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Vergangene Sitzung manuell eintragen.
          </p>

          <div className="space-y-4">
            {/* Session type */}
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <div className="flex gap-2">
                {(["remote", "onsite", "phone"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={[
                      "flex-1 py-1.5 px-3 rounded-md text-sm font-medium border transition-colors",
                      selectedType === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {typeLabels[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Target search */}
            <div className="space-y-1.5">
              <Label>Ziel <span className="text-muted-foreground font-normal">(Gerät, Kunde oder Kontakt)</span></Label>
              <Input
                placeholder="Suchen…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedTarget(null); }}
              />
              {selectedTarget && (
                <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 px-3 py-2 text-sm">
                  <TargetIcon type={selectedTarget.type} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{selectedTarget.name}</span>
                  {selectedTarget.sub && <span className="text-muted-foreground text-xs">· {selectedTarget.sub}</span>}
                </div>
              )}
              {!selectedTarget && (search.trim() || !apiTargets) && (
                <div className="max-h-48 overflow-y-auto rounded-md border bg-popover shadow-sm">
                  {!apiTargets ? (
                    <p className="text-xs text-muted-foreground p-3">Lädt…</p>
                  ) : filtered.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Keine Ergebnisse</p>
                  ) : (
                    filtered.map((t) => (
                      <button
                        key={`${t.type}-${t.id}`}
                        onClick={() => { setSelectedTarget(t); setSearch(""); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <TargetIcon type={t.type} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{t.name}</span>
                        {t.sub && <span className="text-xs text-muted-foreground truncate">{t.sub}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gestartet</Label>
                <Input
                  type="datetime-local"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Beendet</Label>
                <Input
                  type="datetime-local"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                />
              </div>
            </div>

            {preview && (
              <p className="text-sm">Dauer: <strong>{preview}</strong></p>
            )}
            {startedAt && endedAt && !preview && (
              <p className="text-xs text-destructive">Endzeitpunkt muss nach dem Startzeitpunkt liegen.</p>
            )}

            {/* Note */}
            <div className="space-y-1.5">
              <Label>Notiz <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder="Was wurde gemacht?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={loading || !selectedTarget || !preview}>
              {loading ? "Speichern…" : "Erfassen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Sub-session row ──────────────────────────────────────────────────────────

function SubSessionRow({
  child,
  label,
  canEdit,
  isActive,
}: {
  child: ChildSession;
  label: string;
  canEdit: boolean;
  isActive: boolean;
}) {
  const duration = child.durationMinutes !== null ? fmtMins(child.durationMinutes) : null;

  return (
    <div className="flex items-center gap-3 py-1.5 text-sm border-t border-border/50 ml-6">
      <div className={[
        "h-1.5 w-1.5 rounded-full shrink-0",
        isActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40",
      ].join(" ")} />
      <span className="tabular-nums text-xs text-muted-foreground min-w-[90px]">
        {fmtTime(child.startedAt)}
        {" – "}
        {child.endedAt ? fmtTime(child.endedAt) : "läuft"}
      </span>
      {duration && <span className="text-xs text-muted-foreground">{duration}</span>}
      <Badge variant="outline" className="text-xs h-4 px-1">{typeLabels[child.type] ?? child.type}</Badge>
      {canEdit && !child.billed && !isActive && (
        <div className="flex items-center gap-0.5 ml-auto">
          <EditButton entry={child} label={label} />
          <DeleteButton id={child.id} label={label} />
        </div>
      )}
    </div>
  );
}

// ─── SessionList ──────────────────────────────────────────────────────────────

export function SessionList({
  sessions,
  canEdit,
  minMins = 0,
}: {
  sessions: Session[];
  canEdit: boolean;
  minMins?: number;
}) {
  const { state, elapsedMs } = useTimer();

  const active   = sessions.filter(isGroupActive);
  const finished = sessions.filter(s => !isGroupActive(s));

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (active.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [active.length]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      {canEdit && (
        <div className="flex justify-end">
          <LogButton />
        </div>
      )}

      {sessions.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Noch keine Sitzungen aufgezeichnet.</p>
          <p className="text-xs mt-1">Starte eine Sitzung über die Gerätekarte, Kunden- oder Kontaktseite.</p>
        </div>
      )}

      {/* ── Aktive Sitzungen ── */}
      {active.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Aktive Sitzungen ({active.length})
          </h2>
          {active.map((s) => {
            const { icon, name }   = sessionLabel(s);
            const activeId         = activeSessionIdInGroup(s)!;
            const isTimerRunning   = state.sessionId === activeId;
            const isPaused         = isTimerRunning && state.status === "paused";
            const elapsed          = isTimerRunning
              ? formatElapsed(elapsedMs)
              : formatElapsed(Math.max(0, now - new Date(s.startedAt).getTime()));
            const hasMultiple      = s.children.length > 0;

            return (
              <Card key={s.id} className={isPaused ? "border-amber-500/40 bg-amber-500/5" : "border-primary/40 bg-primary/5"}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-4">
                    <div className={[
                      "h-2 w-2 rounded-full shrink-0",
                      isPaused ? "bg-amber-500" : "bg-green-500 animate-pulse",
                    ].join(" ")} />
                    {icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{name}</span>
                        <Badge variant="default" className="text-xs">{typeLabels[s.type] ?? s.type}</Badge>
                        {s.project && (
                          <Badge variant="outline" className="text-xs">{s.project.name}</Badge>
                        )}
                        {isPaused && (
                          <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">Pausiert</Badge>
                        )}
                        {hasMultiple && (
                          <Badge variant="outline" className="text-xs">{s.children.length + 1} Teilsitzungen</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Gestartet {new Date(s.startedAt).toLocaleString("de-DE")}
                        {" · "}<span className="tabular-nums font-mono">{elapsed}</span>
                        {" · "}{s.user.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && <StopButton sessionId={activeId} label={name} minMins={minMins} />}
                    </div>
                  </div>

                  {/* Sub-sessions — always visible when multiple exist */}
                  {hasMultiple && (
                    <div className="mt-2">
                      <SubSessionRow
                        child={{ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt, durationMinutes: s.durationMinutes, type: s.type, billed: s.billed, billedAt: s.billedAt }}
                        label={name}
                        canEdit={canEdit}
                        isActive={activeId === s.id}
                      />
                      {s.children.map(c => (
                        <SubSessionRow key={c.id} child={c} label={name} canEdit={canEdit} isActive={activeId === c.id} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Verlauf ── */}
      {finished.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Verlauf ({finished.length})
          </h2>
          {finished.map((s) => {
            const { icon, name } = sessionLabel(s);
            const canEditThis    = canEdit && !s.billed;
            const total          = totalDuration(s);
            const lastEnd        = lastEndedAt(s);
            const hasMultiple    = s.children.length > 0;
            const dateStr        = new Date(s.startedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

            return (
              <Card key={s.id}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-4">
                    {icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{name}</span>
                        <Badge variant="outline" className="text-xs">{typeLabels[s.type] ?? s.type}</Badge>
                        {s.project && (
                          <Badge variant="outline" className="text-xs">{s.project.name}</Badge>
                        )}
                        {hasMultiple && (
                          <Badge variant="outline" className="text-xs">{s.children.length + 1} Teilsitzungen</Badge>
                        )}
                        {s.billed && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                            Abgerechnet
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {dateStr}
                        {" · "}
                        {fmtTime(s.startedAt)}
                        {" – "}
                        {lastEnd ? fmtTime(lastEnd) : "—"}
                        {total !== null && ` · ${fmtMins(total)}`}
                        {" · "}{s.user.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {canEdit && <RestartButton session={s} />}
                      {canEditThis && !hasMultiple && (
                        <EditButton
                          entry={{ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt, type: s.type }}
                          label={name}
                        />
                      )}
                      {canEditThis && <DeleteButton id={s.id} label={name} isRoot={hasMultiple} />}
                    </div>
                  </div>

                  {/* Sub-sessions — always visible when multiple exist */}
                  {hasMultiple && (
                    <div className="mt-2">
                      <SubSessionRow
                        child={{ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt, durationMinutes: s.durationMinutes, type: s.type, billed: s.billed, billedAt: s.billedAt }}
                        label={name}
                        canEdit={canEdit}
                        isActive={false}
                      />
                      {s.children.map(c => (
                        <SubSessionRow key={c.id} child={c} label={name} canEdit={canEdit} isActive={false} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
