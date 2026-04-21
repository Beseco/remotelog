import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceNinjaConfigSchema } from "@/addons/invoiceninja/index";
import { InvoiceNinjaClient } from "@/addons/invoiceninja/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json({ error: "customerId erforderlich" }, { status: 400 });
  }

  const orgId = session.user.organizationId;

  const [customer, addonRecord] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
      select: { invoiceNinjaId: true },
    }),
    prisma.addon.findFirst({
      where: { organizationId: orgId, key: "invoiceninja", enabled: true },
    }),
  ]);

  if (!customer) {
    return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  }
  if (!customer.invoiceNinjaId || !addonRecord) {
    return NextResponse.json({ invoices: [] });
  }

  const parsed = invoiceNinjaConfigSchema.safeParse(addonRecord.config);
  if (!parsed.success) {
    return NextResponse.json({ invoices: [] });
  }

  const client = new InvoiceNinjaClient(parsed.data.invoiceNinjaUrl, parsed.data.apiToken);
  const invoices = await client.listInvoices(customer.invoiceNinjaId);

  return NextResponse.json({ invoices });
}
