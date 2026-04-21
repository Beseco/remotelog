"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Euro } from "lucide-react";

type BillingSettings = {
  hourlyRate: number;
  roundUpMins: number;
  prepMins: number;
  followUpMins: number;
  minMins: number;
};

export function BillingForm({ initialSettings }: { initialSettings: BillingSettings }) {
  const [values, setValues] = useState(initialSettings);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof BillingSettings, raw: string) {
    const n = parseFloat(raw);
    setValues(v => ({ ...v, [key]: isNaN(n) ? 0 : n }));
    setSuccess(false);
    setError(null);
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/v1/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Fehler beim Speichern");
      }
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Euro className="h-4 w-4" />
          Abrechnung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Diese Einstellungen gelten für die gesamte Organisation.
          Sitzungszeiten werden in der Abrechnung nach diesen Regeln umgerechnet.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Stundensatz (€/h netto)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="pl-7"
                value={values.hourlyRate}
                onChange={e => set("hourlyRate", e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">0 = Abrechnung deaktiviert</p>
          </div>

          <div className="space-y-1.5">
            <Label>Aufrunden auf (Minuten)</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={values.roundUpMins}
              onChange={e => set("roundUpMins", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">z.B. 15 = auf nächste volle 15 min aufrunden</p>
          </div>

          <div className="space-y-1.5">
            <Label>Vorbereitungszeit (Minuten)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={values.prepMins}
              onChange={e => set("prepMins", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Wird jeder Sitzung vor dem Aufrunden addiert</p>
          </div>

          <div className="space-y-1.5">
            <Label>Nachbereitungszeit (Minuten)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={values.followUpMins}
              onChange={e => set("followUpMins", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Wird jeder Sitzung vor dem Aufrunden addiert</p>
          </div>

          <div className="space-y-1.5">
            <Label>Mindestdauer (Minuten)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={values.minMins}
              onChange={e => set("minMins", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sitzungen kürzer als dieser Wert werden nicht berechnet (0 = alle)
            </p>
          </div>
        </div>

        {/* Beispielrechnung */}
        {values.hourlyRate > 0 && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Beispiel</p>
            <p>
              Eine Sitzung von <strong>19 Minuten</strong> →{" "}
              + {values.prepMins} min Vorbereitung + {values.followUpMins} min Nachbereitung ={" "}
              <strong>{19 + values.prepMins + values.followUpMins} min</strong>
              {values.roundUpMins > 1 && (
                <> → aufgerundet auf nächste {values.roundUpMins} min ={" "}
                  <strong>
                    {Math.ceil((19 + values.prepMins + values.followUpMins) / Math.max(1, values.roundUpMins))
                      * Math.max(1, values.roundUpMins)} min
                  </strong>
                </>
              )}
              {19 < values.minMins && (
                <span className="text-muted-foreground"> — kürzer als Mindestdauer, wird nicht berechnet</span>
              )}
            </p>
            {19 >= values.minMins && values.hourlyRate > 0 && (
              <p>
                Abrechnungsbetrag:{" "}
                <strong>
                  {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
                    (Math.ceil((19 + values.prepMins + values.followUpMins) / Math.max(1, values.roundUpMins))
                      * Math.max(1, values.roundUpMins) / 60) * values.hourlyRate
                  )}
                </strong>
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Speichern…" : "Speichern"}
          </Button>
          {success && <span className="text-sm text-green-600">Gespeichert</span>}
          {error   && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
