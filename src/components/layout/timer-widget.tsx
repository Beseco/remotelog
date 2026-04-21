"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  Pause,
  Square,
  Loader2,
  Search,
  Monitor,
  Building2,
  UserRound,
  Trash2,
  RotateCcw,
  Clock,
} from "lucide-react";
import {
  useTimer,
  formatElapsed,
  type TimerTarget,
  type TimerState,
} from "@/lib/timer-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type RemoteIdEntry = { type: string; remoteId: string; label: string | null };

type Targets = {
  devices:   { id: string; name: string; ipAddress: string | null; customerName: string | null; remoteIds: RemoteIdEntry[] }[];
  customers: { id: string; name: string }[];
  contacts:  { id: string; name: string; customerName: string }[];
};

const typeLabels: Record<string, string> = {
  remote: "Remote",
  onsite: "Vor-Ort",
  phone:  "Telefon",
};

// ─── Start-Dialog ─────────────────────────────────────────────────────────────

function StartDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { start } = useTimer();
  const [targets,     setTargets]     = useState<Targets | null>(null);
  const [query,       setQuery]       = useState("");
  const [selected,    setSelected]    = useState<TimerTarget | null>(null);
  const [sessionType, setSessionType] = useState<TimerState["sessionType"]>("remote");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch targets when dialog opens
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(null);
    setError(null);
    fetch("/api/v1/timer/targets")
      .then(r => r.json())
      .then(setTargets);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Filtered results
  const q = query.toLowerCase().trim();
  const filtered = targets ? {
    devices:   targets.devices  .filter(d => !q || d.name.toLowerCase().includes(q) || (d.customerName?.toLowerCase().includes(q) ?? false) || (d.ipAddress?.toLowerCase().includes(q) ?? false) || d.remoteIds.some(r => r.remoteId.toLowerCase().includes(q) || (r.label?.toLowerCase().includes(q) ?? false))),
    customers: targets.customers.filter(c => !q || c.name.toLowerCase().includes(q)),
    contacts:  targets.contacts .filter(c => !q || c.name.toLowerCase().includes(q) || c.customerName.toLowerCase().includes(q)),
  } : null;

  const totalResults = filtered
    ? filtered.devices.length + filtered.customers.length + filtered.contacts.length
    : 0;

  async function handleStart() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await start(selected, sessionType);
      onClose();
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
          <DialogTitle>Zeiterfassung starten</DialogTitle>
        </DialogHeader>

        {/* Session type */}
        <div className="flex gap-2">
          {(["remote", "onsite", "phone"] as const).map(t => (
            <button
              key={t}
              onClick={() => setSessionType(t)}
              className={[
                "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                sessionType === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-muted",
              ].join(" ")}
            >
              {typeLabels[t]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Gerät, Kunde oder Ansprechpartner suchen…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); }}
          />
        </div>

        {/* Results list */}
        <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
          {!filtered ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Lade…
            </div>
          ) : totalResults === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Keine Ergebnisse
            </div>
          ) : (
            <>
              {filtered.devices.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">
                    Geräte
                  </div>
                  {filtered.devices.map(d => {
                    const isSelected = selected?.id === d.id && selected?.type === "device";
                    return (
                      <button
                        key={d.id}
                        className={[
                          "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors",
                          isSelected ? "bg-primary/10 font-medium" : "",
                        ].join(" ")}
                        onClick={() => setSelected({ type: "device", id: d.id, name: d.name })}
                      >
                        <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{d.name}</span>
                        {q && (d.ipAddress?.toLowerCase().includes(q) || d.remoteIds.some(r => r.remoteId.toLowerCase().includes(q) || (r.label?.toLowerCase().includes(q) ?? false))) ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[120px] font-mono">
                            {d.ipAddress?.toLowerCase().includes(q)
                              ? d.ipAddress
                              : (() => { const m = d.remoteIds.find(r => r.remoteId.toLowerCase().includes(q) || (r.label?.toLowerCase().includes(q) ?? false)); return m ? (m.label ?? m.remoteId) : null; })()
                            }
                          </span>
                        ) : d.customerName ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                            {d.customerName}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
              {filtered.customers.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">
                    Kunden
                  </div>
                  {filtered.customers.map(c => {
                    const isSelected = selected?.id === c.id && selected?.type === "customer";
                    return (
                      <button
                        key={c.id}
                        className={[
                          "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors",
                          isSelected ? "bg-primary/10 font-medium" : "",
                        ].join(" ")}
                        onClick={() => setSelected({ type: "customer", id: c.id, name: c.name })}
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {filtered.contacts.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">
                    Ansprechpartner
                  </div>
                  {filtered.contacts.map(c => {
                    const isSelected = selected?.id === c.id && selected?.type === "contact";
                    return (
                      <button
                        key={c.id}
                        className={[
                          "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors",
                          isSelected ? "bg-primary/10 font-medium" : "",
                        ].join(" ")}
                        onClick={() => setSelected({ type: "contact", id: c.id, name: c.name })}
                      >
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                          {c.customerName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {selected && (
          <p className="text-sm text-muted-foreground">
            Ausgewählt: <strong>{selected.name}</strong> · {typeLabels[sessionType]}
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleStart} disabled={!selected || loading}>
            {loading
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Starte…</>
              : <><Play className="h-4 w-4 mr-1.5 fill-current" />Starten</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Recent-Sessions-Dialog ───────────────────────────────────────────────────

type RecentSession = {
  id: string;
  type: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number | null;
  parentSessionId: string | null;
  device:   { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  contact:  { id: string; firstName: string; lastName: string } | null;
  user:     { id: string; name: string };
};

function recentTarget(s: RecentSession): TimerTarget | null {
  if (s.device)   return { type: "device",   id: s.device.id,   name: s.device.name };
  if (s.contact)  return { type: "contact",  id: s.contact.id,  name: `${s.contact.firstName} ${s.contact.lastName}` };
  if (s.customer) return { type: "customer", id: s.customer.id, name: s.customer.name };
  return null;
}

function recentIcon(s: RecentSession) {
  if (s.device)   return <Monitor   className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (s.contact)  return <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (s.customer) return <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function fmtDuration(minutes: number | null, startedAt: string, endedAt: string): string {
  const mins = minutes ?? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function RecentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { start } = useTimer();
  const [sessions,  setSessions]  = useState<RecentSession[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [starting,  setStarting]  = useState<string | null>(null);  // session id being started
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    fetch("/api/v1/sessions/recent")
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); })
      .catch(() => setError("Sitzungen konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleRestart(s: RecentSession) {
    const target = recentTarget(s);
    if (!target) return;
    setStarting(s.id);
    setError(null);
    try {
      // Link to root session so all restarts are grouped together
      const rootId = s.parentSessionId ?? s.id;
      await start(target, s.type as TimerState["sessionType"], rootId);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Erneut starten
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          Letzte Sitzungen – klicke auf eine um sie neu zu starten.
        </p>

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade…
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground text-sm gap-2">
              <Clock className="h-6 w-6 opacity-40" />
              Keine Sitzungen vorhanden
            </div>
          ) : (
            sessions.map(s => {
              const target = recentTarget(s);
              if (!target) return null;
              const isStarting = starting === s.id;
              return (
                <button
                  key={s.id}
                  className="flex items-center gap-3 w-full rounded-lg border px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors disabled:opacity-50"
                  onClick={() => handleRestart(s)}
                  disabled={!!starting}
                >
                  {recentIcon(s)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{target.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {typeLabels[s.type] ?? s.type}
                      {" · "}
                      {new Date(s.startedAt).toLocaleDateString("de-DE")}
                      {" · "}
                      {fmtDuration(s.durationMinutes, s.startedAt, s.endedAt)}
                    </div>
                  </div>
                  {isStarting
                    ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    : <RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  }
                </button>
              );
            })
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stop-Dialog ──────────────────────────────────────────────────────────────

function StopDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state, elapsedMs, stop, discard } = useTimer();
  const router = useRouter();
  const [note,     setNote]     = useState("");
  const [saving,   setSaving]   = useState(false);
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      await stop(note);
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard() {
    setDropping(true);
    try {
      await discard();
      onClose();
    } finally {
      setDropping(false);
    }
  }

  const netMinutes = Math.round(elapsedMs / 60000);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Zeiterfassung beenden</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Betreff</span>
              <span className="font-medium">{state.target?.name ?? "–"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Typ</span>
              <span>{typeLabels[state.sessionType] ?? state.sessionType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Netto-Zeit</span>
              <span className="font-bold tabular-nums">{formatElapsed(elapsedMs)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Minuten</span>
              <span>{netMinutes} min</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notiz <span className="font-normal text-muted-foreground">(optional)</span></label>
            <textarea
              className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder="Was wurde gemacht?"
              value={note}
              onChange={e => setNote(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive mr-auto"
            disabled={dropping || saving}
            onClick={handleDiscard}
          >
            {dropping
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><Trash2 className="h-4 w-4 mr-1.5" />Verwerfen</>
            }
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving || dropping}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || dropping}>
            {saving
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Speichern…</>
              : <><Square className="h-4 w-4 mr-1.5 fill-current" />Speichern</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Timer-Widget ─────────────────────────────────────────────────────────────

export function TimerWidget() {
  const { state, elapsedMs, pause, resume } = useTimer();
  const [startOpen,  setStartOpen]  = useState(false);
  const [stopOpen,   setStopOpen]   = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);

  // Prevent hydration mismatch – render nothing on server
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const { status, target } = state;

  // ── Idle ──
  if (status === "idle") {
    return (
      <>
        <button
          onClick={() => setRecentOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-muted-foreground/40 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          title="Letzte Sitzung erneut starten"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
        <button
          onClick={() => setStartOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-muted-foreground/40 px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          title="Zeiterfassung starten"
        >
          <Play className="h-3 w-3" />
          <span className="hidden sm:inline">Zeiterfassung</span>
        </button>
        <StartDialog open={startOpen} onClose={() => setStartOpen(false)} />
        <RecentDialog open={recentOpen} onClose={() => setRecentOpen(false)} />
      </>
    );
  }

  // ── Running / Paused ──
  const isRunning = status === "running";

  return (
    <>
      <div className={[
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        isRunning
          ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      ].join(" ")}>

        {/* Status dot */}
        <span className={[
          "h-1.5 w-1.5 rounded-full shrink-0",
          isRunning ? "bg-green-500 animate-pulse" : "bg-amber-500",
        ].join(" ")} />

        {/* Target name */}
        {target && (
          <span className="hidden sm:block max-w-[120px] truncate">
            {target.name}
          </span>
        )}

        {/* Elapsed time */}
        <span className="tabular-nums font-mono min-w-[52px] text-center">
          {formatElapsed(elapsedMs)}
        </span>

        {/* Pause / Resume */}
        <button
          onClick={isRunning ? pause : resume}
          className="ml-0.5 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={isRunning ? "Pausieren" : "Fortsetzen"}
        >
          {isRunning
            ? <Pause  className="h-3 w-3 fill-current" />
            : <Play   className="h-3 w-3 fill-current" />
          }
        </button>

        {/* Stop */}
        <button
          onClick={() => setStopOpen(true)}
          className="rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title="Beenden"
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      </div>

      <StopDialog open={stopOpen} onClose={() => setStopOpen(false)} />
    </>
  );
}
