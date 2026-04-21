"use client";

import { useState } from "react";
import Link from "next/link";

const COUNTRIES = [
  "Deutschland",
  "Österreich",
  "Schweiz",
  "Luxemburg",
  "Liechtenstein",
];

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function RegisterPage() {
  const [form, setForm] = useState({
    orgName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    street: "",
    zip: "",
    city: "",
    country: "Deutschland",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/reseller/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: form.orgName,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          street: form.street || undefined,
          zip: form.zip || undefined,
          city: form.city || undefined,
          country: form.country || undefined,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Registrierung fehlgeschlagen");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Netzwerkfehler – bitte versuchen Sie es erneut");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Fast geschafft!</h1>
          <p className="text-sm text-gray-600">
            Wir haben eine Bestätigungs-E-Mail an <strong>{form.email}</strong> gesendet.
            Bitte klicken Sie auf den Link in der E-Mail, um Ihr Konto zu aktivieren.
          </p>
          <p className="text-xs text-gray-400">
            Keine E-Mail erhalten? Prüfen Sie Ihren Spam-Ordner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-gray-900">RemoteLog</h1>
          <p className="text-gray-600">Kostenlos starten — 14 Tage testen</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Company */}
            <Field label="Firma / Organisation" required>
              <input
                type="text"
                required
                placeholder="Meine IT-Firma GmbH"
                value={form.orgName}
                onChange={set("orgName")}
                className={inputClass}
              />
            </Field>

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vorname" required>
                <input
                  type="text"
                  required
                  placeholder="Max"
                  value={form.firstName}
                  onChange={set("firstName")}
                  className={inputClass}
                />
              </Field>
              <Field label="Nachname" required>
                <input
                  type="text"
                  required
                  placeholder="Mustermann"
                  value={form.lastName}
                  onChange={set("lastName")}
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Address */}
            <Field label="Straße und Hausnummer">
              <input
                type="text"
                placeholder="Musterstraße 1"
                value={form.street}
                onChange={set("street")}
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="PLZ">
                <input
                  type="text"
                  placeholder="12345"
                  value={form.zip}
                  onChange={set("zip")}
                  className={inputClass}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Ort">
                  <input
                    type="text"
                    placeholder="Musterstadt"
                    value={form.city}
                    onChange={set("city")}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <Field label="Land">
              <select value={form.country} onChange={set("country")} className={inputClass}>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>

            <hr className="border-gray-100" />

            {/* Account */}
            <Field label="E-Mail-Adresse" required>
              <input
                type="email"
                required
                placeholder="max@firma.de"
                value={form.email}
                onChange={set("email")}
                className={inputClass}
              />
            </Field>

            <Field label="Passwort" required>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Mindestens 8 Zeichen"
                value={form.password}
                onChange={set("password")}
                className={inputClass}
              />
            </Field>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
            >
              {loading ? "Wird angelegt…" : "Kostenlos registrieren"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500">
            Bereits registriert?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Anmelden
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-500">
          14 Tage kostenlos testen — danach{" "}
          <Link href="/pricing" className="text-blue-600 hover:underline">
            ab 9 €/Monat
          </Link>
        </p>
      </div>
    </div>
  );
}
