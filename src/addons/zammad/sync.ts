import { prisma } from "@/lib/prisma";
import { normalizeContactNamePart, normalizeEmail, normalizePhoneKey } from "@/lib/contact-name";
import { ZammadClient } from "./client";
import type { ZammadConfig } from "./index";

export type SyncSummary = {
  // Phase 1: Zammad → Remotelog
  customersCreated: number;
  customersUpdated: number;
  contactsCreated: number;
  contactsUpdated: number;
  // Phase 2: Remotelog → Zammad
  orgsCreated: number;
  orgsUpdated: number;
  errors: string[];
};

export async function runZammadSync(
  organizationId: string,
  config: ZammadConfig
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    customersCreated: 0,
    customersUpdated: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    orgsCreated: 0,
    orgsUpdated: 0,
    errors: [],
  };

  const client = new ZammadClient(config.zammadUrl, config.apiToken);

  // ────────────────────────────────────────────────
  // Phase 1: Zammad → Remotelog
  // ────────────────────────────────────────────────
  for await (const zammadOrg of client.allOrganizations()) {
    // Skip Zammad's built-in placeholder org (id 1 is usually "-") and inactive orgs
    if (zammadOrg.id <= 1 || !zammadOrg.name?.trim() || zammadOrg.active === false) continue;

    let customerId: string;

    try {
      // 1. Suche per Zammad-ID (exakter Treffer bei Re-Sync)
      let existing = await prisma.customer.findFirst({
        where: { organizationId, zammadOrgId: zammadOrg.id },
        select: { id: true },
      });

      // 2. Fallback: Namens-Match für manuell angelegte Kunden ohne zammadOrgId
      if (!existing) {
        existing = await prisma.customer.findFirst({
          where: {
            organizationId,
            zammadOrgId: null,
            name: { equals: zammadOrg.name, mode: "insensitive" },
          },
          select: { id: true },
        });
      }

      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: { name: zammadOrg.name, zammadOrgId: zammadOrg.id },
        });
        customerId = existing.id;
        summary.customersUpdated++;
      } else {
        const created = await prisma.customer.create({
          data: {
            name: zammadOrg.name,
            organizationId,
            zammadOrgId: zammadOrg.id,
          },
          select: { id: true },
        });
        customerId = created.id;
        summary.customersCreated++;
      }
    } catch (err) {
      summary.errors.push(
        `Organisation "${zammadOrg.name}" (ID ${zammadOrg.id}): ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    for (const memberId of zammadOrg.member_ids ?? []) {
      try {
        const zUser = await client.getUser(memberId);

        // Skip system users or users without a name
        if (memberId <= 1) continue;
        const firstName = normalizeContactNamePart(zUser.firstname?.trim() || "");
        const lastName = normalizeContactNamePart(zUser.lastname?.trim() || "");
        if (!firstName && !lastName) continue;

        const existingContact = await prisma.contact.findFirst({
          where: { customerId, zammadUserId: memberId },
          select: { id: true },
        });

        if (existingContact) {
          const emailByNorm = new Map<string, string>();
          function addEmail(raw: string | null | undefined) {
            const display = raw?.normalize("NFKC").trim();
            if (!display) return;
            const key = normalizeEmail(display);
            if (!key) return;
            if (!emailByNorm.has(key)) emailByNorm.set(key, display);
          }
          const phoneByKey = new Map<string, string>();
          function addPhoneRaw(raw: string | null | undefined) {
            const display = raw?.normalize("NFKC").trim();
            if (!display) return;
            const key = normalizePhoneKey(display);
            if (!key) return;
            if (!phoneByKey.has(key)) phoneByKey.set(key, display);
          }

          const cur = await prisma.contact.findUnique({
            where: { id: existingContact.id },
            select: { emails: true, phones: true, email: true, phone: true, mobile: true },
          });
          for (const e of cur?.emails ?? []) addEmail(e);
          for (const p of cur?.phones ?? []) addPhoneRaw(p);
          addEmail(cur?.email);
          addPhoneRaw(cur?.phone);
          addPhoneRaw(cur?.mobile);

          addEmail(zUser.email);
          addPhoneRaw(zUser.phone);
          addPhoneRaw(zUser.mobile);

          const emailsOut = [...emailByNorm.values()];
          const phonesOut = [...phoneByKey.values()];
          const scalarEmail = zUser.email?.normalize("NFKC").trim() || cur?.email || emailsOut[0] || null;
          const scalarPhone = zUser.phone?.normalize("NFKC").trim() || cur?.phone || phonesOut[0] || null;
          const scalarMobile = zUser.mobile?.normalize("NFKC").trim() || cur?.mobile || phonesOut.find((p) => (
            normalizePhoneKey(p) && normalizePhoneKey(scalarPhone)
              ? normalizePhoneKey(p) !== normalizePhoneKey(scalarPhone)
              : p !== scalarPhone
          )) || null;

          await prisma.contact.update({
            where: { id: existingContact.id },
            data: {
              firstName: firstName || "-",
              lastName: lastName || "-",
              emails: emailsOut,
              phones: phonesOut,
              email: scalarEmail,
              phone: scalarPhone,
              mobile: scalarMobile,
            },
          });
          summary.contactsUpdated++;
        } else {
          const emailKey = zUser.email?.normalize("NFKC").trim().toLowerCase();
          const safeFirst = firstName || "-";
          const safeLast = lastName || "-";
          const hasRealName = safeFirst !== "-" || safeLast !== "-";

          const matchByIdentity = await prisma.contact.findFirst({
            where: {
              customerId,
              OR: [
                ...(emailKey
                  ? [{ email: { equals: zUser.email, mode: "insensitive" as const } }]
                  : []),
                ...(hasRealName
                  ? [{
                    AND: [
                      { firstName: { equals: safeFirst, mode: "insensitive" as const } },
                      { lastName: { equals: safeLast, mode: "insensitive" as const } },
                    ],
                  }]
                  : []),
              ],
            },
            select: { id: true, zammadUserId: true },
          });

          if (matchByIdentity && matchByIdentity.zammadUserId !== memberId) {
            const emailByNorm = new Map<string, string>();
            function addEmail(raw: string | null | undefined) {
              const display = raw?.normalize("NFKC").trim();
              if (!display) return;
              const key = normalizeEmail(display);
              if (!key) return;
              if (!emailByNorm.has(key)) emailByNorm.set(key, display);
            }
            const phoneByKey = new Map<string, string>();
            function addPhoneRaw(raw: string | null | undefined) {
              const display = raw?.normalize("NFKC").trim();
              if (!display) return;
              const key = normalizePhoneKey(display);
              if (!key) return;
              if (!phoneByKey.has(key)) phoneByKey.set(key, display);
            }

            const cur = await prisma.contact.findUnique({
              where: { id: matchByIdentity.id },
              select: { emails: true, phones: true, email: true, phone: true, mobile: true },
            });
            for (const e of cur?.emails ?? []) addEmail(e);
            for (const p of cur?.phones ?? []) addPhoneRaw(p);
            addEmail(cur?.email);
            addPhoneRaw(cur?.phone);
            addPhoneRaw(cur?.mobile);

            addEmail(zUser.email);
            addPhoneRaw(zUser.phone);
            addPhoneRaw(zUser.mobile);

            const emailsOut = [...emailByNorm.values()];
            const phonesOut = [...phoneByKey.values()];
            const scalarEmail = zUser.email?.normalize("NFKC").trim() || cur?.email || emailsOut[0] || null;
            const scalarPhone = zUser.phone?.normalize("NFKC").trim() || cur?.phone || phonesOut[0] || null;
            const scalarMobile = zUser.mobile?.normalize("NFKC").trim() || cur?.mobile || phonesOut.find((p) => (
              normalizePhoneKey(p) && normalizePhoneKey(scalarPhone)
                ? normalizePhoneKey(p) !== normalizePhoneKey(scalarPhone)
                : p !== scalarPhone
            )) || null;

            await prisma.contact.update({
              where: { id: matchByIdentity.id },
              data: {
                zammadUserId: memberId,
                firstName: firstName || "-",
                lastName: lastName || "-",
                emails: emailsOut,
                phones: phonesOut,
                email: scalarEmail,
                phone: scalarPhone,
                mobile: scalarMobile,
              },
            });
            summary.contactsUpdated++;
            continue;
          }

          const emailByNorm = new Map<string, string>();
          function addEmailNew(raw: string | null | undefined) {
            const display = raw?.normalize("NFKC").trim();
            if (!display) return;
            const key = normalizeEmail(display);
            if (!key) return;
            if (!emailByNorm.has(key)) emailByNorm.set(key, display);
          }
          const phoneByKey = new Map<string, string>();
          function addPhoneNew(raw: string | null | undefined) {
            const display = raw?.normalize("NFKC").trim();
            if (!display) return;
            const key = normalizePhoneKey(display);
            if (!key) return;
            if (!phoneByKey.has(key)) phoneByKey.set(key, display);
          }
          addEmailNew(zUser.email);
          addPhoneNew(zUser.phone);
          addPhoneNew(zUser.mobile);
          const emailsOut = [...emailByNorm.values()];
          const phonesOut = [...phoneByKey.values()];
          const scalarEmail = zUser.email?.normalize("NFKC").trim() || emailsOut[0] || null;
          const scalarPhone = zUser.phone?.normalize("NFKC").trim() || phonesOut[0] || null;
          const scalarMobile = zUser.mobile?.normalize("NFKC").trim() || phonesOut.find((p) => (
            normalizePhoneKey(p) && normalizePhoneKey(scalarPhone)
              ? normalizePhoneKey(p) !== normalizePhoneKey(scalarPhone)
              : p !== scalarPhone
          )) || null;

          await prisma.contact.create({
            data: {
              customerId,
              zammadUserId: memberId,
              firstName: firstName || "-",
              lastName: lastName || "-",
              emails: emailsOut,
              phones: phonesOut,
              email: scalarEmail,
              phone: scalarPhone,
              mobile: scalarMobile,
            },
          });
          summary.contactsCreated++;
        }
      } catch (err) {
        summary.errors.push(
          `Kontakt ID ${memberId} in Org "${zammadOrg.name}": ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // ────────────────────────────────────────────────
  // Phase 2: Remotelog → Zammad
  // ────────────────────────────────────────────────
  const allCustomers = await prisma.customer.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      website: true,
      notes: true,
      zammadOrgId: true,
    },
    orderBy: { name: "asc" },
  });

  for (const customer of allCustomers) {
    try {
      const payload = {
        name: customer.name,
        email: customer.email ?? undefined,
        phone: customer.phone ?? undefined,
        website: customer.website ?? undefined,
        note: customer.notes ?? undefined,
      };

      if (customer.zammadOrgId) {
        await client.updateOrganization(customer.zammadOrgId, payload);
        summary.orgsUpdated++;
      } else {
        const created = await client.createOrganization(payload);
        await prisma.customer.update({
          where: { id: customer.id },
          data: { zammadOrgId: created.id },
        });
        summary.orgsCreated++;
      }
    } catch (err) {
      summary.errors.push(
        `Export "${customer.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return summary;
}
