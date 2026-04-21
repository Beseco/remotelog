"use client";

import { useState } from "react";
import { Save, Check } from "lucide-react";

interface Props {
  initial: {
    rustdeskIdServer: string | null;
    rustdeskRelay: string | null;
    rustdeskKey: string | null;
    hasApiPassword: boolean;
  };
}

export function RustdeskServerForm({ initial }: Props) {
  const [idServer, setIdServer] = useState(initial.rustdeskIdServer ?? "");
  const [relay, setRelay] = useState(initial.rustdeskRelay ?? "");
  const [key, setKey] = useState(initial.rustdeskKey ?? "");
  const [apiPassword, setApiPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/settings/rustdesk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rustdeskIdServer: idServer.trim() || null,
          rustdeskRelay: relay.trim() || null,
          rustdeskKey: key.trim() || null,
          rustdeskApiPassword: apiPassword || undefined,
        }),
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
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Optionaler eigener RustDesk-Server. Leer lassen um das öffentliche RustDesk-Netzwerk zu verwenden.
      </p>

      <div className="grid gap-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">ID-Server</label>
          <input
            type="text"
            placeholder="id.example.com"
            value={idServer}
            onChange={(e) => setIdServer(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Relay-Server</label>
          <input
            type="text"
            placeholder="relay.example.com"
            value={relay}
            onChange={(e) => setRelay(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Public Key</label>
          <input
            type="text"
            placeholder="Base64-codierter öffentlicher Schlüssel"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Admin API Passwort
            {initial.hasApiPassword && <span className="ml-2 text-xs font-normal text-green-600">✓ gespeichert</span>}
          </label>
          <input
            type="password"
            placeholder={initial.hasApiPassword ? "Neues Passwort eingeben um zu ändern" : "hbbs Admin-Passwort"}
            value={apiPassword}
            onChange={(e) => setApiPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500">Nur für <strong>RustDesk Server Pro</strong>. Das Passwort wird in der Server Pro Oberfläche gesetzt. Ermöglicht den Online-Status-Check über die hbbs REST-API (Port 21114). Bei der kostenlosen Version leer lassen — dort wird der Status über TCP-Verbindung zur gespeicherten IP geprüft.</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={() => void save()}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {saved ? <Check className="h-4 w-4 text-green-400" /> : saving ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
        {saved ? "Gespeichert" : "Speichern"}
      </button>
    </div>
  );
}
