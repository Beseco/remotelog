"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Plug, RefreshCw } from "lucide-react";
import type { AddonConfigFormProps } from "@/addons/types";
import type { InvoiceNinjaConfig } from "./index";

type SyncSummary = {
  importedFromIN: number;
  linkedToIN: number;
  clientsCreated: number;
  clientsUpdated: number;
  projectsCreated: number;
  projectsUpdated: number;
  projectsLinked: number;
  errors: string[];
};

export function InvoiceNinjaConfigForm({
  config,
  onSave,
  isSaving,
  error,
  isPremium,
}: AddonConfigFormProps<InvoiceNinjaConfig> & { isPremium?: boolean }) {
  const [invoiceNinjaUrl, setInvoiceNinjaUrl] = useState(config.invoiceNinjaUrl ?? "");
  const [apiToken, setApiToken] = useState(config.apiToken ?? "");
  const [licenseKey, setLicenseKey] = useState(config.licenseKey ?? "");

  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; total?: number; error?: string } | null>(null);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setTestResult(null);
    setSyncResult(null);
    setSyncError(null);
    await onSave({
      invoiceNinjaUrl: invoiceNinjaUrl.trim(),
      apiToken: apiToken.trim(),
      ...(isPremium ? { licenseKey: licenseKey.trim() } : {}),
    });
  }

  async function handleTest() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/addons/invoiceninja/preview");
      const data = await res.json() as { ok: boolean; total?: number; error?: string };
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "Netzwerkfehler" });
    } finally {
      setTestLoading(false);
    }
  }

  async function handleSync() {
    setSyncLoading(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/v1/addons/invoiceninja/sync", { method: "POST" });
      const data = await res.json() as SyncSummary & { error?: string };
      if (!res.ok) {
        setSyncError(data.error ?? "Synchronisation fehlgeschlagen");
      } else {
        setSyncResult(data);
      }
    } catch {
      setSyncError("Netzwerkfehler");
    } finally {
      setSyncLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="invoiceNinjaUrl">Invoice Ninja URL</Label>
        <Input
          id="invoiceNinjaUrl"
          type="url"
          placeholder="https://invoicing.example.com"
          value={invoiceNinjaUrl}
          onChange={(e) => setInvoiceNinjaUrl(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inApiToken">API-Token</Label>
        <Input
          id="inApiToken"
          type="password"
          placeholder="Token"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          In Invoice Ninja: Einstellungen → API-Token → Token erstellen
        </p>
      </div>

      {isPremium && (
        <div className="space-y-1.5">
          <Label htmlFor="inLicenseKey">Lizenzschlüssel</Label>
          <Input
            id="inLicenseKey"
            type="text"
            placeholder="XXXX-XXXX-XXXX"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSaving ? "Speichern…" : "Speichern"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={testLoading || !invoiceNinjaUrl || !apiToken}
          onClick={handleTest}
        >
          {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          Verbindung testen
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={syncLoading}
          onClick={handleSync}
        >
          {syncLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Jetzt synchronisieren
        </Button>
      </div>

      {testResult && (
        <div className={`text-sm flex items-center gap-1.5 ${testResult.ok ? "text-green-600" : "text-destructive"}`}>
          {testResult.ok ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Verbindung erfolgreich — {testResult.total} Klient(en) in Invoice Ninja
            </>
          ) : (
            <span>{testResult.error ?? "Verbindung fehlgeschlagen"}</span>
          )}
        </div>
      )}

      {syncError && <p className="text-sm text-destructive">{syncError}</p>}

      {syncResult && (
        <div className="text-sm space-y-1 rounded-md border p-3 bg-muted/50">
          <p className="font-medium flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-green-600" /> Synchronisation abgeschlossen
          </p>
          {(syncResult.importedFromIN > 0 || syncResult.linkedToIN > 0) && (
            <p className="text-muted-foreground">
              Von Invoice Ninja importiert: {syncResult.importedFromIN} neu, {syncResult.linkedToIN} verknüpft
            </p>
          )}
          <p className="text-muted-foreground">
            Kunden nach Invoice Ninja: {syncResult.clientsCreated} erstellt, {syncResult.clientsUpdated} aktualisiert
          </p>
          {(syncResult.projectsCreated > 0 || syncResult.projectsUpdated > 0 || syncResult.projectsLinked > 0) && (
            <p className="text-muted-foreground">
              Projekte: {syncResult.projectsCreated} erstellt, {syncResult.projectsUpdated} aktualisiert
              {syncResult.projectsLinked > 0 ? `, ${syncResult.projectsLinked} verknüpft` : ""}
            </p>
          )}
          {syncResult.errors.length > 0 && (
            <details className="mt-1">
              <summary className="text-destructive cursor-pointer">
                {syncResult.errors.length} Fehler
              </summary>
              <ul className="mt-1 space-y-0.5 text-destructive text-xs">
                {syncResult.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
