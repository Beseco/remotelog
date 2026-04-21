"use client";

import { useState } from "react";
import { useTimer } from "@/lib/timer-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Monitor,
  MoreVertical,
  Pencil,
  Trash2,
  Clock,
  Play,
  Zap,
  AlertTriangle,
  Terminal,
  Loader2,
} from "lucide-react";
import { buildDeeplink, type RemoteType } from "./remote-deeplink";
import { cn } from "@/lib/utils";

// ─── Remote-Typ Icons (SVG) ───────────────────────────────────────────────────

function IconRustDesk({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm-1 4v4H7l5 6 5-6h-4V8h-2z" />
    </svg>
  );
}

function IconTeamViewer({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
    </svg>
  );
}

function IconAnyDesk({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconRDP({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 20h8M12 18v2" />
      <path d="M9 10l2 2 4-4" />
    </svg>
  );
}

function IconSSH({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function IconVNC({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <circle cx="12" cy="11" r="3" />
      <path d="M2 9h20" />
    </svg>
  );
}

function IconProxmox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L3 7v10l9 5 9-5V7L12 2zm0 2.18L19 8.5v7L12 19.82 5 15.5v-7L12 4.18zM12 7l-4 2.31V14l4 2.31L16 14V9.31L12 7z" />
    </svg>
  );
}

const remoteConfig: Record<RemoteType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  text: string;
  border: string;
}> = {
  rustdesk: {
    label: "RustDesk",
    icon: IconRustDesk,
    bg: "bg-blue-500/10 hover:bg-blue-500/20",
    text: "text-blue-600",
    border: "border-blue-200 hover:border-blue-300",
  },
  teamviewer: {
    label: "TeamViewer",
    icon: IconTeamViewer,
    bg: "bg-sky-500/10 hover:bg-sky-500/20",
    text: "text-sky-600",
    border: "border-sky-200 hover:border-sky-300",
  },
  anydesk: {
    label: "AnyDesk",
    icon: IconAnyDesk,
    bg: "bg-orange-500/10 hover:bg-orange-500/20",
    text: "text-orange-600",
    border: "border-orange-200 hover:border-orange-300",
  },
  rdp: {
    label: "RDP",
    icon: IconRDP,
    bg: "bg-purple-500/10 hover:bg-purple-500/20",
    text: "text-purple-600",
    border: "border-purple-200 hover:border-purple-300",
  },
  ssh: {
    label: "SSH",
    icon: IconSSH,
    bg: "bg-green-500/10 hover:bg-green-500/20",
    text: "text-green-600",
    border: "border-green-200 hover:border-green-300",
  },
  vnc: {
    label: "VNC",
    icon: IconVNC,
    bg: "bg-yellow-500/10 hover:bg-yellow-500/20",
    text: "text-yellow-600",
    border: "border-yellow-200 hover:border-yellow-300",
  },
  proxmox_console: {
    label: "Proxmox Konsole",
    icon: IconProxmox,
    bg: "bg-red-500/10 hover:bg-red-500/20",
    text: "text-red-600",
    border: "border-red-200 hover:border-red-300",
  },
};

// ─── Proxmox Console Button (fetches ticket before opening) ─────────────────

function ProxmoxConsoleButton({ r }: { r: RemoteId }) {
  const cfg = remoteConfig.proxmox_console;
  const Icon = cfg.icon;
  const label = r.label || cfg.label;
  const [loading, setLoading] = useState(false);

  async function openConsole() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/addons/proxmox/console-url?remoteIdId=${encodeURIComponent(r.id)}`);
      const data = await res.json() as { url?: string; error?: string };
      const url = data.url ?? r.remoteId;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      window.open(r.remoteId, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={openConsole}
      disabled={loading}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors text-left w-full",
        cfg.bg, cfg.border,
      )}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", cfg.bg)}>
        {loading ? <Loader2 className={cn("h-4 w-4 animate-spin", cfg.text)} /> : <Icon className={cn("h-4 w-4", cfg.text)} />}
      </div>
      <span className={cn("text-sm font-medium", cfg.text)}>{label}</span>
    </button>
  );
}

// ─── Remote-Verbindungs-Buttons ───────────────────────────────────────────────

function RemoteButtons({
  remoteIds,
  ipAddress,
}: {
  remoteIds: RemoteId[];
  ipAddress: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {remoteIds.map((r) => {
        const cfg   = remoteConfig[r.type as RemoteType];
        const Icon  = cfg?.icon ?? Terminal;
        const label = r.label || cfg?.label || r.type;
        const hasCredentials = r.type === "ssh" && !!r.sshUser;

        if (hasCredentials) {
          const terminalUrl = `/ssh-terminal?id=${encodeURIComponent(r.id)}&label=${encodeURIComponent(`${label} (${r.remoteId})`)}`;
          return (
            <div key={r.id} className="flex gap-1.5">
              <button
                type="button"
                onClick={() => window.open(terminalUrl, `ssh-${r.id}`, "width=900,height=600,resizable=yes")}
                className={cn(
                  "flex flex-1 items-center gap-3 rounded-lg border px-3 py-2 transition-colors text-left",
                  cfg.bg, cfg.border,
                )}
              >
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", cfg.bg)}>
                  <Icon className={cn("h-4 w-4", cfg.text)} />
                </div>
                <span className={cn("text-sm font-medium", cfg.text)}>{label}</span>
              </button>
              <a
                href={`/api/v1/ssh/putty?remoteId=${encodeURIComponent(r.id)}`}
                title="PuTTY .bat herunterladen"
                className={cn(
                  "flex items-center justify-center rounded-lg border px-2 transition-colors no-underline shrink-0",
                  cfg.bg, cfg.border,
                )}
              >
                <span className={cn("text-xs font-mono font-semibold", cfg.text)}>bat</span>
              </a>
            </div>
          );
        }

        if (r.type === "proxmox_console") {
          return <ProxmoxConsoleButton key={r.id} r={r} />;
        }

        return (
          <a
            key={r.id}
            href={buildDeeplink(r.type as RemoteType, r.remoteId, ipAddress)}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors no-underline",
              cfg?.bg ?? "bg-muted/50 hover:bg-muted",
              cfg?.border ?? "border-border",
            )}
          >
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", cfg?.bg ?? "bg-muted")}>
              <Icon className={cn("h-4 w-4", cfg?.text ?? "text-muted-foreground")} />
            </div>
            <span className={cn("text-sm font-medium", cfg?.text ?? "text-foreground")}>
              {label}
            </span>
          </a>
        );
      })}
    </div>
  );
}

// ─── WoL ─────────────────────────────────────────────────────────────────────

function WolMenuItem({ deviceId, macAddress }: { deviceId: string; macAddress: string }) {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [infoOpen, setInfoOpen] = useState(false);

  async function sendWol() {
    setState("loading");
    try {
      const res = await fetch(`/api/v1/devices/${deviceId}/wol`, { method: "POST" });
      setState(res.ok ? "sent" : "error");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <>
      <DropdownMenuItem
        onClick={() => setInfoOpen(true)}
        title={`MAC: ${macAddress}`}
      >
        <Zap className="mr-2 h-4 w-4 text-yellow-500" />
        Wake on LAN
      </DropdownMenuItem>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Wake on LAN
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                WoL funktioniert nur wenn RemoteLog im <strong>selben Netzwerk</strong> wie
                das Gerät betrieben wird. Bei Cloud-Hosting erreicht das Paket das Gerät nicht.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">MAC:</span> {macAddress}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => { sendWol(); setInfoOpen(false); }}
              disabled={state === "loading"}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {state === "loading" ? "Sende…" : state === "sent" ? "Gesendet!" : "Senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Session starten ──────────────────────────────────────────────────────────

const SESSION_TYPES = [
  { value: "remote", label: "Remote-Sitzung" },
  { value: "onsite", label: "Vor-Ort-Einsatz" },
  { value: "phone", label: "Telefonsupport" },
] as const;

function StartSessionButton({ deviceId, deviceName }: { deviceId: string; deviceName: string }) {
  const { state, start } = useTimer();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"remote" | "onsite" | "phone">("remote");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerActive = state.status !== "idle";

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      await start({ type: "device", id: deviceId, name: deviceName }, type);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs w-full"
        onClick={() => setOpen(true)}
        disabled={timerActive}
        title={timerActive ? "Zeiterfassung läuft bereits" : undefined}
      >
        <Play className="h-3 w-3 mr-1.5" />
        {timerActive ? "Läuft bereits" : "Sitzung starten"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Sitzung starten</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {SESSION_TYPES.map((t) => (
              <label
                key={t.value}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  type === t.value ? "border-primary bg-primary/5" : "hover:bg-accent"
                )}
              >
                <input
                  type="radio"
                  className="accent-primary"
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => setType(t.value)}
                />
                <span className="text-sm font-medium">{t.label}</span>
              </label>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={handleStart} disabled={loading}>
              {loading ? "Starte…" : "Starten"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

type RemoteId = { id: string; type: string; remoteId: string; label: string | null; sshUser?: string | null };
type Session  = { id: string; startedAt: string; endedAt: string | null; type: string };
type Device   = {
  id: string;
  name: string;
  macAddress: string | null;
  ipAddress: string | null;
  notes: string | null;
  tags: string[];
  remoteIds: RemoteId[];
  group: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  sessions: Session[];
};

export function DeviceCard({
  device,
  canEdit,
  onEdit,
  onDelete,
  proxmoxStatus,
  onlineStatus,
}: {
  device: Device;
  canEdit: boolean;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  proxmoxStatus?: "running" | "stopped" | "paused";
  onlineStatus?: "online" | "offline" | "unknown";
}) {
  const lastSession = device.sessions[0];
  const isActive = lastSession && !lastSession.endedAt;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-sm truncate">{device.name}</h3>
                {proxmoxStatus ? (
                  <span
                    title={proxmoxStatus === "running" ? "Läuft" : proxmoxStatus === "paused" ? "Pausiert" : "Gestoppt"}
                    className={cn(
                      "inline-block h-2 w-2 shrink-0 rounded-full",
                      proxmoxStatus === "running" && "bg-green-500",
                      proxmoxStatus === "paused" && "bg-yellow-500",
                      proxmoxStatus === "stopped" && "bg-red-500",
                    )}
                  />
                ) : onlineStatus && onlineStatus !== "unknown" ? (
                  <span
                    title={onlineStatus === "online" ? "Erreichbar" : "Nicht erreichbar"}
                    className={cn(
                      "inline-block h-2 w-2 shrink-0 rounded-full",
                      onlineStatus === "online" && "bg-green-500",
                      onlineStatus === "offline" && "bg-red-500",
                    )}
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-0">
                {device.group && (
                  <p className="text-xs text-muted-foreground truncate">{device.group.name}</p>
                )}
                {device.contact && (
                  <p className="text-xs text-muted-foreground truncate">
                    {device.contact.firstName} {device.contact.lastName}
                  </p>
                )}
                {device.customer && !device.contact && (
                  <p className="text-xs text-muted-foreground truncate">{device.customer.name}</p>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* WoL — immer sichtbar, auch ohne canEdit */}
              {device.macAddress && (
                <>
                  <WolMenuItem deviceId={device.id} macAddress={device.macAddress} />
                  {canEdit && <DropdownMenuSeparator />}
                </>
              )}
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(device)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(device)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Löschen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0 flex-1">
        {/* IP-Adresse */}
        {device.ipAddress && (
          <p className="text-xs text-muted-foreground">IP: {device.ipAddress}</p>
        )}

        {/* Remote-Connect-Buttons */}
        {device.remoteIds.length > 0 && (
          <RemoteButtons remoteIds={device.remoteIds} ipAddress={device.ipAddress} />
        )}

        {/* Aktive Sitzung */}
        {isActive && (
          <Badge variant="default" className="text-xs w-fit gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
            Sitzung aktiv
          </Badge>
        )}

        {/* Tags */}
        {device.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {device.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs h-5">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Sitzung starten */}
        {canEdit && (
          <div className="mt-auto pt-1">
            <StartSessionButton deviceId={device.id} deviceName={device.name} />
          </div>
        )}

        {/* Letzte Sitzung */}
        {lastSession && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Letzte Sitzung: {new Date(lastSession.startedAt).toLocaleDateString("de-DE")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
