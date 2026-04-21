import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/contact-name";

export async function GET() {
  const session = await requireAuth();

  const contacts = await prisma.contact.findMany({
    where: {
      customer: { organizationId: session.user.organizationId },
      OR: [{ email: { not: null } }, { emails: { isEmpty: false } }],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emails: true,
      customer: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows: { id: string; name: string; email: string; customerName: string }[] = [];

  for (const c of contacts) {
    const name = `${c.firstName} ${c.lastName}`.trim();
    const seen = new Set<string>();

    for (const raw of c.emails) {
      const email = raw?.trim();
      if (!email) continue;
      const k = normalizeEmail(email);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      rows.push({ id: c.id, name, email, customerName: c.customer.name });
    }

    if (c.email) {
      const email = c.email.trim();
      const k = normalizeEmail(email);
      if (k && !seen.has(k)) {
        seen.add(k);
        rows.push({ id: c.id, name, email, customerName: c.customer.name });
      }
    }
  }

  return NextResponse.json(rows);
}
