import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proxmoxConfigSchema } from "@/addons/proxmox/index";
import { ProxmoxClient } from "@/addons/proxmox/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const record = await prisma.addon.findFirst({
    where: { organizationId: session.user.organizationId, key: "proxmox" },
  });

  if (!record?.enabled) {
    return NextResponse.json({ error: "Proxmox-Addon ist nicht aktiviert. Bitte erst speichern." }, { status: 400 });
  }

  const parsed = proxmoxConfigSchema.safeParse(record.config);
  if (!parsed.success) {
    return NextResponse.json({ error: "Konfiguration unvollständig. Bitte erst speichern." }, { status: 400 });
  }

  try {
    const client = new ProxmoxClient(parsed.data.apiUrl, parsed.data.tokenId, parsed.data.tokenSecret, parsed.data.verifySsl);
    const nodes = await client.getNodes();
    return NextResponse.json({ nodes: nodes.map((n) => ({ node: n.node, status: n.status })) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let hint = "";
    if (msg.includes("401") || msg.toLowerCase().includes("authentication")) {
      hint = " — Token ungültig oder fehlendes Recht. Token-Format: root@pam!tokenname=UUID. Tipp: \"Privilege Separation\" deaktivieren oder dem Token die Rolle \"PVEAuditor\" auf Pfad \"/\" zuweisen.";
    } else if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      hint = " — Server nicht erreichbar. URL und Port prüfen (Standard: :8006). SSL-Verifizierung ggf. deaktivieren.";
    }
    return NextResponse.json(
      { error: `Verbindung fehlgeschlagen: ${msg}${hint}` },
      { status: 502 }
    );
  }
}
