"use client";

import { useEffect, useState } from "react";
import { useSessionReminder, type NotifPrefs } from "@/hooks/use-session-reminder";
import { useTimer } from "@/lib/timer-context";

const DEFAULT_PREFS: NotifPrefs = {
  notifIntervalMins:   5,
  notifSoundEnabled:   true,
  notifDesktopEnabled: true,
  notifBadgeEnabled:   true,
};

function SessionReminderInner({ prefs }: { prefs: NotifPrefs }) {
  const { state } = useTimer();

  // Notification-Permission beim ersten Sitzungsstart anfordern
  useEffect(() => {
    if (state.status !== "running") return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default" && prefs.notifDesktopEnabled) {
      Notification.requestPermission();
    }
  }, [state.status, prefs.notifDesktopEnabled]);

  useSessionReminder(prefs);
  return null;
}

export function SessionReminder() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    fetch("/api/v1/user/preferences")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPrefs(data); })
      .catch(() => {});
  }, []);

  return <SessionReminderInner prefs={prefs} />;
}
