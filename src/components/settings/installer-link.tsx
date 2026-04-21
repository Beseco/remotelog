"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, RefreshCw, Check, Link, Mail, X, Send } from "lucide-react";

interface ContactSuggestion {
  id: string;
  name: string;
  email: string;
  customerName: string;
}

interface InviteModalProps {
  onClose: () => void;
  prefilledEmail?: string;
}

function InviteModal({ onClose, prefilledEmail }: InviteModalProps) {
  const [email, setEmail] = useState(prefilledEmail ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/v1/install/contacts")
      .then((r) => r.json() as Promise<ContactSuggestion[]>)
      .then(setContacts)
      .catch(() => null);
    inputRef.current?.focus();
  }, []);

  const filtered = email.length >= 1
    ? contacts.filter(
        (c) =>
          c.email.toLowerCase().includes(email.toLowerCase()) ||
          c.name.toLowerCase().includes(email.toLowerCase()) ||
          c.customerName.toLowerCase().includes(email.toLowerCase())
      ).slice(0, 6)
    : [];

  async function send() {
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/install/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: email.trim() }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Unbekannter Fehler");
      } else {
        setSent(true);
        setTimeout(() => onClose(), 2200);
      }
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Einladung per E-Mail senden</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-700">E-Mail wurde gesendet!</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Der Empfänger erhält eine E-Mail mit Anleitung und Download-Link.
            </p>

            <div className="space-y-1 relative">
              <label className="block text-sm font-medium text-gray-700">
                E-Mail-Adresse des Ansprechpartners
              </label>
              <input
                ref={inputRef}
                type="email"
                placeholder="kunde@beispiel.de"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onKeyDown={(e) => e.key === "Enter" && void send()}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showDropdown && filtered.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                >
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => { setEmail(c.email); setShowDropdown(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-medium text-gray-600">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.email} · {c.customerName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => void send()}
                disabled={!email.trim() || sending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {sending
                  ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send className="h-4 w-4" />
                }
                Senden
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function InstallerLink({ dashboard = false }: { dashboard?: boolean } = {}) {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    fetch("/api/v1/install/token")
      .then((r) => r.json() as Promise<{ token: string }>)
      .then((d) => setToken(d.token))
      .catch(() => null);
  }, []);

  const downloadUrl = token ? `${window.location.origin}/${token}` : "";

  function copyUrl() {
    if (!downloadUrl) return;
    void navigator.clipboard.writeText(downloadUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function regenerate() {
    if (!confirm("Link wirklich neu generieren? Der alte Link funktioniert dann nicht mehr.")) return;
    setRegenerating(true);
    const res = await fetch("/api/v1/install/token", { method: "POST" });
    const data = await res.json() as { token: string };
    setToken(data.token);
    setRegenerating(false);
  }

  return (
    <div className="space-y-3">
      {!dashboard && (
        <p className="text-sm text-gray-600">
          Teilen Sie diesen Link mit Ihren Kunden. Sie können RustDesk damit
          selbst installieren — das Gerät erscheint dann automatisch in RemoteLog.
        </p>
      )}

      {/* URL row */}
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 min-w-0">
        <Link className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-xs text-gray-700 font-mono truncate flex-1">
          {downloadUrl || "Wird geladen…"}
        </span>
      </div>

      {/* Buttons row */}
      <div className="flex gap-2">
        <button
          onClick={copyUrl}
          disabled={!token}
          title="Link kopieren"
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 disabled:opacity-40 transition-colors"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "Kopiert" : "Kopieren"}
        </button>
        <button
          onClick={() => setShowInvite(true)}
          disabled={!token}
          title="Per E-Mail einladen"
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-2 text-sm text-blue-700 disabled:opacity-40 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Einladen
        </button>
      </div>

      {!dashboard && (
      <button
        onClick={() => void regenerate()}
        disabled={regenerating}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
      >
        <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
        Link neu generieren
      </button>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

// Standalone invite button for customer pages
export function InstallerInviteButton({ prefilledEmail }: { prefilledEmail?: string }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs text-blue-700 transition-colors"
      >
        <Mail className="h-3.5 w-3.5" />
        Einladung senden
      </button>
      {show && <InviteModal onClose={() => setShow(false)} prefilledEmail={prefilledEmail} />}
    </>
  );
}
