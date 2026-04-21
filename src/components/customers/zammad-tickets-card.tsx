"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Ticket } from "lucide-react";

type ZammadTicket = {
  id: number;
  number: string;
  title: string;
  state: string;
  created_at: string;
};

function stateBadgeVariant(state: string): "default" | "secondary" | "outline" {
  const s = state.toLowerCase();
  if (s === "new" || s === "open") return "default";
  if (s.includes("pending")) return "secondary";
  return "outline";
}

function stateLabel(state: string): string {
  const map: Record<string, string> = {
    new: "Neu",
    open: "Offen",
    closed: "Geschlossen",
    "pending reminder": "Ausstehend",
    "pending close": "Schließend",
  };
  return map[state.toLowerCase()] ?? state;
}

export function ZammadTicketsCard({
  customerId,
  zammadUrl,
}: {
  customerId: string;
  zammadUrl: string;
}) {
  const [tickets, setTickets] = useState<ZammadTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/addons/zammad/tickets?customerId=${encodeURIComponent(customerId)}`)
      .then((r) => r.json())
      .then((data: { tickets?: ZammadTicket[]; error?: string }) => {
        if (data.error) setError(data.error);
        else setTickets(data.tickets ?? []);
      })
      .catch(() => setError("Verbindungsfehler"));
  }, [customerId]);

  const baseUrl = zammadUrl.replace(/\/$/, "");

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Zammad-Tickets</h2>

      {tickets === null && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Tickets werden geladen…
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {tickets !== null && tickets.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          <Ticket className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
          Keine Tickets vorhanden.
        </div>
      )}

      {tickets !== null && tickets.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Nr.</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Titel</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Datum</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr key={t.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      #{t.number}
                    </td>
                    <td className="px-4 py-2 text-xs font-medium">
                      <a
                        href={`${baseUrl}/#ticket/zoom/${t.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {t.title}
                      </a>
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <Badge variant={stateBadgeVariant(t.state)} className="text-xs">
                        {stateLabel(t.state)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
