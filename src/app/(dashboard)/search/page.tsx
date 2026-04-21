import { requireAuth } from "@/lib/permissions";
import { SearchView } from "@/components/customers/search-view";

export default async function SearchPage() {
  await requireAuth();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Schnellsuche</h1>
        <p className="text-muted-foreground text-sm">
          Suche nach Unternehmen, Ansprechpartnern, Telefonnummern oder E-Mail-Adressen.
        </p>
      </div>
      <SearchView />
    </div>
  );
}
