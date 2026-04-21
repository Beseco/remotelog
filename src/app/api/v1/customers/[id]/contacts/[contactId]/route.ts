import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeContactNamePart, normalizeEmail, normalizePhoneKey } from "@/lib/contact-name";

type Params = { params: Promise<{ id: string; contactId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: customerId, contactId } = await params;
  const body = await req.json() as {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    emails?: string[] | null;
    phone?: string | null;
    mobile?: string | null;
    phones?: string[] | null;
    notes?: string | null;
  };

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, customerId, customer: { organizationId: session.user.organizationId } },
  });
  if (!contact) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const nextFirst = body.firstName !== undefined ? normalizeContactNamePart(body.firstName) : contact.firstName;
  const nextLast = body.lastName !== undefined ? normalizeContactNamePart(body.lastName) : contact.lastName;

  const emailByNorm = new Map<string, string>();
  function addEmail(raw: string | null | undefined) {
    const display = raw?.normalize("NFKC").trim();
    if (!display) return;
    const key = normalizeEmail(display);
    if (!key) return;
    if (!emailByNorm.has(key)) emailByNorm.set(key, display);
  }
  if (body.emails !== undefined) {
    if (Array.isArray(body.emails)) for (const e of body.emails) addEmail(e);
  } else {
    for (const e of contact.emails) addEmail(e);
    addEmail(contact.email);
  }
  if (body.email !== undefined) addEmail(body.email);

  const phoneByKey = new Map<string, string>();
  function addPhoneRaw(raw: string | null | undefined) {
    const display = raw?.normalize("NFKC").trim();
    if (!display) return;
    const key = normalizePhoneKey(display);
    if (!key) return;
    if (!phoneByKey.has(key)) phoneByKey.set(key, display);
  }
  if (body.phones !== undefined) {
    if (Array.isArray(body.phones)) for (const p of body.phones) addPhoneRaw(p);
  } else {
    for (const p of contact.phones) addPhoneRaw(p);
    addPhoneRaw(contact.phone);
    addPhoneRaw(contact.mobile);
  }
  if (body.phone !== undefined) addPhoneRaw(body.phone);
  if (body.mobile !== undefined) addPhoneRaw(body.mobile);

  const emailsOut = [...emailByNorm.values()];
  const phonesOut = [...phoneByKey.values()];

  const scalarEmail = body.email !== undefined
    ? (body.email?.normalize("NFKC").trim() || null)
    : (contact.email ?? emailsOut[0] ?? null);
  const scalarPhone = body.phone !== undefined
    ? (body.phone?.normalize("NFKC").trim() || null)
    : (contact.phone ?? phonesOut[0] ?? null);
  const scalarMobile = body.mobile !== undefined
    ? (body.mobile?.normalize("NFKC").trim() || null)
    : (contact.mobile ?? phonesOut.find((p) => (
      normalizePhoneKey(p) && normalizePhoneKey(scalarPhone)
        ? normalizePhoneKey(p) !== normalizePhoneKey(scalarPhone)
        : p !== scalarPhone
    )) ?? null);

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: {
      firstName: nextFirst,
      lastName:  nextLast,
      emails: emailsOut,
      phones: phonesOut,
      email: scalarEmail,
      phone: scalarPhone,
      mobile: scalarMobile,
      notes: body.notes !== undefined ? (body.notes?.trim() || null) : contact.notes,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: customerId, contactId } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, customerId, customer: { organizationId: session.user.organizationId } },
  });
  if (!contact) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.contact.delete({ where: { id: contactId } });
  return NextResponse.json({ ok: true });
}
