"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useTimer,
  formatElapsed,
  type TimerTarget,
  type TimerState,
} from "@/lib/timer-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Square,
  Plus,
  RotateCcw,
  Laptop,
  ExternalLink,
  MonitorDot,
  User,
  Building2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionType = TimerState["sessionType"];

type FlatTarget = TimerTarget & { sub?: string };

type ApiTargets = {
  minMins: number;
  devices: { id: string; name: string; ipAddress: string | null; customerName: string | null }[];
  customers: { id: string; name: string }[];
  contacts: { id: string; name: string; customerName: string }[];
};

type RecentSession = {
  id: string;
  type: string;
  durationMinutes: number | null;
  device?: { id: string; name: string } | null;
  customer?: { id: string; name: string } | null;
  contact?: { id: string; firstName: string; lastName: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "Vor-Ort" },
  { value: "phone", label: "Telefon" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flattenTargets(api: ApiTargets): FlatTarget[] {
  const devices: FlatTarget[] = api.devices.map((d) => ({
    type: "device",
    id: d.id,
    name: d.name,
    sub: d.customerName ?? d.ipAddress ?? undefined,
  }));
  const customers: FlatTarget[] = api.customers.map((c) => ({
    type: "customer",
    id: c.id,
    name: c.name,
  }));
  const contacts: FlatTarget[] = api.contacts.map((c) => ({
    type: "contact",
    id: c.id,
    name: c.name,
    sub: c.customerName,
  }));
  return [...devices, ...customers, ...contacts];
}

function targetFromRecent(s: RecentSession): FlatTarget | null {
  if (s.device) return { type: "device", id: s.device.id, name: s.device.name };
  if (s.contact)
    return {
      type: "contact",
      id: s.contact.id,
      name: `${s.contact.firstName} ${s.contact.lastName}`,
    };
  if (s.customer) return { type: "customer", id: s.customer.id, name: s.customer.name };
  return null;
}

function TargetIcon({ type, className }: { type: FlatTarget["type"]; className?: string }) {
  if (type === "device") return <Laptop className={cn("shrink-0", className)} />;
  if (type === "contact") return <User className={cn("shrink-0", className)} />;
  return <Building2 className={cn("shrink-0", className)} />;
}

function formatDuration(mins: number | null): string {
  if (!mins) return "–";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m > 0 ? `${m}min` : ""}`.trim();
  return `${m}min`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MobilePage() {
  const { state, elapsedMs, start, pause, resume, stop, discard } = useTimer();
  const { status, target, sessionType } = state;
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isActive = isRunning || isPaused;

  // Sheet visibility
  const [showStart, setShowStart] = useState(false);
  const [showStop, setShowStop] = useState(false);

  // Org settings
  const [minMins, setMinMins] = useState(0);

  // Start-sheet state
  const [apiTargets, setApiTargets] = useState<ApiTargets | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<FlatTarget | null>(null);
  const [selectedType, setSelectedType] = useState<SessionType>("remote");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  // Stop-sheet state
  const [note, setNote] = useState("");
  const [stopping, setStopping] = useState(false);

  // Recent sessions
  const [recent, setRecent] = useState<RecentSession[]>([]);

  // Fetch recent sessions when status changes (e.g. after stop)
  useEffect(() => {
    fetch("/api/v1/sessions/recent")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setRecent(data.slice(0, 5)) : null)
      .catch(() => {});
  }, [status]);

  // Fetch targets when start sheet opens
  useEffect(() => {
    if (showStart && !apiTargets) {
      fetch("/api/v1/timer/targets")
        .then((r) => r.json())
        .then((data: ApiTargets) => {
          setApiTargets(data);
          if (data.minMins) setMinMins(data.minMins);
        })
        .catch(() => {});
    }
  }, [showStart, apiTargets]);

  // Reset start-sheet state when closed
  useEffect(() => {
    if (!showStart) {
      setSearch("");
      setSelectedTarget(null);
      setStartError("");
    }
  }, [showStart]);

  // Reset stop-sheet state when closed
  useEffect(() => {
    if (!showStop) setNote("");
  }, [showStop]);

  // Filtered flat targets
  const flatTargets = useMemo(() => (apiTargets ? flattenTargets(apiTargets) : []), [apiTargets]);
  const filteredTargets = useMemo(() => {
    if (!search.trim()) return flatTargets;
    const q = search.toLowerCase();
    return flatTargets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.sub?.toLowerCase().includes(q)
    );
  }, [flatTargets, search]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleStart() {
    if (!selectedTarget) return;
    setStartError("");
    setStarting(true);
    try {
      await start(selectedTarget, selectedType);
      setShowStart(false);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Fehler beim Starten");
    } finally {
      setStarting(false);
    }
  }

  async function handleQuickRestart(session: RecentSession) {
    const t = targetFromRecent(session);
    if (!t) return;
    try {
      await start(t, session.type as SessionType);
    } catch {
      /* ignore */
    }
  }

  async function handleStop() {
    setStopping(true);
    try {
      await stop(note.trim() || undefined);
      setShowStop(false);
    } finally {
      setStopping(false);
    }
  }

  async function handleDiscard() {
    await discard();
    setShowStop(false);
  }

  function handleFullView() {
    document.cookie = "prefer-full-view=1; path=/; max-age=31536000";
    window.location.href = "/";
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 h-12 shrink-0 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <MonitorDot className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">RemoteLog</span>
        </div>
        {isActive && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              isRunning ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            )}
          >
            {isRunning ? "Läuft" : "Pausiert"}
          </span>
        )}
      </header>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        {isActive ? (
          /* ── Active Session View ── */
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-8 gap-6">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-block h-2.5 w-2.5 rounded-full",
                  isRunning ? "bg-green-500 animate-pulse" : "bg-amber-400"
                )}
              />
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {isRunning ? "Läuft" : "Pausiert"}
              </span>
            </div>

            {/* Target info */}
            <div className="text-center space-y-1">
              <p className="text-xl font-bold">{target?.name ?? "–"}</p>
              <span
                className={cn(
                  "inline-block text-xs px-2 py-0.5 rounded-full font-medium",
                  sessionType === "remote" && "bg-blue-100 text-blue-700",
                  sessionType === "onsite" && "bg-green-100 text-green-700",
                  sessionType === "phone" && "bg-purple-100 text-purple-700"
                )}
              >
                {SESSION_TYPES.find((t) => t.value === sessionType)?.label}
              </span>
            </div>

            {/* Live clock */}
            <div
              className={cn(
                "font-mono text-6xl font-bold tabular-nums tracking-tight",
                isRunning ? "text-green-600" : "text-amber-500"
              )}
            >
              {formatElapsed(elapsedMs)}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 w-full max-w-xs">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 h-14 text-base gap-2"
                onClick={isPaused ? resume : pause}
              >
                {isPaused ? (
                  <>
                    <Play className="h-5 w-5" />
                    Fortsetzen
                  </>
                ) : (
                  <>
                    <Pause className="h-5 w-5" />
                    Pause
                  </>
                )}
              </Button>

              <Button
                variant="destructive"
                size="lg"
                className="flex-1 h-14 text-base gap-2"
                onClick={() => setShowStop(true)}
              >
                <Square className="h-5 w-5" />
                Stoppen
              </Button>
            </div>
          </div>
        ) : (
          /* ── Idle View ── */
          <div className="flex flex-col px-4 py-6 gap-6">
            {/* Start button */}
            <Button
              size="lg"
              className="w-full h-16 text-lg gap-2"
              onClick={() => setShowStart(true)}
            >
              <Plus className="h-6 w-6" />
              Neue Sitzung starten
            </Button>

            {/* Recent sessions */}
            {recent.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Zuletzt
                </p>
                <div className="space-y-2">
                  {recent.map((s) => {
                    const t = targetFromRecent(s);
                    if (!t) return null;
                    const typeLabel = SESSION_TYPES.find((x) => x.value === s.type)?.label ?? s.type;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <TargetIcon type={t.type} className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {typeLabel} · {formatDuration(s.durationMinutes)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8"
                          title="Neu starten"
                          onClick={() => handleQuickRestart(s)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="shrink-0 border-t px-4 py-2 flex justify-end">
        <button
          onClick={handleFullView}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Zur Vollansicht
        </button>
      </footer>

      {/* ── Start Sheet ── */}
      <Sheet open={showStart} onOpenChange={setShowStart}>
        <SheetContent side="bottom" className="max-h-[85dvh] flex flex-col rounded-t-xl">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>Neue Sitzung</SheetTitle>
          </SheetHeader>

          <div className="px-4 flex flex-col gap-4 flex-1 overflow-hidden">
            {/* Session type picker */}
            <div className="flex gap-2">
              {SESSION_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSelectedType(t.value)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors",
                    selectedType === t.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <Input
              placeholder="Gerät, Kunde oder Kontakt suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />

            {/* Target list */}
            <div className="overflow-y-auto -mx-4 px-4 flex-1">
              {!apiTargets ? (
                <p className="text-sm text-muted-foreground text-center py-6">Lädt…</p>
              ) : filteredTargets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Keine Ergebnisse
                </p>
              ) : (
                <div className="space-y-1 pb-2">
                  {filteredTargets.map((t) => (
                    <button
                      key={`${t.type}-${t.id}`}
                      onClick={() => setSelectedTarget(t)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        selectedTarget?.id === t.id && selectedTarget?.type === t.type
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-accent"
                      )}
                    >
                      <TargetIcon type={t.type} className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        {t.sub && (
                          <p className="text-xs text-muted-foreground truncate">{t.sub}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {startError && (
            <p className="px-4 text-xs text-destructive">{startError}</p>
          )}

          <SheetFooter className="px-4 pb-4 pt-2 gap-2">
            <SheetClose
              render={<Button variant="outline" className="flex-1" />}
            >
              Abbrechen
            </SheetClose>
            <Button
              className="flex-1"
              disabled={!selectedTarget || starting}
              onClick={handleStart}
            >
              {starting ? "Startet…" : "Starten"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Stop Sheet ── */}
      <Sheet open={showStop} onOpenChange={setShowStop}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>Sitzung beenden</SheetTitle>
          </SheetHeader>

          <div className="px-4 flex flex-col gap-4">
            {/* Min-duration warning */}
            {minMins > 0 && elapsedMs < minMins * 60_000 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                Sitzung kürzer als Mindestdauer ({minMins} min) — verwerfen oder trotzdem speichern?
              </div>
            )}

            {/* Summary */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
              <div className="flex items-center gap-2">
                {target && <TargetIcon type={target.type} className="h-4 w-4 text-muted-foreground" />}
                <span className="font-medium text-sm">{target?.name ?? "–"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {SESSION_TYPES.find((t) => t.value === sessionType)?.label} ·{" "}
                <span className="font-mono">{formatElapsed(elapsedMs)}</span>
              </p>
            </div>

            {/* Optional note */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Notiz (optional)
              </label>
              <Input
                placeholder="Kurze Beschreibung…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <SheetFooter className="px-4 pb-4 pt-4 flex-row gap-2">
            <Button
              variant="ghost"
              className="flex-1 text-destructive hover:text-destructive"
              onClick={handleDiscard}
              disabled={stopping}
            >
              Verwerfen
            </Button>
            <Button
              className="flex-1"
              onClick={handleStop}
              disabled={stopping}
            >
              {stopping ? "Speichert…" : "Speichern"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
