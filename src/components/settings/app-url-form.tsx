"use client";

import { useState } from "react";
import { Save, Check } from "lucide-react";

interface Props {
  initial: string | null;
  envFallback: string;
}

export function AppUrlForm({ initial, envFallback }: Props) {
  const [url, setUrl] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/settings/app-url", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appUrl: url.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Fehler beim Speichern");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Öffentliche URL dieser RemoteLog-Instanz. Wird in Installer-Skripten und E-Mails verwendet.
        {envFallback && !initial && (
          <span className="ml-1 text-gray-400">(Aktuell aus Umgebungsvariable: <code className="text-xs bg-gray-100 px-1 rounded">{envFallback}</code>)</span>
        )}
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://remotelog.example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {saved ? <Check className="h-4 w-4 text-green-400" /> : saving ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? "Gespeichert" : "Speichern"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}
