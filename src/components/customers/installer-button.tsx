"use client";

import { useState } from "react";
import { Download, Monitor, Terminal, ShieldCheck, Eye, X } from "lucide-react";

interface Props {
  customerId: string;
  customerName: string;
}

type OS = "windows" | "linux";
type Mode = "unattended" | "approval";

export function CustomerInstallerButton({ customerId, customerName }: Props) {
  const [open, setOpen] = useState(false);

  function download(os: OS, mode: Mode) {
    window.location.href = `/api/v1/install/customer-script?customerId=${customerId}&os=${os}&mode=${mode}`;
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs text-gray-700 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        Installer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Installer herunterladen</h2>
                <p className="text-xs text-gray-500 mt-0.5">{customerName} · Gerät wird automatisch zugeordnet</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Unattended */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">Unbeaufsichtigt</span>
                </div>
                <p className="text-xs text-gray-500">Passwort wird gesetzt — Techniker kann jederzeit zugreifen.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => download("windows", "unattended")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs hover:bg-blue-700 transition-colors"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    Windows (.cmd)
                  </button>
                  <button
                    onClick={() => download("linux", "unattended")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-blue-300 text-blue-700 bg-white px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    Linux (.sh)
                  </button>
                </div>
              </div>

              {/* Approval */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-gray-900">Mit Genehmigung</span>
                </div>
                <p className="text-xs text-gray-500">Kein Passwort — Nutzer muss jeden Zugriff bestätigen.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => download("windows", "approval")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 text-white px-3 py-1.5 text-xs hover:bg-amber-600 transition-colors"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    Windows (.cmd)
                  </button>
                  <button
                    onClick={() => download("linux", "approval")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 text-amber-700 bg-white px-3 py-1.5 text-xs hover:bg-amber-50 transition-colors"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    Linux (.sh)
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Für Softwareverteilung (MDM/GPO): Die CMD-Datei muss als Administrator ausgeführt werden und kann auf mehreren Geräten verwendet werden.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
