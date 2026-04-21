import { NextRequest, NextResponse } from "next/server";
import { apiAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizePhoneKey } from "@/lib/contact-name";

export async function POST(req: NextRequest) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { primaryId, duplicateId } = await req.json() as { primaryId?: string; duplicateId?: string };
  if (!primaryId || !duplicateId) {
    return NextResponse.json({ error: "primaryId und duplicateId sind erforderlich" }, { status: 400 });
  }
  if (primaryId === duplicateId) {
    return NextResponse.json({ error: "primary und duplicate dürfen nicht gleich sein" }, { status: 400 });
  }

  // Verify both contacts belong to this organization
  const [primary, duplicate] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: primaryId, customer: { organizationId: user.organizationId } },
      include: { devices: { select: { id: true } } },
    }),
    prisma.contact.findFirst({
      where: { id: duplicateId, customer: { organizationId: user.organizationId } },
      include: { devices: { select: { id: true } } },
    }),
  ]);

  if (!primary) return NextResponse.json({ error: "Primärer Kontakt nicht gefunden" }, { status: 404 });
  if (!duplicate) return NextResponse.json({ error: "Duplikat nicht gefunden" }, { status: 404 });

  // 1. Reassign all sessions from duplicate → primary
  await prisma.session.updateMany({
    where: { contactId: duplicateId },
    data: { contactId: primaryId },
  });

  // 2. Reassign devices from duplicate → primary (skip already-linked ones)
  const primaryDeviceIds = new Set(primary.devices.map((d) => d.id));
  const devicesToConnect = duplicate.devices
    .filter((d) => !primaryDeviceIds.has(d.id))
    .map((d) => ({ id: d.id }));
  if (devicesToConnect.length > 0) {
    await prisma.contact.update({
      where: { id: primaryId },
      data: { devices: { connect: devicesToConnect } },
    });
  }

  // 3. Transfer external IDs if primary is missing them
  const updateData: { invoiceNinjaId?: string; zammadUserId?: number } = {};
  if (!primary.invoiceNinjaId && duplicate.invoiceNinjaId) {
    updateData.invoiceNinjaId = duplicate.invoiceNinjaId;
  }
  if (!primary.zammadUserId && duplicate.zammadUserId) {
    updateData.zammadUserId = duplicate.zammadUserId;
  }
  if (Object.keys(updateData).length > 0) {
    await prisma.contact.update({ where: { id: primaryId }, data: updateData });
  }

  // 4. Merge emails/phones (+ legacy scalar fields) onto primary
  const emailByNorm = new Map<string, string>();
  function addEmail(raw: string | null | undefined) {
    const display = raw?.normalize("NFKC").trim();
    if (!display) return;
    const key = normalizeEmail(display);
    if (!key) return;
    if (!emailByNorm.has(key)) emailByNorm.set(key, display);
  }
  for (const e of primary.emails) addEmail(e);
  for (const e of duplicate.emails) addEmail(e);
  addEmail(primary.email);
  addEmail(duplicate.email);
  const mergedEmails = [...emailByNorm.values()];

  const phoneByKey = new Map<string, string>();
  function addPhone(raw: string | null | undefined) {
    const display = raw?.normalize("NFKC").trim();
    if (!display) return;
    const key = normalizePhoneKey(display);
    if (!key) return;
    if (!phoneByKey.has(key)) phoneByKey.set(key, display);
  }
  for (const p of primary.phones) addPhone(p);
  for (const p of duplicate.phones) addPhone(p);
  addPhone(primary.phone);
  addPhone(primary.mobile);
  addPhone(duplicate.phone);
  addPhone(duplicate.mobile);
  const mergedPhones = [...phoneByKey.values()];

  const nextEmail = primary.email ?? duplicate.email ?? mergedEmails[0] ?? null;
  const nextPhone = primary.phone ?? duplicate.phone ?? mergedPhones[0] ?? null;
  const nextMobile = primary.mobile ?? duplicate.mobile ?? mergedPhones.find((p) => (
    normalizePhoneKey(p) && normalizePhoneKey(nextPhone)
      ? normalizePhoneKey(p) !== normalizePhoneKey(nextPhone)
      : p !== nextPhone
  )) ?? null;

  await prisma.contact.update({
    where: { id: primaryId },
    data: {
      emails: mergedEmails,
      phones: mergedPhones,
      email: nextEmail,
      phone: nextPhone,
      mobile: nextMobile,
    },
  });

  // 5. Delete the duplicate
  await prisma.contact.delete({ where: { id: duplicateId } });

  return NextResponse.json({ ok: true });
}
