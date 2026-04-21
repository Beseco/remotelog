"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Plug, RefreshCw } from "lucide-react";
import type { AddonConfigFormProps } from "@/addons/types";
import type { ZammadConfig } from "./index";

type SyncSummary = {
  customersCreated: number;
  customersUpdated: number;
  contactsCreated: number;
  contactsUpdated: number;
  orgsCreated: number;
  orgsUpdated: number;
  errors: string[];
};

export function ZammadConfigForm({
  config,
  onSave,
  isSaving,
  error,
  isPremium,
}: AddonConfigFormProps<ZammadConfig> & { isPremium?: boolean }) {
  const [zammadUrl, setZammadUrl] = useState(config.zammadUrl ?? "");
  const [apiToken, setApiToken] = useState(config.apiToken ?? "");
  const [licenseKey, setLicenseKey] = useState(config.licenseKey ?? "");

  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; orgCount?: number; error?: string } | null>(null);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setTestResult(null);
    setSyncResult(null);
    setSyncError(null);
    await onSave({
      zammadUrl: zammadUrl.trim(),
      apiToken: apiToken.trim(),
      ...(isPremium ? { licenseKey: licenseKey.trim() } : {}),
    });
  }

  async function handleTest() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/addons/zammad/preview");
      const data = await res.json() as { ok: boolean; orgCount?: number; error?: string };
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
      const res = await fetch("/api/v1/addons/zammad/sync", { method: "POST" });
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
        <Label htmlFor="zammadUrl">Zammad-URL</Label>
        <Input
          id="zammadUrl"
          type="url"
          placeholder="https://zammad.example.com"
          value={zammadUrl}
          onChange={(e) => setZammadUrl(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="apiToken">API-Token</Label>
        <Input
          id="apiToken"
          type="password"
          placeholder="Token"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          required
        />
      </div>

      {isPremium && (
        <div className="space-y-1.5">
          <Label htmlFor="licenseKey">Lizenzschlüssel</Label>
          <Input
            id="licenseKey"
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
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSaving ? "Speichern…" : "Speichern"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={testLoading || !zammadUrl || !apiToken}
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
              Verbindung erfolgreich — {testResult.orgCount} Organisation(en) gefunden
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
          <p className="text-muted-foreground">
            Kunden: {syncResult.customersCreated} erstellt, {syncResult.customersUpdated} aktualisiert
          </p>
          <p className="text-muted-foreground">
            Kontakte: {syncResult.contactsCreated} erstellt, {syncResult.contactsUpdated} aktualisiert
          </p>
          {(syncResult.orgsCreated > 0 || syncResult.orgsUpdated > 0) && (
            <p className="text-muted-foreground">
              Nach Zammad: {syncResult.orgsCreated} erstellt, {syncResult.orgsUpdated} aktualisiert
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
