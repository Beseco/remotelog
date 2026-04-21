import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceNinjaConfigSchema } from "@/addons/invoiceninja/index";
import { InvoiceNinjaClient } from "@/addons/invoiceninja/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const record = await prisma.addon.findFirst({
    where: { organizationId: session.user.organizationId, key: "invoiceninja" },
  });

  const parsed = invoiceNinjaConfigSchema.safeParse(record?.config ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Konfiguration unvollständig" }, { status: 400 });
  }

  try {
    const client = new InvoiceNinjaClient(parsed.data.invoiceNinjaUrl, parsed.data.apiToken);
    const total = await client.testConnection();
    return NextResponse.json({ ok: true, total });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Verbindung fehlgeschlagen" },
      { status: 502 }
    );
  }
}
