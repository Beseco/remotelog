"use client";

import { useState } from "react";
import { Monitor, Download, Apple } from "lucide-react";

interface Props {
  orgToken: string;
}

type OS = "windows" | "mac";

export function DownloadForm({ orgToken }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<OS | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(os: OS) {
    if (!email.trim()) return;
    setLoading(os);
    setError(null);

    try {
      const res = await fetch("/api/v1/install/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgToken, email: email.trim() }),
      });

      if (!res.ok) {
        setError("Fehler beim Vorbereiten des Downloads. Bitte versuchen Sie es erneut.");
        return;
      }

      const { sessionToken } = await res.json() as { sessionToken: string };
      const route = os === "mac"
        ? `/api/v1/install/script?s=${sessionToken}&os=linux`
        : `/api/v1/install/script?s=${sessionToken}&os=windows`;
      window.location.href = route;
      setSubmitted(true);
    } catch {
      setError("Netzwerkfehler. Bitte prüfen Sie Ihre Internetverbindung.");
    } finally {
      setLoading(null);
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <Download className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Download gestartet</h2>
        <p className="text-sm text-gray-500">
          Windows: Rechtsklick auf die .ps1-Datei → <strong>Mit PowerShell ausführen</strong><br />
          Linux: <code className="text-xs bg-gray-100 px-1 rounded">sudo bash remotelog-setup.sh</code>
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="text-sm text-blue-600 hover:underline"
        >
          Erneut herunterladen
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Ihre E-Mail-Adresse
        </label>
        <input
          type="email"
          required
          placeholder="max@beispiel.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void download("windows")}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400">
          Wird verwendet, um das Gerät Ihrem Profil zuzuordnen.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Betriebssystem wählen</p>

        {/* Windows */}
        <button
          type="button"
          disabled={!email.trim() || loading !== null}
          onClick={() => void download("windows")}
          className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-4 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 shrink-0">
            <Monitor className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">Windows</p>
            <p className="text-xs text-gray-500">PowerShell-Skript (.ps1) · Rechtsklick → Mit PowerShell ausführen</p>
          </div>
          {loading === "windows"
            ? <div className="ml-auto h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            : <Download className="ml-auto h-4 w-4 text-gray-400" />
          }
        </button>

        {/* macOS */}
        <button
          type="button"
          disabled={!email.trim() || loading !== null}
          onClick={() => void download("mac")}
          className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-4 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 shrink-0">
            <Apple className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">macOS</p>
            <p className="text-xs text-gray-500">Shell-Skript (.sh) · sudo bash remotelog-setup.sh</p>
          </div>
          {loading === "mac"
            ? <div className="ml-auto h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            : <Download className="ml-auto h-4 w-4 text-gray-400" />
          }
        </button>
      </div>
    </div>
  );
}
