"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTimer } from "@/lib/timer-context";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Monitor, Building2, UserRound, Play } from "lucide-react";

const SESSION_TYPES = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "Vor-Ort" },
  { value: "phone",  label: "Telefon" },
];

type SessionContext =
  | { kind: "device";   id: string; name: string }
  | { kind: "customer"; id: string; name: string }
  | { kind: "contact";  id: string; name: string };

const contextIcon = {
  device:   <Monitor   className="h-4 w-4 text-primary" />,
  customer: <Building2 className="h-4 w-4 text-primary" />,
  contact:  <UserRound className="h-4 w-4 text-primary" />,
};

const contextLabel = {
  device:   "Gerät",
  customer: "Kunde",
  contact:  "Ansprechpartner",
};

export function StartSessionDialog({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  context: SessionContext;
}) {
  const { state, start } = useTimer();
  const [type, setType] = useState("remote");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerActive = state.status !== "idle";

  async function handleStart() {
    if (timerActive) return;
    setLoading(true);
    setError(null);
    try {
      await start(
        { type: context.kind, id: context.id, name: context.name },
        type as "remote" | "onsite" | "phone",
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            Sitzung starten
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
            {contextIcon[context.kind]}
            <span className="text-muted-foreground">{contextLabel[context.kind]}:</span>
            <span className="font-medium">{context.name}</span>
          </div>
          {timerActive ? (
            <p className="text-sm text-destructive">
              Zeiterfassung läuft bereits. Bitte erst die aktive Sitzung beenden.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label>Sitzungstyp</Label>
              <div className="flex gap-2">
                {SESSION_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      type === t.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          {!timerActive && (
            <Button onClick={handleStart} disabled={loading}>
              {loading ? "Starten…" : "Sitzung starten"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
