import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceNinjaConfigSchema, invoiceNinjaAddonMeta } from "@/addons/invoiceninja/index";
import { runInvoiceNinjaSync } from "@/addons/invoiceninja/sync";
import { checkAddonAccess } from "@/addons/license";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const record = await prisma.addon.findFirst({
    where: { organizationId: session.user.organizationId, key: "invoiceninja" },
  });

  if (!record?.enabled) {
    return NextResponse.json({ error: "Invoice Ninja Addon ist nicht aktiviert" }, { status: 400 });
  }

  const access = checkAddonAccess(invoiceNinjaAddonMeta.isPremium, record.config as Record<string, unknown>);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const parsed = invoiceNinjaConfigSchema.safeParse(record.config);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Addon-Konfiguration unvollständig", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const summary = await runInvoiceNinjaSync(session.user.organizationId, parsed.data);
  return NextResponse.json(summary);
}
