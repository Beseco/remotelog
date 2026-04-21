export type RemoteType = "rustdesk" | "teamviewer" | "anydesk" | "rdp" | "ssh" | "vnc" | "proxmox_console";

export function buildDeeplink(type: RemoteType, remoteId: string, ipAddress?: string | null): string {
  switch (type) {
    case "rustdesk":
      return `rustdesk://connect/${remoteId}`;
    case "teamviewer":
      return `teamviewer://control?device=${remoteId}`;
    case "anydesk":
      return `anydesk:${remoteId}`;
    case "rdp":
      return `ms-rd:full%20address=s:${ipAddress ?? remoteId}`;
    case "ssh":
      return `ssh://${ipAddress ?? remoteId}`;
    case "vnc":
      return `vnc://${ipAddress ?? remoteId}`;
    case "proxmox_console":
      return remoteId;
    default:
      return "#";
  }
}

export const remoteTypeLabels: Record<RemoteType, string> = {
  rustdesk: "RustDesk",
  teamviewer: "TeamViewer",
  anydesk: "AnyDesk",
  rdp: "RDP",
  ssh: "SSH",
  vnc: "VNC",
  proxmox_console: "Proxmox",
};

export const remoteTypeColors: Record<RemoteType, string> = {
  rustdesk: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  teamviewer: "bg-sky-500/10 text-sky-500 hover:bg-sky-500/20",
  anydesk: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
  rdp: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
  ssh: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  vnc: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
  proxmox_console: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
};
