import { requireAuth } from "@/lib/permissions";
import { ContactDuplicatesMerger } from "@/components/contacts/contact-duplicates-merger";

export default async function ContactDuplicatesPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Doppelte Ansprechpartner</h1>
        <p className="text-muted-foreground">
          Ansprechpartner mit gleichem Namen beim selben Kunden zusammenführen. Alle Sitzungen werden dem primären Kontakt zugeordnet.
        </p>
      </div>
      <ContactDuplicatesMerger />
    </div>
  );
}
