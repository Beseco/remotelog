import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proxmoxConfigSchema } from "@/addons/proxmox/index";
import { ProxmoxClient } from "@/addons/proxmox/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.addon.findFirst({
    where: { organizationId: session.user.organizationId, key: "proxmox", enabled: true },
  });
  if (!record) return NextResponse.json([]);

  const parsed = proxmoxConfigSchema.safeParse(record.config);
  if (!parsed.success) return NextResponse.json([]);

  const config = parsed.data;
  const client = new ProxmoxClient(config.apiUrl, config.tokenId, config.tokenSecret, config.verifySsl);

  try {
    const nodes = await client.getNodes();
    const statuses = await client.getAllStatuses(nodes);
    return NextResponse.json(statuses);
  } catch {
    return NextResponse.json([]);
  }
}
