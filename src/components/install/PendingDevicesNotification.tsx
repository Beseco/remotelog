"use client";

import { useEffect, useState, useCallback } from "react";
import { Monitor, X, ChevronRight, Bell } from "lucide-react";

type Registration = {
  id: string;
  email: string | null;
  computerName: string | null;
  rustdeskId: string;
  createdAt: string;
};

type Customer = {
  id: string;
  name: string;
};

function AssignModal({
  reg,
  customers,
  onAssigned,
  onClose,
}: {
  reg: Registration;
  customers: Customer[];
  onAssigned: () => void;
  onClose: () => void;
}) {
  const [deviceName, setDeviceName] = useState(reg.computerName ?? "");
  const [customerId, setCustomerId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAssign() {
    setLoading(true);
    await fetch(`/api/v1/install/registrations/${reg.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceName, customerId: customerId || undefined }),
    });
    setLoading(false);
    onAssigned();
    onClose();
  }

  async function handleIgnore() {
    await fetch(`/api/v1/install/registrations/${reg.id}/ignore`, { method: "POST" });
    onAssigned();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Neues Gerät zuweisen</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {reg.computerName ?? "Unbekannter Computer"} · RustDesk-ID: {reg.rustdeskId}
            </p>
            {reg.email && (
              <p className="text-sm text-blue-600 mt-0.5">{reg.email}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Gerätename</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="z.B. Büro-PC Max Mustermann"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">
              Kunde zuweisen <span className="text-gray-400">(optional)</span>
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— Kein Kunde —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => void handleAssign()}
            disabled={loading || !deviceName.trim()}
            className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
          >
            {loading ? "Wird gespeichert…" : "Gerät anlegen"}
          </button>
          <button
            onClick={() => void handleIgnore()}
            className="rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium px-4 py-2 transition-colors"
          >
            Ignorieren
          </button>
        </div>
      </div>
    </div>
  );
}

export function PendingDevicesNotification({ customers }: { customers: Customer[] }) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Registration | null>(null);
  const [prevCount, setPrevCount] = useState(0);
  const [flash, setFlash] = useState(false);

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/install/registrations");
      if (!res.ok) return;
      const data = (await res.json()) as Registration[];
      setRegistrations(data);
      if (data.length > prevCount && prevCount >= 0) {
        setFlash(true);
        setTimeout(() => setFlash(false), 3000);
      }
      setPrevCount(data.length);
    } catch {
      // ignore
    }
  }, [prevCount]);

  useEffect(() => {
    void fetchRegistrations();
    const interval = setInterval(() => void fetchRegistrations(), 30_000);
    return () => clearInterval(interval);
  }, [fetchRegistrations]);

  if (registrations.length === 0) return null;

  return (
    <>
      {/* Floating notification button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`relative flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            flash
              ? "bg-blue-600 text-white scale-105"
              : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <Bell className={`h-4 w-4 ${flash ? "animate-bounce" : ""}`} />
          <span>
            {registrations.length} neue{registrations.length === 1 ? "s Gerät" : " Geräte"}
          </span>
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {registrations.length}
          </span>
        </button>

        {open && (
          <div className="absolute bottom-14 right-0 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Neue Geräte warten</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {registrations.map((reg) => (
                <button
                  key={reg.id}
                  onClick={() => { setSelected(reg); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 shrink-0">
                    <Monitor className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {reg.computerName ?? "Unbekannter PC"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {reg.email ?? reg.rustdeskId}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Assign modal */}
      {selected && (
        <AssignModal
          reg={selected}
          customers={customers}
          onAssigned={() => void fetchRegistrations()}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
