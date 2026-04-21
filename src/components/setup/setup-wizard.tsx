"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Server, Sparkles } from "lucide-react";

type SetupStatus = {
  organizationName: string;
  smtp: {
    host: string | null;
    port: number;
    secure: boolean;
    user: string | null;
    hasPass: boolean;
    from: string;
  };
  rustdesk: {
    rustdeskIdServer: string | null;
    rustdeskRelay: string | null;
    rustdeskKey: string | null;
  };
};

type Props = {
  initial: SetupStatus;
};

export function SetupWizard({ initial }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [orgName, setOrgName] = useState(initial.organizationName || "Meine IT-Firma");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [smtpHost, setSmtpHost] = useState(initial.smtp.host ?? "");
  const [smtpPort, setSmtpPort] = useState(String(initial.smtp.port || 587));
  const [smtpSecure, setSmtpSecure] = useState(initial.smtp.secure);
  const [smtpUser, setSmtpUser] = useState(initial.smtp.user ?? "");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState(initial.smtp.from ?? "noreply@remotelog.de");

  const [idServer, setIdServer] = useState(initial.rustdesk.rustdeskIdServer ?? "");
  const [relay, setRelay] = useState(initial.rustdesk.rustdeskRelay ?? "");
  const [key, setKey] = useState(initial.rustdesk.rustdeskKey ?? "");

  const steps = useMemo(() => ([
    "Willkommen",
    "Admin",
    "SMTP",
    "RustDesk",
    "Abschluss",
  ]), []);

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function createAdmin() {
    await run(async () => {
      if (!adminName.trim() || !adminEmail.trim() || adminPassword.length < 8) {
        throw new Error("Bitte Name, E-Mail und Passwort (min. 8 Zeichen) eingeben.");
      }
      const res = await fetch("/api/v1/setup/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: adminName,
          email: adminEmail,
          password: adminPassword,
          organizationName: orgName,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Admin konnte nicht angelegt werden.");
      setStep(2);
      setNotice("Admin wurde angelegt.");
    });
  }

  async function testSmtp() {
    await run(async () => {
      const res = await fetch("/api/v1/setup/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: Number(smtpPort),
          secure: smtpSecure,
          user: smtpUser.trim(),
          pass: smtpPass,
          from: smtpFrom.trim(),
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "SMTP-Test fehlgeschlagen.");
      setNotice(data.message ?? "SMTP-Verbindung erfolgreich.");
    });
  }

  async function saveSmtp(nextStep: number) {
    await run(async () => {
      const res = await fetch("/api/v1/setup/smtp/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: Number(smtpPort),
          secure: smtpSecure,
          user: smtpUser.trim(),
          pass: smtpPass, // empty => clear, omitted not used here
          from: smtpFrom.trim(),
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "SMTP konnte nicht gespeichert werden.");
      setStep(nextStep);
      setNotice("SMTP-Einstellungen gespeichert.");
    });
  }

  async function testRustdesk() {
    await run(async () => {
      const res = await fetch("/api/v1/setup/rustdesk/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rustdeskIdServer: idServer.trim(),
          rustdeskRelay: relay.trim(),
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "RustDesk-Test fehlgeschlagen.");
      setNotice(data.message ?? "RustDesk-Test erfolgreich.");
    });
  }

  async function saveRustdesk(nextStep: number) {
    await run(async () => {
      const res = await fetch("/api/v1/setup/rustdesk/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rustdeskIdServer: idServer.trim() || null,
          rustdeskRelay: relay.trim() || null,
          rustdeskKey: key.trim() || null,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "RustDesk konnte nicht gespeichert werden.");
      setStep(nextStep);
      setNotice("RustDesk-Einstellungen gespeichert.");
    });
  }

  async function finishSetup() {
    await run(async () => {
      const res = await fetch("/api/v1/setup/complete", { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Setup konnte nicht abgeschlossen werden.");
      router.push("/login?setup=done");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-4">
      <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="border-b px-8 py-6">
          <h1 className="text-2xl font-bold text-slate-900">RemoteLog Einrichtung</h1>
          <p className="mt-1 text-sm text-slate-600">
            In wenigen Schritten startklar: Admin-Zugang, Mailversand und optional RustDesk.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {steps.map((s, i) => (
              <span
                key={s}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  i < step ? "bg-emerald-100 text-emerald-700" : i === step ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {i + 1}. {s}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-5 px-8 py-7">
          {step === 0 && (
            <section className="space-y-4">
              <div className="rounded-xl border bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Was ist RemoteLog?</p>
                <p className="mt-1 text-sm text-slate-700">
                  RemoteLog hilft IT-Teams bei Kunden- und Geräteverwaltung, Zeiterfassung, Fernwartung und sauberer Dokumentation.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Feature icon={<Sparkles className="h-4 w-4" />} title="Professioneller Start" text="Sauberer Erstkontakt und klare Struktur." />
                <Feature icon={<Mail className="h-4 w-4" />} title="E-Mail direkt testen" text="SMTP gleich prüfen oder später setzen." />
                <Feature icon={<Server className="h-4 w-4" />} title="RustDesk optional" text="Eigene Serverdaten jetzt oder später." />
              </div>
              <button onClick={() => setStep(1)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                Einrichtung starten
              </button>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Admin-Zugang erstellen</h2>
              <Input label="Firmenname" value={orgName} onChange={setOrgName} placeholder="Meine IT-Firma" />
              <Input label="Admin Name" value={adminName} onChange={setAdminName} placeholder="Max Mustermann" />
              <Input label="Admin E-Mail" value={adminEmail} onChange={setAdminEmail} placeholder="admin@example.com" />
              <Input label="Passwort (min. 8 Zeichen)" type="password" value={adminPassword} onChange={setAdminPassword} placeholder="••••••••" />
              <button
                onClick={() => void createAdmin()}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {loading ? "Wird erstellt..." : "Admin anlegen"}
              </button>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">SMTP konfigurieren (optional)</h2>
              <p className="text-sm text-slate-600">DB-Konfiguration hat Vorrang. `.env` wird nur als Fallback genutzt.</p>
              <Input label="SMTP Host" value={smtpHost} onChange={setSmtpHost} placeholder="smtp.example.com" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Port" value={smtpPort} onChange={setSmtpPort} placeholder="587" />
                <Input label="Benutzer" value={smtpUser} onChange={setSmtpUser} placeholder="user@example.com" />
              </div>
              <Input label="Passwort" type="password" value={smtpPass} onChange={setSmtpPass} placeholder={initial.smtp.hasPass ? "Bestehendes Passwort bleibt, wenn leer" : ""} />
              <Input label="Absender (From)" value={smtpFrom} onChange={setSmtpFrom} placeholder="RemoteLog <noreply@example.com>" />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
                TLS/SSL aktiv
              </label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void testSmtp()} disabled={loading} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50">
                  SMTP testen
                </button>
                <button onClick={() => void saveSmtp(3)} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                  Speichern & weiter
                </button>
                <button onClick={() => setStep(3)} disabled={loading} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  Überspringen
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">RustDesk Server (optional)</h2>
              <Input label="ID-Server" value={idServer} onChange={setIdServer} placeholder="id.example.com" />
              <Input label="Relay-Server" value={relay} onChange={setRelay} placeholder="relay.example.com" />
              <Input label="Public Key" value={key} onChange={setKey} placeholder="Base64 Public Key" />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void testRustdesk()} disabled={loading} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50">
                  RustDesk testen
                </button>
                <button onClick={() => void saveRustdesk(4)} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                  Speichern & weiter
                </button>
                <button onClick={() => setStep(4)} disabled={loading} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  Überspringen
                </button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Fertig</h2>
              <p className="text-sm text-slate-600">Dein System ist eingerichtet. Du kannst jetzt mit dem Admin-Login starten.</p>
              <button onClick={() => void finishSetup()} disabled={loading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                {loading ? "Abschließen..." : "Setup abschließen"}
              </button>
            </section>
          )}

          {(error || notice) && (
            <div className={`rounded-lg px-3 py-2 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
              {loading && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
              {error ?? notice}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-2 inline-flex rounded-md bg-blue-50 p-2 text-blue-700">{icon}</div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{text}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}
