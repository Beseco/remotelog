import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { zammadConfigSchema } from "@/addons/zammad/index";
import { ZammadClient } from "@/addons/zammad/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const record = await prisma.addon.findFirst({
    where: { organizationId: session.user.organizationId, key: "zammad" },
  });

  const parsed = zammadConfigSchema.safeParse(record?.config ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Konfiguration unvollständig" }, { status: 400 });
  }

  try {
    const client = new ZammadClient(parsed.data.zammadUrl, parsed.data.apiToken);
    const orgs = await client.listOrganizations(1, 100);
    return NextResponse.json({ ok: true, orgCount: orgs.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Verbindung fehlgeschlagen" },
      { status: 502 }
    );
  }
}
