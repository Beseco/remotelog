import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceNinjaConfigSchema } from "@/addons/invoiceninja/index";
import { InvoiceNinjaClient } from "@/addons/invoiceninja/client";

const typeLabels: Record<string, string> = {
  remote: "Remote-Support",
  onsite: "Vor-Ort-Einsatz",
  phone: "Telefon-Support",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { sessionIds?: string[] };
  if (!Array.isArray(body.sessionIds) || body.sessionIds.length === 0) {
    return NextResponse.json({ error: "sessionIds erforderlich" }, { status: 400 });
  }

  const orgId = session.user.organizationId;

  const addonRecord = await prisma.addon.findFirst({
    where: { organizationId: orgId, key: "invoiceninja", enabled: true },
  });
  if (!addonRecord) {
    return NextResponse.json({ error: "Invoice Ninja Addon nicht aktiv" }, { status: 400 });
  }

  const parsed = invoiceNinjaConfigSchema.safeParse(addonRecord.config);
  if (!parsed.success) {
    return NextResponse.json({ error: "Addon-Konfiguration unvollständig" }, { status: 400 });
  }

  const client = new InvoiceNinjaClient(parsed.data.invoiceNinjaUrl, parsed.data.apiToken);

  let transferred = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const sessionId of body.sessionIds) {
    try {
      const s = await prisma.session.findFirst({
        where: { id: sessionId, customer: { organizationId: orgId } },
        include: {
          device: { select: { name: true } },
          customer: { select: { invoiceNinjaId: true } },
          project: { select: { invoiceNinjaProjectId: true } },
        },
      });

      if (!s || !s.endedAt || !s.customer?.invoiceNinjaId) {
        skipped++;
        continue;
      }
      if (s.invoiceNinjaTaskId) {
        skipped++;
        continue;
      }

      const deviceName = s.device?.name ?? "Unbekanntes Gerät";
      const typeLabel = typeLabels[s.type] ?? s.type;
      const dateStr = s.startedAt.toLocaleDateString("de-DE");
      const description = `${typeLabel}: ${deviceName} (${dateStr})`;

      const startUnix = Math.floor(s.startedAt.getTime() / 1000);
      const endUnix = Math.floor(s.endedAt.getTime() / 1000);
      const timeLog = JSON.stringify([[startUnix, endUnix]]);

      const task = await client.createTask({
        client_id: s.customer.invoiceNinjaId,
        description,
        time_log: timeLog,
        ...(s.project?.invoiceNinjaProjectId ? { project_id: s.project.invoiceNinjaProjectId } : {}),
      });

      await prisma.session.update({
        where: { id: sessionId },
        data: { invoiceNinjaTaskId: task.id },
      });

      transferred++;
    } catch (err) {
      errors.push(`Sitzung ${sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ transferred, skipped, errors });
}
