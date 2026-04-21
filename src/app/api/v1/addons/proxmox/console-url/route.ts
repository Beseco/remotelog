import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proxmoxConfigSchema } from "@/addons/proxmox/index";
import { ProxmoxClient } from "@/addons/proxmox/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const remoteIdId = searchParams.get("remoteIdId");
  if (!remoteIdId) return NextResponse.json({ error: "remoteIdId required" }, { status: 400 });

  const remoteId = await prisma.remoteId.findFirst({
    where: {
      id: remoteIdId,
      type: "proxmox_console",
      device: { organizationId: session.user.organizationId },
    },
    select: { remoteId: true },
  });
  if (!remoteId) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // Parse vmid, node, console type from the stored URL
  let vmid: number | null = null;
  let node: string | null = null;
  let consoleType: "qemu" | "lxc" = "qemu";
  try {
    const url = new URL(remoteId.remoteId);
    vmid = parseInt(url.searchParams.get("vmid") ?? "", 10) || null;
    node = url.searchParams.get("node");
    const cons = url.searchParams.get("console");
    consoleType = cons === "lxc" ? "lxc" : "qemu";
  } catch {
    return NextResponse.json({ error: "Ungültige Konsolen-URL" }, { status: 400 });
  }

  if (!vmid || !node) return NextResponse.json({ error: "vmid oder node fehlt in der Konsolen-URL" }, { status: 400 });

  const record = await prisma.addon.findFirst({
    where: { organizationId: session.user.organizationId, key: "proxmox" },
  });
  const parsed = proxmoxConfigSchema.safeParse(record?.config);
  if (!parsed.success) return NextResponse.json({ error: "Proxmox-Konfiguration ungültig" }, { status: 400 });

  const config = parsed.data;
  const client = new ProxmoxClient(config.apiUrl, config.tokenId, config.tokenSecret, config.verifySsl);

  try {
    const ticket = await client.getVncTicket(node, vmid, consoleType);
    const base = config.apiUrl.replace(/\/$/, "");
    const type = consoleType === "lxc" ? "lxc" : "kvm";
    const url = `${base}/?console=${type}&vmid=${vmid}&node=${node}&resize=scale&novnc=1&vncticket=${encodeURIComponent(ticket.ticket)}`;
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Fallback: return the original URL so the user can still try
    return NextResponse.json({ url: remoteId.remoteId, warning: `Ticket konnte nicht erstellt werden (${msg}), direkter Link wird verwendet` });
  }
}
