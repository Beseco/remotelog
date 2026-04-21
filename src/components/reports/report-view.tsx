"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Clock,
  Download,
  FileText,
  Filter,
  Monitor,
  Activity,
  CheckCircle,
  Loader2,
  Euro,
  Receipt,
  Building2,
  UserRound,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionNote = { id: string; content: string; createdAt: string };
type ChildSession = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  type: string;
  billed: boolean;
  billedAt: string | null;
};
type Session = {
  id: string;
  type: string;
  startedAt: string;
  endedAt: string | null;
  lastEndedAt: string | null;
  durationMinutes: number | null;
  totalDurationMinutes: number | null;
  billed: boolean;
  billedAt: string | null;
  billableMinutes: number | null;
  amount: number | null;
  device:   { id: string; name: string; group: { id: string; name: string } | null } | null;
  customer: { id: string; name: string } | null;
  contact:  { id: string; firstName: string; lastName: string } | null;
  user: { id: string; name: string };
  notes: SessionNote[];
  children: ChildSession[];
};
type BillingInfo = {
  hourlyRate: number;
  roundUpMins: number;
  prepMins: number;
  followUpMins: number;
  minMins: number;
  orgName: string;
};
type Stats = {
  total: number;
  completed: number;
  active: number;
  totalMinutes: number;
  byType: Record<string, { count: number; minutes: number }>;
  byDevice: { name: string; count: number; minutes: number }[];
  totalBillableMinutes: number;
  totalAmount: number;
  unbilledMinutes: number;
  unbilledAmount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeLabels: Record<string, string> = {
  remote: "Remote",
  onsite: "Vor-Ort",
  phone:  "Telefon",
};

function fmtMinutes(min: number): string {
  if (min === 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function fmtEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function sessionSubject(s: Session): { icon: React.ReactNode; primary: string; secondary?: string } {
  if (s.device) return {
    icon: <Monitor className="h-3.5 w-3.5 shrink-0" />,
    primary: s.device.name,
    secondary: s.device.group?.name,
  };
  if (s.contact) return {
    icon: <UserRound className="h-3.5 w-3.5 shrink-0" />,
    primary: `${s.contact.firstName} ${s.contact.lastName}`,
    secondary: s.customer?.name,
  };
  if (s.customer) return {
    icon: <Building2 className="h-3.5 w-3.5 shrink-0" />,
    primary: s.customer.name,
  };
  return { icon: <Monitor className="h-3.5 w-3.5 shrink-0" />, primary: "–" };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(sessions: Session[], filename: string, billingEnabled: boolean) {
  const headers = [
    "Datum", "Startzeit", "Endzeit", "Dauer", "Betreff", "Techniker", "Typ",
    ...(billingEnabled ? ["Abrechenbar (Min)", "Betrag (EUR)", "Abgerechnet", "Abgerechnet am"] : []),
    "Notizen",
  ];
  const rows = sessions.map(s => [
    fmtDate(s.startedAt),
    new Date(s.startedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    s.lastEndedAt ? new Date(s.lastEndedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "aktiv",
    s.totalDurationMinutes !== null ? fmtMinutes(s.totalDurationMinutes) : "",
    sessionSubject(s).primary,
    s.user.name,
    typeLabels[s.type] ?? s.type,
    ...(billingEnabled ? [
      s.billableMinutes !== null ? String(s.billableMinutes) : "",
      s.amount !== null ? s.amount.toFixed(2).replace(".", ",") : "",
      s.billed ? "Ja" : "Nein",
      s.billedAt ? fmtDateTime(s.billedAt) : "",
    ] : []),
    s.notes.map(n => n.content).join(" | "),
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportPdf(
  sessions: Session[],
  stats: Stats,
  billing: BillingInfo,
  filters: { from: string; to: string },
  orgName: string,
  filename: string,
  billingEnabled: boolean,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const completedSessions = sessions.filter(s => s.endedAt);

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Tätigkeitsnachweis", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(orgName || billing.orgName, 14, 25);

  const period = filters.from || filters.to
    ? `Zeitraum: ${filters.from ? fmtDate(filters.from) : "–"} bis ${filters.to ? fmtDate(filters.to) : "–"}`
    : "Zeitraum: Gesamt";
  doc.text(period, 14, 31);
  doc.text(`Erstellt: ${fmtDateTime(new Date().toISOString())}`, 14, 37);

  // Zusammenfassung-Box
  const summaryY = 44;
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, summaryY, 269, billingEnabled ? 24 : 18, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.text(`Sitzungen: ${stats.completed}`, 20, summaryY + 7);
  doc.text(`Gesamtzeit: ${fmtMinutes(stats.totalMinutes)}`, 80, summaryY + 7);
  let xOffset = 160;
  for (const [type, d] of Object.entries(stats.byType)) {
    doc.text(`${typeLabels[type] ?? type}: ${fmtMinutes(d.minutes)}`, xOffset, summaryY + 7);
    xOffset += 55;
  }
  if (billingEnabled) {
    doc.setFont("helvetica", "normal");
    doc.text(`Abrechenbar: ${fmtMinutes(stats.totalBillableMinutes)}`, 20, summaryY + 17);
    doc.text(`Gesamt netto: ${fmtEur(stats.totalAmount)}`, 100, summaryY + 17);
    if (stats.unbilledAmount > 0) {
      doc.setFont("helvetica", "bold");
      doc.text(`Offen: ${fmtEur(stats.unbilledAmount)}`, 200, summaryY + 17);
    }
  }

  const tableStartY = summaryY + (billingEnabled ? 30 : 24);

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      "Datum", "Betreff", "Techniker", "Typ", "Start", "Ende", "Dauer",
      ...(billingEnabled ? ["Abrechenbar", "Betrag"] : []),
      "Notizen",
    ]],
    body: completedSessions.map(s => [
      fmtDate(s.startedAt),
      sessionSubject(s).primary,
      s.user.name,
      typeLabels[s.type] ?? s.type,
      new Date(s.startedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      s.lastEndedAt ? new Date(s.lastEndedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "–",
      s.totalDurationMinutes !== null ? fmtMinutes(s.totalDurationMinutes) : "–",
      ...(billingEnabled ? [
        s.billableMinutes !== null && s.billableMinutes > 0 ? `${s.billableMinutes} min` : "–",
        s.amount !== null && s.amount > 0 ? fmtEur(s.amount) : "–",
      ] : []),
      s.notes.map(n => n.content).join(" | "),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [26, 86, 219], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Footer
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Seite ${i} von ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 8);
  }

  doc.save(filename);
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

type Props = {
  devices:   { id: string; name: string }[];
  groups:    { id: string; name: string }[];
  users:     { id: string; name: string }[];
  customers: { id: string; name: string }[];
  currentUserName: string;
  orgName: string;
  isAdmin: boolean;
  billingEnabled: boolean;
};

export function ReportView({
  devices, groups, users, customers, orgName, isAdmin, billingEnabled,
}: Props) {
  const today        = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [filters, setFilters] = useState({
    from:       firstOfMonth,
    to:         today,
    deviceId:   "",
    groupId:    "",
    customerId: "",
    userId:     "",
    type:       "",
    billed:     billingEnabled ? "false" : "", // default: show unbilled when billing is active
  });

  const [data, setData]         = useState<{ sessions: Session[]; stats: Stats; billing: BillingInfo } | null>(null);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marking, setMarking]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const params = new URLSearchParams();
      if (filters.from)       params.set("from",       filters.from);
      if (filters.to)         params.set("to",         filters.to);
      if (filters.deviceId)   params.set("deviceId",   filters.deviceId);
      if (filters.groupId)    params.set("groupId",    filters.groupId);
      if (filters.customerId) params.set("customerId", filters.customerId);
      if (filters.userId)     params.set("userId",     filters.userId);
      if (filters.type)       params.set("type",       filters.type);
      if (filters.billed)     params.set("billed",     filters.billed);
      const res = await fetch(`/api/v1/reports?${params}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key: keyof typeof filters, value: string) {
    setFilters(f => ({ ...f, [key]: value }));
  }

  function getFilename(ext: string) {
    const from = filters.from || "alle";
    const to   = filters.to   || "alle";
    return `taetigkeitsnachweis_${from}_${to}.${ext}`;
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(unbilledIds: string[]) {
    if (selected.size === unbilledIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unbilledIds));
    }
  }

  async function handleMarkBilled() {
    if (selected.size === 0) return;
    setMarking(true);
    try {
      await fetch("/api/v1/billing/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: [...selected] }),
      });
      await load();
    } finally {
      setMarking(false);
    }
  }

  const completedSessions  = data?.sessions.filter(s => s.endedAt) ?? [];
  const unbilledCompleted  = completedSessions.filter(s => !s.billed);
  const unbilledIds        = unbilledCompleted.map(s => s.id);
  const showCheckboxCol    = billingEnabled && isAdmin && unbilledCompleted.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Filter ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <div className="space-y-1.5">
              <Label>Von</Label>
              <Input type="date" value={filters.from} onChange={e => setFilter("from", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bis</Label>
              <Input type="date" value={filters.to} onChange={e => setFilter("to", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gerät</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={filters.deviceId}
                onChange={e => setFilter("deviceId", e.target.value)}
              >
                <option value="">Alle Geräte</option>
                {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Gruppe</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={filters.groupId}
                onChange={e => setFilter("groupId", e.target.value)}
              >
                <option value="">Alle Gruppen</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Kunde</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={filters.customerId}
                onChange={e => setFilter("customerId", e.target.value)}
              >
                <option value="">Alle Kunden</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Techniker</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={filters.userId}
                onChange={e => setFilter("userId", e.target.value)}
              >
                <option value="">Alle Techniker</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={filters.type}
                onChange={e => setFilter("type", e.target.value)}
              >
                <option value="">Alle Typen</option>
                <option value="remote">Remote</option>
                <option value="onsite">Vor-Ort</option>
                <option value="phone">Telefon</option>
              </select>
            </div>
            {billingEnabled && (
              <div className="space-y-1.5">
                <Label>Abrechnung</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={filters.billed}
                  onChange={e => setFilter("billed", e.target.value)}
                >
                  <option value="">Alle</option>
                  <option value="false">Nicht abgerechnet</option>
                  <option value="true">Abgerechnet</option>
                </select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Stats ── */}
      {data && (
        <div className={`grid gap-4 ${billingEnabled ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sitzungen</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.completed}</div>
              {data.stats.active > 0 && (
                <p className="text-xs text-muted-foreground">+ {data.stats.active} aktiv</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamtzeit</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtMinutes(data.stats.totalMinutes)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nach Typ</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              {Object.entries(data.stats.byType).map(([type, d]) => (
                <div key={type} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{typeLabels[type] ?? type}</span>
                  <span className="font-medium">{fmtMinutes(d.minutes)}</span>
                </div>
              ))}
              {Object.keys(data.stats.byType).length === 0 && (
                <p className="text-xs text-muted-foreground">Keine Daten</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Geräte</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              {data.stats.byDevice.slice(0, 4).map(d => (
                <div key={d.name} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[100px]">{d.name}</span>
                  <span className="font-medium">{fmtMinutes(d.minutes)}</span>
                </div>
              ))}
              {data.stats.byDevice.length === 0 && (
                <p className="text-xs text-muted-foreground">Keine Daten</p>
              )}
            </CardContent>
          </Card>
          {billingEnabled && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Abrechnung</CardTitle>
                <Euro className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Abrechenbar</span>
                  <span className="font-medium">{fmtMinutes(data.stats.totalBillableMinutes)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Gesamt netto</span>
                  <span className="font-medium">{fmtEur(data.stats.totalAmount)}</span>
                </div>
                {data.stats.unbilledAmount > 0 && filters.billed !== "true" && (
                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span className="font-medium text-amber-600">Offen</span>
                    <span className="font-bold text-amber-600">{fmtEur(data.stats.unbilledAmount)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Tabelle ── */}
      {data && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                {completedSessions.length} abgeschlossene Sitzungen
                {billingEnabled && selected.size > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    · {selected.size} ausgewählt
                  </span>
                )}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                {showCheckboxCol && (
                  <Button
                    size="sm"
                    variant={selected.size > 0 ? "default" : "outline"}
                    disabled={selected.size === 0 || marking}
                    onClick={handleMarkBilled}
                  >
                    {marking
                      ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Markieren…</>
                      : <><Receipt className="h-4 w-4 mr-1.5" />Als abgerechnet markieren ({selected.size})</>
                    }
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={completedSessions.length === 0}
                  onClick={() => exportCsv(completedSessions, getFilename("csv"), billingEnabled)}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={completedSessions.length === 0 || loading}
                  onClick={() =>
                    data && exportPdf(
                      completedSessions, data.stats, data.billing,
                      filters, orgName, getFilename("pdf"), billingEnabled,
                    )
                  }
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Lade…
              </div>
            ) : completedSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 opacity-40" />
                <p>Keine Sitzungen im gewählten Zeitraum.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {showCheckboxCol && (
                        <th className="px-4 py-2.5 w-8">
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            title="Alle nicht-abgerechneten auswählen"
                            checked={selected.size > 0 && selected.size === unbilledIds.length}
                            onChange={() => toggleSelectAll(unbilledIds)}
                          />
                        </th>
                      )}
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Datum</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Betreff</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Techniker</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Typ</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Dauer</th>
                      {billingEnabled && (
                        <>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Abrechenbar</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Betrag</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                        </>
                      )}
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">Notizen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedSessions.map((s, i) => {
                      const subj      = sessionSubject(s);
                      const isUnbilled = !s.billed && !!s.endedAt;
                      const isSelected = selected.has(s.id);
                      return (
                        <tr
                          key={s.id}
                          className={[
                            i % 2 === 0 ? "" : "bg-muted/20",
                            showCheckboxCol && isUnbilled ? "cursor-pointer hover:bg-muted/40" : "",
                            isSelected ? "bg-primary/5 hover:bg-primary/10" : "",
                          ].filter(Boolean).join(" ")}
                          onClick={() => showCheckboxCol && isUnbilled && toggleSelect(s.id)}
                        >
                          {showCheckboxCol && (
                            <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                              {isUnbilled && (
                                <input
                                  type="checkbox"
                                  className="cursor-pointer"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(s.id)}
                                />
                              )}
                            </td>
                          )}
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div>{fmtDate(s.startedAt)}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(s.startedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                              {s.lastEndedAt && ` – ${new Date(s.lastEndedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                              {s.children.length > 0 && (
                                <span className="ml-1 opacity-60">({s.children.length + 1} Teilsitzungen)</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 font-medium">
                              {subj.icon}
                              {subj.primary}
                            </div>
                            {subj.secondary && (
                              <div className="text-xs text-muted-foreground pl-5">{subj.secondary}</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell">
                            {s.user.name}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="text-xs">
                              {typeLabels[s.type] ?? s.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-medium">
                            {s.totalDurationMinutes !== null ? fmtMinutes(s.totalDurationMinutes) : "–"}
                          </td>
                          {billingEnabled && (
                            <>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap text-muted-foreground">
                                {s.billableMinutes !== null
                                  ? s.billableMinutes === 0
                                    ? <span className="text-xs">–</span>
                                    : `${s.billableMinutes} min`
                                  : "–"
                                }
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">
                                {s.amount !== null && s.amount > 0
                                  ? fmtEur(s.amount)
                                  : <span className="text-muted-foreground text-xs">–</span>
                                }
                              </td>
                              <td className="px-4 py-2.5 hidden md:table-cell">
                                {s.billed
                                  ? <Badge variant="secondary" className="text-xs gap-1">
                                      <CheckCircle className="h-2.5 w-2.5" />
                                      Abgerechnet
                                    </Badge>
                                  : <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                      Offen
                                    </Badge>
                                }
                              </td>
                            </>
                          )}
                          <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-xs truncate hidden xl:table-cell">
                            {s.notes.map(n => n.content).join(" · ") || "–"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {billingEnabled && data.stats.totalAmount > 0 && (
                    <tfoot>
                      <tr className="border-t font-medium bg-muted/30">
                        {showCheckboxCol && <td />}
                        <td colSpan={4} className="px-4 py-2.5 text-muted-foreground text-xs">
                          Summe ({completedSessions.length} {completedSessions.length === 1 ? "Sitzung" : "Sitzungen"})
                        </td>
                        <td className="px-4 py-2.5">{fmtMinutes(data.stats.totalMinutes)}</td>
                        <td className="px-4 py-2.5 text-right">{fmtMinutes(data.stats.totalBillableMinutes)}</td>
                        <td className="px-4 py-2.5 text-right">{fmtEur(data.stats.totalAmount)}</td>
                        <td className="hidden md:table-cell px-4 py-2.5">
                          {data.stats.unbilledAmount > 0 && (
                            <span className="text-xs text-amber-600 font-medium">
                              {fmtEur(data.stats.unbilledAmount)} offen
                            </span>
                          )}
                        </td>
                        <td className="hidden xl:table-cell" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
