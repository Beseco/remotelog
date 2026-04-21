"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimerTarget = {
  type: "device" | "customer" | "contact";
  id: string;
  name: string;
};

export type TimerStatus = "idle" | "running" | "paused";

export type TimerState = {
  status: TimerStatus;
  sessionId: string | null;
  startedAt: number | null;      // Date.now() when first started
  totalPausedMs: number;         // accumulated paused milliseconds
  pausedAt: number | null;       // Date.now() when current pause began
  target: TimerTarget | null;
  sessionType: "remote" | "onsite" | "phone";
};

type TimerContextValue = {
  state: TimerState;
  elapsedMs: number;             // live-updated elapsed net ms
  start: (target: TimerTarget, sessionType: TimerState["sessionType"], parentSessionId?: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: (note?: string) => Promise<void>;
  discard: () => Promise<void>;
};

// ─── Default state ────────────────────────────────────────────────────────────

const INITIAL: TimerState = {
  status:       "idle",
  sessionId:    null,
  startedAt:    null,
  totalPausedMs: 0,
  pausedAt:     null,
  target:       null,
  sessionType:  "remote",
};

const LS_KEY = "remotelog_timer";

function loadFromStorage(): TimerState {
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return INITIAL;
    return { ...INITIAL, ...JSON.parse(raw) };
  } catch {
    return INITIAL;
  }
}

function saveToStorage(s: TimerState) {
  if (typeof window === "undefined") return;
  if (s.status === "idle") {
    localStorage.removeItem(LS_KEY);
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  }
}

// ─── Elapsed helper ───────────────────────────────────────────────────────────

export function calcElapsedMs(state: TimerState, now = Date.now()): number {
  if (!state.startedAt) return 0;
  const reference = state.status === "paused" && state.pausedAt ? state.pausedAt : now;
  return Math.max(0, reference - state.startedAt - state.totalPausedMs);
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h  = Math.floor(totalSec / 3600);
  const m  = Math.floor((totalSec % 3600) / 60);
  const s  = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateRaw] = useState<TimerState>(INITIAL);
  const [elapsedMs, setElapsedMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialized = useRef(false);

  // Load from localStorage on mount (client only); fall back to server active session
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const stored = loadFromStorage();
    if (stored.status !== "idle") {
      setStateRaw(stored);
      setElapsedMs(calcElapsedMs(stored));
      return;
    }

    // No local state — check server for an active session (other tab / device)
    fetch("/api/v1/sessions/active")
      .then(r => r.json())
      .then((s) => {
        if (!s || !s.id) return;
        const target: TimerTarget = s.device
          ? { type: "device",   id: s.device.id,   name: s.device.name }
          : s.contact
          ? { type: "contact",  id: s.contact.id,   name: `${s.contact.firstName} ${s.contact.lastName}` }
          : { type: "customer", id: s.customer.id,  name: s.customer.name };

        const recovered: TimerState = {
          ...INITIAL,
          status:      "running",
          sessionId:   s.id,
          startedAt:   new Date(s.startedAt).getTime(),
          target,
          sessionType: s.type as TimerState["sessionType"],
        };
        setStateRaw(recovered);
        saveToStorage(recovered);
        setElapsedMs(calcElapsedMs(recovered));
      })
      .catch(() => { /* ignore — server might not be up yet */ });
  }, []);

  // Live ticker
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (state.status === "running") {
      intervalRef.current = setInterval(() => {
        setElapsedMs(calcElapsedMs(state));
      }, 500);
    } else {
      setElapsedMs(calcElapsedMs(state));
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state]);

  const setState = useCallback((next: TimerState) => {
    setStateRaw(next);
    saveToStorage(next);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const start = useCallback(
    async (target: TimerTarget, sessionType: TimerState["sessionType"], parentSessionId?: string) => {
      const res = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [`${target.type}Id`]: target.id,
          type: sessionType,
          ...(parentSessionId ? { parentSessionId } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Sitzung konnte nicht gestartet werden");
      }
      const data = await res.json();
      setState({
        status:       "running",
        sessionId:    data.id,
        startedAt:    new Date(data.startedAt).getTime(),
        totalPausedMs: 0,
        pausedAt:     null,
        target,
        sessionType,
      });
    },
    [setState],
  );

  const pause = useCallback(() => {
    if (state.status !== "running" || !state.sessionId) return;
    const pausedAt = Date.now();
    setState({ ...state, status: "paused", pausedAt });
    // Fire-and-forget: persist pause interval on server
    fetch(`/api/v1/sessions/${state.sessionId}/pause`, { method: "POST" }).catch(() => {});
  }, [state, setState]);

  const resume = useCallback(() => {
    if (state.status !== "paused" || !state.pausedAt || !state.sessionId) return;
    setState({
      ...state,
      status:       "running",
      totalPausedMs: state.totalPausedMs + (Date.now() - state.pausedAt),
      pausedAt:     null,
    });
    // Fire-and-forget: start new interval on server
    fetch(`/api/v1/sessions/${state.sessionId}/resume`, { method: "POST" }).catch(() => {});
  }, [state, setState]);

  const stop = useCallback(
    async (note?: string) => {
      if (!state.sessionId) return;
      const netMs      = calcElapsedMs(state);
      const netMinutes = Math.max(0, Math.round(netMs / 60000));
      await fetch(`/api/v1/sessions/${state.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMinutes: netMinutes,
          ...(note?.trim() ? { note: note.trim() } : {}),
        }),
      });
      setState(INITIAL);
    },
    [state, setState],
  );

  const discard = useCallback(async () => {
    if (state.sessionId) {
      await fetch(`/api/v1/sessions/${state.sessionId}`, { method: "DELETE" });
    }
    setState(INITIAL);
  }, [state, setState]);

  return (
    <TimerContext.Provider value={{ state, elapsedMs, start, pause, resume, stop, discard }}>
      {children}
    </TimerContext.Provider>
  );
}
