import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeContactNamePart, normalizeEmail, normalizePhoneKey } from "@/lib/contact-name";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: customerId } = await params;
  const body = await req.json();
  const { firstName, lastName, email, emails, phone, mobile, phones, notes } = body as {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    emails?: string[] | null;
    phone?: string | null;
    mobile?: string | null;
    phones?: string[] | null;
    notes?: string | null;
  };

  if (!firstName?.trim()) return NextResponse.json({ error: "Vorname ist erforderlich" }, { status: 400 });
  if (!lastName?.trim()) return NextResponse.json({ error: "Nachname ist erforderlich" }, { status: 400 });

  const first = normalizeContactNamePart(firstName);
  const last = normalizeContactNamePart(lastName);
  if (!first) return NextResponse.json({ error: "Vorname ist erforderlich" }, { status: 400 });
  if (!last) return NextResponse.json({ error: "Nachname ist erforderlich" }, { status: 400 });

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: session.user.organizationId },
  });
  if (!customer) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

  const existing = await prisma.contact.findFirst({
    where: {
      customerId,
      firstName: { equals: first, mode: "insensitive" },
      lastName: { equals: last, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Ein Ansprechpartner mit diesem Namen existiert bereits." },
      { status: 409 }
    );
  }

  const emailByNorm = new Map<string, string>();
  function addEmail(raw: string | null | undefined) {
    const display = raw?.normalize("NFKC").trim();
    if (!display) return;
    const key = normalizeEmail(display);
    if (!key) return;
    if (!emailByNorm.has(key)) emailByNorm.set(key, display);
  }
  if (Array.isArray(emails)) for (const e of emails) addEmail(e);
  addEmail(email);

  const phoneByKey = new Map<string, string>();
  function addPhoneRaw(raw: string | null | undefined) {
    const display = raw?.normalize("NFKC").trim();
    if (!display) return;
    const key = normalizePhoneKey(display);
    if (!key) return;
    if (!phoneByKey.has(key)) phoneByKey.set(key, display);
  }
  if (Array.isArray(phones)) for (const p of phones) addPhoneRaw(p);
  addPhoneRaw(phone);
  addPhoneRaw(mobile);

  const emailsOut = [...emailByNorm.values()];
  const phonesOut = [...phoneByKey.values()];

  const scalarEmail = email?.normalize("NFKC").trim() || emailsOut[0] || null;
  const scalarPhone = phone?.normalize("NFKC").trim() || phonesOut[0] || null;
  const scalarMobile = mobile?.normalize("NFKC").trim() || phonesOut.find((p) => (
    normalizePhoneKey(p) && normalizePhoneKey(scalarPhone)
      ? normalizePhoneKey(p) !== normalizePhoneKey(scalarPhone)
      : p !== scalarPhone
  )) || null;

  const contact = await prisma.contact.create({
    data: {
      customerId,
      firstName: first,
      lastName: last,
      emails: emailsOut,
      phones: phonesOut,
      email: scalarEmail,
      phone: scalarPhone,
      mobile: scalarMobile,
      notes: notes?.trim() || null,
    },
  });

  return NextResponse.json(contact, { status: 201 });
}
