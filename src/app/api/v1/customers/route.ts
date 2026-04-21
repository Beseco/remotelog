import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resellerGuard } from "@/addons/reseller/guard";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customers = await prisma.customer.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      contacts: { orderBy: { lastName: "asc" } },
      _count: { select: { devices: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const guard = await resellerGuard(session.user.organizationId, "customers");
  if (guard) return guard;

  const body = await req.json();
  const { name, notes, customerNumber, email, phone, website, street, zip, city, country } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });

  const customer = await prisma.customer.create({
    data: {
      name: name.trim(),
      notes: notes?.trim() || null,
      customerNumber: customerNumber?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      street: street?.trim() || null,
      zip: zip?.trim() || null,
      city: city?.trim() || null,
      country: country?.trim() || null,
      organizationId: session.user.organizationId,
    },
    include: {
      contacts: true,
      _count: { select: { devices: true } },
    },
  });

  return NextResponse.json(customer, { status: 201 });
}
