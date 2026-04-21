"use client";

import { useCallback, useState } from "react";
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export type ReminderPrefs = {
  notifIntervalMins:   number;
  notifSoundEnabled:   boolean;
  notifDesktopEnabled: boolean;
  notifBadgeEnabled:   boolean;
};

async function savePrefs(patch: Partial<ReminderPrefs>) {
  await fetch("/api/v1/user/preferences", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(patch),
  });
}

export function ReminderForm({ initialPrefs }: { initialPrefs: ReminderPrefs }) {
  const [prefs, setPrefs]               = useState(initialPrefs);
  const [notifPermission, setPermission] = useState<NotificationPermission | null>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : null
  );

  const update = useCallback(async (patch: Partial<ReminderPrefs>) => {
    setPrefs(p => ({ ...p, ...patch }));
    await savePrefs(patch);
  }, []);

  async function requestNotifPermission() {
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Sitzungs-Erinnerungen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Erinnerungen, wenn eine Zeitsitzung aktiv ist. Einstellungen gelten nur für diesen Account.
        </p>

        {/* Intervall */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-interval">Erinnerungsintervall</Label>
            <span className="text-sm font-medium tabular-nums">
              {prefs.notifIntervalMins} {prefs.notifIntervalMins === 1 ? "Minute" : "Minuten"}
            </span>
          </div>
          <input
            id="notif-interval"
            type="range"
            min={1}
            max={10}
            step={1}
            value={prefs.notifIntervalMins}
            onChange={e => setPrefs(p => ({ ...p, notifIntervalMins: Number(e.target.value) }))}
            onMouseUp={e => update({ notifIntervalMins: Number((e.target as HTMLInputElement).value) })}
            onTouchEnd={e => update({ notifIntervalMins: Number((e.target as HTMLInputElement).value) })}
            className="w-full h-2 rounded-full accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 Min</span>
            <span>10 Min</span>
          </div>
        </div>

        {/* Ton */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Ton</Label>
            <p className="text-xs text-muted-foreground">Akustisches Signal bei jeder Erinnerung</p>
          </div>
          <Switch
            checked={prefs.notifSoundEnabled}
            onCheckedChange={v => update({ notifSoundEnabled: v })}
          />
        </div>

        {/* Desktop-Benachrichtigung */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label>Desktop-Benachrichtigung</Label>
            <p className="text-xs text-muted-foreground">Browser-Popup bei jeder Erinnerung</p>
            {notifPermission === "denied" && (
              <p className="text-xs text-destructive mt-1">
                Benachrichtigungen sind im Browser blockiert. Bitte in den Browser-Einstellungen freigeben.
              </p>
            )}
            {notifPermission === "default" && prefs.notifDesktopEnabled && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={requestNotifPermission}
              >
                Berechtigung anfordern
              </Button>
            )}
          </div>
          <Switch
            checked={prefs.notifDesktopEnabled}
            onCheckedChange={v => update({ notifDesktopEnabled: v })}
          />
        </div>

        {/* Tab-Badge */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Laufzeit im Tab-Titel</Label>
            <p className="text-xs text-muted-foreground">Zeigt ⏱ 01:23:45 im Browser-Tab</p>
          </div>
          <Switch
            checked={prefs.notifBadgeEnabled}
            onCheckedChange={v => update({ notifBadgeEnabled: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
