import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { zammadConfigSchema } from "@/addons/zammad/index";
import { ZammadClient } from "@/addons/zammad/client";

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
      select: { zammadOrgId: true },
    }),
    prisma.addon.findFirst({
      where: { organizationId: orgId, key: "zammad", enabled: true },
    }),
  ]);

  if (!customer) {
    return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  }
  if (!customer.zammadOrgId) {
    return NextResponse.json({ tickets: [] });
  }
  if (!addonRecord) {
    return NextResponse.json({ tickets: [] });
  }

  const parsed = zammadConfigSchema.safeParse(addonRecord.config);
  if (!parsed.success) {
    return NextResponse.json({ tickets: [] });
  }

  const client = new ZammadClient(parsed.data.zammadUrl, parsed.data.apiToken);
  const tickets = await client.listTickets(customer.zammadOrgId);

  return NextResponse.json({ tickets });
}
