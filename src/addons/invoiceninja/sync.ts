import { prisma } from "@/lib/prisma";
import { normalizeContactNameKey, normalizeContactNamePart, normalizeEmail, normalizePhoneKey } from "@/lib/contact-name";
import { InvoiceNinjaClient, type INClient } from "./client";
import type { InvoiceNinjaConfig } from "./index";

export type SyncSummary = {
  // IN → Remotelog
  importedFromIN: number;
  linkedToIN: number;
  // Remotelog → IN
  clientsCreated: number;
  clientsUpdated: number;
  projectsCreated: number;
  projectsUpdated: number;
  projectsLinked: number;
  errors: string[];
};

function deduplicateContactsByEmail<T extends { email: string | null; emails?: string[] }>(contacts: T[]): T[] {
  const seenEmails = new Set<string>();
  return contacts.filter((c) => {
    const candidates = [...(c.emails ?? []), c.email].map((e) => normalizeEmail(e)).filter(Boolean) as string[];
    if (candidates.length === 0) return true;
    for (const key of candidates) {
      if (seenEmails.has(key)) return false;
    }
    for (const key of candidates) seenEmails.add(key);
    return true;
  });
}

function mergeEmailDisplays(...sources: Array<string | string[] | null | undefined>): string[] {
  const byNorm = new Map<string, string>();
  for (const src of sources) {
    const list = Array.isArray(src) ? src : [src];
    for (const raw of list) {
      const display = raw?.normalize("NFKC").trim();
      if (!display) continue;
      const key = normalizeEmail(display);
      if (!key) continue;
      if (!byNorm.has(key)) byNorm.set(key, display);
    }
  }
  return [...byNorm.values()];
}

function mergePhoneDisplays(...sources: Array<string | string[] | null | undefined>): string[] {
  const byKey = new Map<string, string>();
  for (const src of sources) {
    const list = Array.isArray(src) ? src : [src];
    for (const raw of list) {
      const display = raw?.normalize("NFKC").trim();
      if (!display) continue;
      const key = normalizePhoneKey(display);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, display);
    }
  }
  return [...byKey.values()];
}

function buildINClientPayload(customer: {
  name: string;
  customerNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  contacts: Array<{
    invoiceNinjaId: string | null;
    firstName: string;
    lastName: string;
    email: string | null;
    emails?: string[];
    phone: string | null;
    mobile: string | null;
    phones?: string[];
  }>;
}) {
  return {
    name: customer.name,
    number: customer.customerNumber ?? undefined,
    email: customer.email ?? undefined,
    phone: customer.phone ?? undefined,
    website: customer.website ?? undefined,
    address1: customer.street ?? undefined,
    city: customer.city ?? undefined,
    postal_code: customer.zip ?? undefined,
    contacts: deduplicateContactsByEmail(customer.contacts).map((c) => ({
      ...(c.invoiceNinjaId ? { id: c.invoiceNinjaId } : {}),
      first_name: c.firstName,
      last_name: c.lastName,
      email: c.email ?? undefined,
      phone: c.phone ?? c.mobile ?? c.phones?.[0] ?? undefined,
    })),
  };
}

async function persistContactIds(
  contacts: Array<{ id: string; invoiceNinjaId: string | null }>,
  inContacts: Array<{ id: string }>
) {
  for (let i = 0; i < contacts.length; i++) {
    const remoteContact = contacts[i];
    const inContact = inContacts[i];
    if (!remoteContact || !inContact) continue;
    if (remoteContact.invoiceNinjaId !== inContact.id) {
      await prisma.contact.update({
        where: { id: remoteContact.id },
        data: { invoiceNinjaId: inContact.id },
      });
    }
  }
}

export async function runInvoiceNinjaSync(
  organizationId: string,
  config: InvoiceNinjaConfig
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    importedFromIN: 0,
    linkedToIN: 0,
    clientsCreated: 0,
    clientsUpdated: 0,
    projectsCreated: 0,
    projectsUpdated: 0,
    projectsLinked: 0,
    errors: [],
  };

  const client = new InvoiceNinjaClient(config.invoiceNinjaUrl, config.apiToken);

  // --- Fetch all IN clients ---
  const allINClients: INClient[] = [];
  let page = 1;
  while (true) {
    const res = await client.listClients(page, 100);
    allINClients.push(...res.data);
    if (page >= res.meta.pagination.total_pages) break;
    page++;
  }

  // Build lookup maps
  const inById = new Map(allINClients.map((c) => [c.id, c]));
  const inByName = new Map(allINClients.map((c) => [c.name.toLowerCase().trim(), c]));

  // Fetch all Remotelog customers
  const remoteCustomers = await prisma.customer.findMany({
    where: { organizationId },
    include: { contacts: { orderBy: { lastName: "asc" } } },
    orderBy: { name: "asc" },
  });

  const remoteByInId = new Map(
    remoteCustomers.filter((c) => c.invoiceNinjaId).map((c) => [c.invoiceNinjaId!, c])
  );
  const remoteByName = new Map(
    remoteCustomers.map((c) => [c.name.toLowerCase().trim(), c])
  );

  // ────────────────────────────────────────────────
  // Phase 1: IN → Remotelog (import + link)
  // ────────────────────────────────────────────────
  for (const inClient of allINClients) {
    try {
      // Already linked — keep customerNumber in sync from IN
      if (remoteByInId.has(inClient.id)) {
        const existing = remoteByInId.get(inClient.id)!;
        if (inClient.number && existing.customerNumber !== inClient.number) {
          await prisma.customer.update({
            where: { id: existing.id },
            data: { customerNumber: inClient.number },
          });
        }
        continue;
      }

      // Name match → link existing Remotelog customer
      const nameMatch = remoteByName.get(inClient.name.toLowerCase().trim());
      if (nameMatch && !nameMatch.invoiceNinjaId) {
        await prisma.customer.update({
          where: { id: nameMatch.id },
          data: {
            invoiceNinjaId: inClient.id,
            // Customer number always comes from IN (source of truth)
            customerNumber: inClient.number || nameMatch.customerNumber || null,
            // Fill empty fields from IN
            email: nameMatch.email || inClient.email || null,
            phone: nameMatch.phone || inClient.phone || null,
            website: nameMatch.website || inClient.website || null,
            street: nameMatch.street || inClient.address1 || null,
            city: nameMatch.city || inClient.city || null,
            zip: nameMatch.zip || inClient.postal_code || null,
          },
        });
        // Link contacts by name match
        for (const inContact of inClient.contacts) {
          const fullName = normalizeContactNameKey(
            `${inContact.first_name ?? ""} ${inContact.last_name ?? ""}`,
          );
          const remoteContact = nameMatch.contacts.find(
            (c) =>
              !c.invoiceNinjaId &&
              normalizeContactNameKey(`${c.firstName} ${c.lastName}`) === fullName
          );
          if (remoteContact) {
            const cur = await prisma.contact.findUnique({
              where: { id: remoteContact.id },
              select: { emails: true, phones: true, email: true, phone: true, mobile: true },
            });
            const emailsOut = mergeEmailDisplays(cur?.emails, cur?.email, inContact.email);
            const phonesOut = mergePhoneDisplays(cur?.phones, cur?.phone, cur?.mobile, inContact.phone);
            const scalarEmail = cur?.email ?? inContact.email ?? emailsOut[0] ?? null;
            const scalarPhone = cur?.phone ?? inContact.phone ?? phonesOut[0] ?? null;
            const scalarMobile = cur?.mobile ?? phonesOut.find((p) => (
              normalizePhoneKey(p) && normalizePhoneKey(scalarPhone)
                ? normalizePhoneKey(p) !== normalizePhoneKey(scalarPhone)
                : p !== scalarPhone
            )) ?? null;

            await prisma.contact.update({
              where: { id: remoteContact.id },
              data: {
                invoiceNinjaId: inContact.id,
                emails: emailsOut,
                phones: phonesOut,
                email: scalarEmail,
                phone: scalarPhone,
                mobile: scalarMobile,
              },
            });
          }
        }
        // Update lookup maps
        remoteByInId.set(inClient.id, nameMatch);
        summary.linkedToIN++;
        continue;
      }

      // No match → create new Remotelog customer
      const newCustomer = await prisma.customer.create({
        data: {
          organizationId,
          invoiceNinjaId: inClient.id,
          name: inClient.name,
          customerNumber: inClient.number || null,
          email: inClient.email || null,
          phone: inClient.phone || null,
          website: inClient.website || null,
          street: inClient.address1 || null,
          city: inClient.city || null,
          zip: inClient.postal_code || null,
        },
      });
      // Import contacts
      for (const inContact of inClient.contacts) {
        if (!inContact.first_name && !inContact.last_name) continue;
        const firstName = normalizeContactNamePart(inContact.first_name || "-");
        const lastName = normalizeContactNamePart(inContact.last_name || "-");
        const existingContact = await prisma.contact.findFirst({
          where: {
            customerId: newCustomer.id,
            OR: [
              { invoiceNinjaId: inContact.id },
              {
                firstName: { equals: firstName, mode: "insensitive" },
                lastName: { equals: lastName, mode: "insensitive" },
              },
            ],
          },
          select: { id: true },
        });
        if (!existingContact) {
          const emailsOut = mergeEmailDisplays(inContact.email);
          const phonesOut = mergePhoneDisplays(inContact.phone);
          await prisma.contact.create({
            data: {
              customerId: newCustomer.id,
              invoiceNinjaId: inContact.id,
              firstName,
              lastName,
              emails: emailsOut,
              phones: phonesOut,
              email: inContact.email || emailsOut[0] || null,
              phone: inContact.phone || phonesOut[0] || null,
              mobile: null,
            },
          });
        }
      }
      summary.importedFromIN++;
    } catch (err) {
      summary.errors.push(
        `IN-Import "${inClient.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ────────────────────────────────────────────────
  // Phase 2: Remotelog → IN (export + update)
  // Reload customers to pick up newly linked invoiceNinjaIds
  // ────────────────────────────────────────────────
  const updatedCustomers = await prisma.customer.findMany({
    where: { organizationId },
    include: { contacts: { orderBy: { lastName: "asc" } } },
    orderBy: { name: "asc" },
  });

  for (const customer of updatedCustomers) {
    try {
      const payload = buildINClientPayload(customer);

      if (customer.invoiceNinjaId && inById.has(customer.invoiceNinjaId)) {
        // Update existing IN client
        const inClient = await client.updateClient(customer.invoiceNinjaId, payload);
        await persistContactIds(customer.contacts, inClient.contacts);
        summary.clientsUpdated++;
      } else if (!customer.invoiceNinjaId) {
        // Check if a matching IN client exists by name (may have been created externally)
        const inMatch = inByName.get(customer.name.toLowerCase().trim());
        if (inMatch) {
          await prisma.customer.update({
            where: { id: customer.id },
            data: { invoiceNinjaId: inMatch.id },
          });
          const inClient = await client.updateClient(inMatch.id, payload);
          await persistContactIds(customer.contacts, inClient.contacts);
          summary.clientsUpdated++;
        } else {
          // Create new IN client
          const inClient = await client.createClient(payload);
          await prisma.customer.update({
            where: { id: customer.id },
            data: { invoiceNinjaId: inClient.id },
          });
          await persistContactIds(customer.contacts, inClient.contacts);
          summary.clientsCreated++;
        }
      }
    } catch (err) {
      summary.errors.push(
        `Export "${customer.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ────────────────────────────────────────────────
  // Phase 3: Projekt-Sync (IN ↔ Remotelog)
  // ────────────────────────────────────────────────

  // Fetch all IN projects (paginated)
  const allINProjects = [];
  let projectPage = 1;
  while (true) {
    const res = await client.listProjects(projectPage, 100);
    allINProjects.push(...res.data);
    if (projectPage >= res.meta.pagination.total_pages) break;
    projectPage++;
  }

  const inProjectById = new Map(allINProjects.map((p) => [p.id, p]));

  // Fetch all Remotelog projects with their customer's invoiceNinjaId
  const remoteProjects = await prisma.project.findMany({
    where: { organizationId },
    include: { customer: { select: { invoiceNinjaId: true } } },
  });

  const remoteProjectByInId = new Map(
    remoteProjects.filter((p) => p.invoiceNinjaProjectId).map((p) => [p.invoiceNinjaProjectId!, p])
  );

  // Phase 3a: IN → Remotelog
  for (const inProj of allINProjects) {
    try {
      if (inProj.is_deleted) continue;

      // Find which Remotelog customer this IN project belongs to
      const remoteCustomer = updatedCustomers.find((c) => c.invoiceNinjaId === inProj.client_id);
      if (!remoteCustomer) continue;

      // Already linked → update name/rate
      if (remoteProjectByInId.has(inProj.id)) {
        const existing = remoteProjectByInId.get(inProj.id)!;
        await prisma.project.update({
          where: { id: existing.id },
          data: {
            name: inProj.name,
            taskRate: inProj.task_rate || null,
          },
        });
        continue;
      }

      // Name match within same customer → link
      const nameMatch = remoteProjects.find(
        (p) =>
          !p.invoiceNinjaProjectId &&
          p.customerId === remoteCustomer.id &&
          p.name.toLowerCase().trim() === inProj.name.toLowerCase().trim()
      );
      if (nameMatch) {
        await prisma.project.update({
          where: { id: nameMatch.id },
          data: { invoiceNinjaProjectId: inProj.id, taskRate: inProj.task_rate || nameMatch.taskRate },
        });
        remoteProjectByInId.set(inProj.id, nameMatch);
        summary.projectsLinked++;
        continue;
      }

      // No match → create new Remotelog project
      const newProject = await prisma.project.create({
        data: {
          organizationId,
          customerId: remoteCustomer.id,
          invoiceNinjaProjectId: inProj.id,
          name: inProj.name,
          taskRate: inProj.task_rate || null,
          budgetedHours: inProj.budgeted_hours || null,
          dueDate: inProj.due_date ? new Date(inProj.due_date) : null,
        },
      });
      remoteProjectByInId.set(inProj.id, { ...newProject, customer: { invoiceNinjaId: remoteCustomer.invoiceNinjaId } });
      summary.importedFromIN++;
    } catch (err) {
      summary.errors.push(
        `IN-Projekt-Import "${inProj.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Phase 3b: Remotelog → IN
  const freshProjects = await prisma.project.findMany({
    where: { organizationId },
    include: { customer: { select: { invoiceNinjaId: true } } },
  });

  for (const project of freshProjects) {
    try {
      if (!project.customer.invoiceNinjaId) continue;

      const payload = {
        name: project.name,
        client_id: project.customer.invoiceNinjaId,
        task_rate: project.taskRate ?? undefined,
        due_date: project.dueDate ? project.dueDate.toISOString().split("T")[0] : null,
        budgeted_hours: project.budgetedHours ?? undefined,
      };

      if (project.invoiceNinjaProjectId && inProjectById.has(project.invoiceNinjaProjectId)) {
        await client.updateProject(project.invoiceNinjaProjectId, payload);
        summary.projectsUpdated++;
      } else if (!project.invoiceNinjaProjectId) {
        const inProj = await client.createProject(payload);
        await prisma.project.update({
          where: { id: project.id },
          data: { invoiceNinjaProjectId: inProj.id },
        });
        summary.projectsCreated++;
      }
    } catch (err) {
      summary.errors.push(
        `Projekt-Export "${project.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return summary;
}
