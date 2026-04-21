"use client";

import { useEffect, useRef } from "react";
import { useTimer, formatElapsed } from "@/lib/timer-context";

export type NotifPrefs = {
  notifIntervalMins:   number;
  notifSoundEnabled:   boolean;
  notifDesktopEnabled: boolean;
  notifBadgeEnabled:   boolean;
};

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext not available (e.g. SSR guard)
  }
}

async function sendDesktopNotification(elapsedMs: number) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "denied") return;

  if (Notification.permission !== "granted") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return;
  }

  new Notification("Sitzung läuft", {
    body: `Deine Sitzung ist noch aktiv – ${formatElapsed(elapsedMs)}`,
    icon: "/favicon.ico",
    tag:  "remotelog-session",
  });
}

export function useSessionReminder(prefs: NotifPrefs) {
  const { state, elapsedMs } = useTimer();
  const isRunning = state.status === "running";
  const elapsedRef = useRef(elapsedMs);
  elapsedRef.current = elapsedMs;

  // Tab-Titel Badge
  useEffect(() => {
    if (!isRunning || !prefs.notifBadgeEnabled) {
      document.title = "RemoteLog";
      return;
    }
    document.title = `⏱ ${formatElapsed(elapsedRef.current)} – RemoteLog`;
    const id = setInterval(() => {
      document.title = `⏱ ${formatElapsed(elapsedRef.current)} – RemoteLog`;
    }, 1000);
    return () => {
      clearInterval(id);
      document.title = "RemoteLog";
    };
  }, [isRunning, prefs.notifBadgeEnabled]);

  // Periodische Erinnerungen
  useEffect(() => {
    if (!isRunning) return;
    if (!prefs.notifSoundEnabled && !prefs.notifDesktopEnabled) return;

    const ms = prefs.notifIntervalMins * 60 * 1000;
    const id = setInterval(() => {
      if (prefs.notifSoundEnabled)   playBeep();
      if (prefs.notifDesktopEnabled) sendDesktopNotification(elapsedRef.current);
    }, ms);
    return () => clearInterval(id);
  }, [isRunning, prefs.notifIntervalMins, prefs.notifSoundEnabled, prefs.notifDesktopEnabled]);
}
