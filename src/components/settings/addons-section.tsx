"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Puzzle, Settings2 } from "lucide-react";
import { addonRegistry } from "@/addons/registry";
import type { AddonRecord } from "@/addons/types";

interface AddonsProps {
  initialAddons: AddonRecord[];
}

export function AddonsSection({ initialAddons }: AddonsProps) {
  const [addonStates, setAddonStates] = useState<Record<string, AddonRecord>>(
    () =>
      Object.fromEntries(
        addonRegistry.map((def) => {
          const existing = initialAddons.find((a) => a.key === def.key);
          return [def.key, existing ?? { key: def.key, enabled: false, config: {} }];
        })
      )
  );

  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  async function handleToggle(key: string, enabled: boolean) {
    setTogglingKey(key);
    setErrors((prev) => ({ ...prev, [key]: null }));
    try {
      const res = await fetch(`/api/v1/addons/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json() as AddonRecord & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setAddonStates((prev) => ({ ...prev, [key]: data }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [key]: (e as Error).message }));
    } finally {
      setTogglingKey(null);
    }
  }

  async function handleSave(key: string, config: Record<string, unknown>) {
    setSavingKey(key);
    setErrors((prev) => ({ ...prev, [key]: null }));
    try {
      const res = await fetch(`/api/v1/addons/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json() as AddonRecord & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setAddonStates((prev) => ({ ...prev, [key]: data }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [key]: (e as Error).message }));
      throw e;
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Puzzle className="h-4 w-4" />
          Addons
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {addonRegistry.map((def) => {
          const state = addonStates[def.key];
          const ConfigForm = def.ConfigFormComponent;

          return (
            <div
              key={def.key}
              className="flex items-start justify-between gap-4 rounded-lg border p-4"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{def.name}</span>
                  {def.isPremium && (
                    <Badge variant="secondary" className="text-xs">
                      Premium
                    </Badge>
                  )}
                  {state.enabled && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                      Aktiv
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{def.description}</p>
                {errors[def.key] && (
                  <p className="text-sm text-destructive">{errors[def.key]}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {state.enabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenDialog(def.key)}
                  >
                    <Settings2 className="h-4 w-4" />
                    Konfigurieren
                  </Button>
                )}
                <Switch
                  checked={state.enabled}
                  disabled={togglingKey === def.key}
                  onCheckedChange={(checked) => handleToggle(def.key, checked)}
                  aria-label={`${def.name} ${state.enabled ? "deaktivieren" : "aktivieren"}`}
                />
              </div>

              <Dialog
                open={openDialog === def.key}
                onOpenChange={(open) => !open && setOpenDialog(null)}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      {def.name}
                      {def.isPremium && (
                        <Badge variant="secondary" className="text-xs">
                          Premium
                        </Badge>
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  <ConfigForm
                    config={state.config}
                    onSave={(config) => handleSave(def.key, config as Record<string, unknown>)}
                    isSaving={savingKey === def.key}
                    error={errors[def.key] ?? null}
                    isPremium={def.isPremium}
                  />
                </DialogContent>
              </Dialog>
            </div>
          );
        })}

        {addonRegistry.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine Addons verfügbar.</p>
        )}
      </CardContent>
    </Card>
  );
}
