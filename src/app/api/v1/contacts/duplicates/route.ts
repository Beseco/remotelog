import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { normalizeContactNameKey, normalizeEmail, normalizePhoneKey } from "@/lib/contact-name";

export async function GET() {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contacts = await prisma.contact.findMany({
    where: {
      customer: { organizationId: user.organizationId },
    },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  type ContactRow = (typeof contacts)[number];

  const byId = new Map<string, ContactRow>();
  for (const c of contacts) byId.set(c.id, c);

  const edges = new Map<string, Set<string>>();
  function addEdge(a: string, b: string) {
    if (a === b) return;
    if (!edges.has(a)) edges.set(a, new Set());
    if (!edges.has(b)) edges.set(b, new Set());
    edges.get(a)!.add(b);
    edges.get(b)!.add(a);
  }

  const nameBuckets = new Map<string, ContactRow[]>();
  const emailBuckets = new Map<string, ContactRow[]>();
  const phoneBuckets = new Map<string, ContactRow[]>();

  for (const c of contacts) {
    const fn = normalizeContactNameKey(c.firstName);
    const ln = normalizeContactNameKey(c.lastName);
    const nameKey = `${c.customerId}::name::${fn} ${ln}`;
    if (!nameBuckets.has(nameKey)) nameBuckets.set(nameKey, []);
    nameBuckets.get(nameKey)!.push(c);

    const emailCandidates = [
      ...c.emails,
      c.email,
    ];
    for (const raw of emailCandidates) {
      const em = normalizeEmail(raw);
      if (!em) continue;
      const emailKey = `${c.customerId}::email::${em}`;
      if (!emailBuckets.has(emailKey)) emailBuckets.set(emailKey, []);
      emailBuckets.get(emailKey)!.push(c);
    }

    const phoneCandidates = [
      ...c.phones,
      c.phone,
      c.mobile,
    ];
    for (const raw of phoneCandidates) {
      const pk = normalizePhoneKey(raw);
      if (!pk) continue;
      const phoneKey = `${c.customerId}::phone::${pk}`;
      if (!phoneBuckets.has(phoneKey)) phoneBuckets.set(phoneKey, []);
      phoneBuckets.get(phoneKey)!.push(c);
    }
  }

  for (const bucket of nameBuckets.values()) {
    if (bucket.length < 2) continue;
    const head = bucket[0]!.id;
    for (let i = 1; i < bucket.length; i++) addEdge(head, bucket[i]!.id);
  }
  for (const bucket of emailBuckets.values()) {
    if (bucket.length < 2) continue;
    const head = bucket[0]!.id;
    for (let i = 1; i < bucket.length; i++) addEdge(head, bucket[i]!.id);
  }
  for (const bucket of phoneBuckets.values()) {
    if (bucket.length < 2) continue;
    const head = bucket[0]!.id;
    for (let i = 1; i < bucket.length; i++) addEdge(head, bucket[i]!.id);
  }

  const visited = new Set<string>();
  const components: ContactRow[][] = [];

  for (const id of byId.keys()) {
    if (visited.has(id)) continue;
    const nbrs = edges.get(id);
    if (!nbrs || nbrs.size === 0) continue;

    const stack = [id];
    visited.add(id);
    const compIds: string[] = [];
    while (stack.length) {
      const cur = stack.pop()!;
      compIds.push(cur);
      for (const n of edges.get(cur) ?? []) {
        if (!visited.has(n)) {
          visited.add(n);
          stack.push(n);
        }
      }
    }
    if (compIds.length < 2) continue;

    const rows = compIds.map((cid) => byId.get(cid)!).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    components.push(rows);
  }

  // Deterministic ordering: biggest groups first, then customer name
  components.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const ca = a[0]!.customer.name.localeCompare(b[0]!.customer.name, "de");
    if (ca !== 0) return ca;
    const na = `${a[0]!.firstName} ${a[0]!.lastName}`.localeCompare(`${b[0]!.firstName} ${b[0]!.lastName}`, "de");
    return na;
  });

  return NextResponse.json(components);
}
