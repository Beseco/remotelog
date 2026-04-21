"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText } from "lucide-react";

type INInvoice = {
  id: string;
  number: string;
  amount: number;
  balance: number;
  status_id: number;
  date: string;
  due_date: string | null;
};

const STATUS: Record<number, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  1: { label: "Entwurf",      variant: "outline" },
  2: { label: "Gesendet",     variant: "default" },
  3: { label: "Teilbezahlt",  variant: "secondary" },
  4: { label: "Bezahlt",      variant: "secondary" },
  5: { label: "Storniert",    variant: "destructive" },
};

function fmt(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

export function InvoiceNinjaInvoicesCard({
  customerId,
  invoiceNinjaUrl,
}: {
  customerId: string;
  invoiceNinjaUrl: string;
}) {
  const [invoices, setInvoices] = useState<INInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/addons/invoiceninja/invoices?customerId=${encodeURIComponent(customerId)}`)
      .then((r) => r.json())
      .then((data: { invoices?: INInvoice[]; error?: string }) => {
        if (data.error) setError(data.error);
        else setInvoices(data.invoices ?? []);
      })
      .catch(() => setError("Verbindungsfehler"));
  }, [customerId]);

  const baseUrl = invoiceNinjaUrl.replace(/\/$/, "");

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Rechnungen (Invoice Ninja)</h2>

      {invoices === null && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Rechnungen werden geladen…
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {invoices !== null && invoices.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          <FileText className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
          Keine Rechnungen vorhanden.
        </div>
      )}

      {invoices !== null && invoices.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Nr.</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Status</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Betrag</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Offen</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Datum</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => {
                  const status = STATUS[inv.status_id] ?? { label: String(inv.status_id), variant: "outline" as const };
                  return (
                    <tr key={inv.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="px-4 py-2 text-xs font-medium">
                        <a
                          href={`${baseUrl}/invoices/${inv.id}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {inv.number}
                        </a>
                      </td>
                      <td className="px-4 py-2 hidden sm:table-cell">
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-right whitespace-nowrap">
                        {fmt(inv.amount)}
                      </td>
                      <td className="px-4 py-2 text-xs text-right text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                        {inv.balance > 0 ? fmt(inv.balance) : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                        {new Date(inv.date).toLocaleDateString("de-DE")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
