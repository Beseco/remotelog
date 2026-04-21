"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Download, Loader2, Upload, AlertTriangle } from "lucide-react";
import type { ExportCategory, ImportSummary, RemoteLogExport } from "@/lib/export-types";
import { ALL_CATEGORIES } from "@/lib/export-types";

const CATEGORY_LABELS: Record<ExportCategory, string> = {
  settings: "Einstellungen",
  customers: "Kunden & Kontakte",
  groups: "Gruppen",
  devices: "Geräte",
  projects: "Projekte",
  sessions: "Sitzungen",
  addons: "Addons",
  users: "Benutzer",
};

const SENSITIVE_CATEGORIES: ExportCategory[] = ["users", "addons", "settings"];

export function ExportImportSection() {
  // ── Export ─────────────────────────────────────────────────────────────────
  const [exportSelected, setExportSelected] = useState<Set<ExportCategory>>(
    new Set(ALL_CATEGORIES)
  );
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function toggleExport(cat: ExportCategory) {
    setExportSelected((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  async function handleExport() {
    if (exportSelected.size === 0) return;
    setExporting(true);
    setExportError(null);
    try {
      const include = [...exportSelected].join(",");
      const res = await fetch(`/api/v1/export?include=${encodeURIComponent(include)}`);
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Export fehlgeschlagen");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `remotelog-export-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setExporting(false);
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ cat: ExportCategory; count: number }[] | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreview(null);
    setImportResult(null);
    setImportError(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as RemoteLogExport;
        const entries: { cat: ExportCategory; count: number }[] = [];
        if (data.settings) entries.push({ cat: "settings", count: 1 });
        if (data.customers) entries.push({ cat: "customers", count: data.customers.length });
        if (data.groups) entries.push({ cat: "groups", count: data.groups.length });
        if (data.devices) entries.push({ cat: "devices", count: data.devices.length });
        if (data.projects) entries.push({ cat: "projects", count: data.projects.length });
        if (data.sessions) entries.push({ cat: "sessions", count: data.sessions.length });
        if (data.addons) entries.push({ cat: "addons", count: data.addons.length });
        if (data.users) entries.push({ cat: "users", count: data.users.length });
        setPreview(entries);
      } catch {
        setImportError("Ungültige Datei — kein gültiges RemoteLog-Export-Format");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!selectedFile) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/v1/import", { method: "POST", body: formData });
      const data = await res.json() as ImportSummary & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import fehlgeschlagen");
      setImportResult(data);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setImporting(false);
    }
  }

  const hasSensitive = SENSITIVE_CATEGORIES.some((c) => exportSelected.has(c));

  return (
    <div className="space-y-6">
      {/* ── Export ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" />
            Daten exportieren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ALL_CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportSelected.has(cat)}
                  onChange={() => toggleExport(cat)}
                  className="accent-primary h-4 w-4"
                />
                {CATEGORY_LABELS[cat]}
              </label>
            ))}
          </div>

          {hasSensitive && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Die Auswahl enthält sensible Daten (Passwort-Hashes, API-Tokens, SMTP-Passwörter). Exportdatei sicher aufbewahren.
              </span>
            </div>
          )}

          {exportError && <p className="text-sm text-destructive">{exportError}</p>}

          <Button onClick={handleExport} disabled={exporting || exportSelected.size === 0}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Exportiere…" : "Export herunterladen"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Import ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" />
            Daten importieren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Bestehende Datensätze werden anhand von Name / E-Mail erkannt und überschrieben.
              Der aktuell angemeldete Benutzer wird nie überschrieben.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
          </div>

          {preview && preview.length > 0 && (
            <div className="rounded-md border p-3 space-y-1 bg-muted/40">
              <p className="text-xs font-medium text-muted-foreground mb-2">Datei-Inhalt</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                {preview.map(({ cat, count }) => (
                  <div key={cat} className="flex justify-between text-xs">
                    <span>{CATEGORY_LABELS[cat]}</span>
                    <span className="font-mono text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importError && <p className="text-sm text-destructive">{importError}</p>}

          {importResult && (
            <div className="rounded-md border p-3 space-y-2 bg-muted/40">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-600" /> Import abgeschlossen
              </p>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-0.5 text-xs">
                <span className="text-muted-foreground font-medium">Kategorie</span>
                <span className="text-muted-foreground font-medium text-right">Neu</span>
                <span className="text-muted-foreground font-medium text-right">Aktualisiert</span>
                <span className="text-muted-foreground font-medium text-right">Übersprungen</span>
                {(Object.entries(importResult) as [string, unknown][])
                  .filter(([k, v]) => k !== "errors" && v && typeof v === "object")
                  .map(([k, v]) => {
                    const entry = v as { created: number; updated: number; skipped: number };
                    return (
                      <>
                        <span key={`${k}-label`}>{CATEGORY_LABELS[k as ExportCategory] ?? k}</span>
                        <span key={`${k}-c`} className="text-right tabular-nums">{entry.created}</span>
                        <span key={`${k}-u`} className="text-right tabular-nums">{entry.updated}</span>
                        <span key={`${k}-s`} className="text-right tabular-nums text-muted-foreground">{entry.skipped}</span>
                      </>
                    );
                  })}
              </div>
              {importResult.errors.length > 0 && (
                <details className="mt-1">
                  <summary className="text-xs text-destructive cursor-pointer">
                    {importResult.errors.length} Fehler
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-xs text-destructive">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          <Button onClick={handleImport} disabled={importing || !selectedFile || !preview} variant="outline">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importiere…" : "Import starten"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
