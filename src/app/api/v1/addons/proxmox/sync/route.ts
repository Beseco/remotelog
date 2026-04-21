import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proxmoxConfigSchema, proxmoxAddonMeta } from "@/addons/proxmox/index";
import { runProxmoxSync } from "@/addons/proxmox/sync";
import { checkAddonAccess } from "@/addons/license";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const record = await prisma.addon.findFirst({
    where: { organizationId: session.user.organizationId, key: "proxmox" },
  });

  if (!record?.enabled) {
    return NextResponse.json({ error: "Proxmox-Addon ist nicht aktiviert" }, { status: 400 });
  }

  const access = checkAddonAccess(proxmoxAddonMeta.isPremium, record.config as Record<string, unknown>);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const parsed = proxmoxConfigSchema.safeParse(record.config);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Addon-Konfiguration unvollständig", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const summary = await runProxmoxSync(session.user.organizationId, parsed.data);
  return NextResponse.json(summary);
}
