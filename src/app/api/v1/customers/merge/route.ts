import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/v1/customers/merge
// Body: { primaryId: string, secondaryId: string }
// Moves all relations from secondary → primary, then deletes secondary.
// The primary's invoiceNinjaId and customerNumber are always preserved.
// Nothing is changed in Invoice Ninja.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { primaryId?: string; secondaryId?: string };
  const { primaryId, secondaryId } = body;

  if (!primaryId || !secondaryId) {
    return NextResponse.json({ error: "primaryId und secondaryId erforderlich" }, { status: 400 });
  }
  if (primaryId === secondaryId) {
    return NextResponse.json({ error: "Kunden müssen verschieden sein" }, { status: 400 });
  }

  const orgId = session.user.organizationId;

  const [primary, secondary] = await Promise.all([
    prisma.customer.findFirst({ where: { id: primaryId, organizationId: orgId } }),
    prisma.customer.findFirst({ where: { id: secondaryId, organizationId: orgId } }),
  ]);

  if (!primary) return NextResponse.json({ error: "Primärer Kunde nicht gefunden" }, { status: 404 });
  if (!secondary) return NextResponse.json({ error: "Sekundärer Kunde nicht gefunden" }, { status: 404 });

  // Move all relations from secondary → primary in a transaction
  await prisma.$transaction([
    // Contacts
    prisma.contact.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    }),
    // Devices
    prisma.device.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    }),
    // Groups
    prisma.group.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    }),
    // Sessions
    prisma.session.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    }),
    // Delete secondary
    prisma.customer.delete({ where: { id: secondaryId } }),
  ]);

  // If primary has no invoiceNinjaId but secondary did → take it over
  // Also take customerNumber from secondary if primary has none
  // (secondary's IN record stays untouched in Invoice Ninja)
  const updateData: Record<string, string> = {};
  if (!primary.invoiceNinjaId && secondary.invoiceNinjaId) {
    updateData.invoiceNinjaId = secondary.invoiceNinjaId;
  }
  if (!primary.customerNumber && secondary.customerNumber) {
    updateData.customerNumber = secondary.customerNumber;
  }
  if (Object.keys(updateData).length > 0) {
    await prisma.customer.update({ where: { id: primaryId }, data: updateData });
  }

  const merged = await prisma.customer.findUnique({
    where: { id: primaryId },
    include: {
      contacts: { orderBy: { lastName: "asc" } },
      _count: { select: { devices: true } },
    },
  });

  return NextResponse.json(merged);
}
