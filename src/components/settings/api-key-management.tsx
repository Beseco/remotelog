"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, ToggleLeft, ToggleRight } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  ipWhitelist: string[];
  createdAt: string | null;
};

const typeLabels: Record<string, string> = {
  setup:    "Setup",
  full:     "Vollzugriff",
  readonly: "Nur lesen",
};

const typeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  setup:    "default",
  full:     "secondary",
  readonly: "outline",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copy}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Kopiert" : "Kopieren"}
    </Button>
  );
}

function NewKeyDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (key: ApiKey & { plaintext: string }) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("readonly");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) { setError("Name ist erforderlich"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/v1/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          expiresAt: expiresAt || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Fehler");
      }
      const data = await res.json();
      setName(""); setType("readonly"); setExpiresAt("");
      onClose();
      onCreate(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neuer API-Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              placeholder="z.B. Monitoring-Script"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Typ</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="readonly">Nur lesen – Daten abfragen</option>
              <option value="full">Vollzugriff – Lesen & Schreiben</option>
              <option value="setup">Setup – Geräte registrieren</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Ablaufdatum (optional)</Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Erstellen…" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewKeyRevealDialog({
  open,
  onClose,
  keyData,
}: {
  open: boolean;
  onClose: () => void;
  keyData: (ApiKey & { plaintext: string }) | null;
}) {
  const [shown, setShown] = useState(false);

  return (
    <Dialog open={open} onOpenChange={() => { setShown(false); onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>API-Key erstellt</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Kopiere den Key jetzt — er wird <strong>nur einmal angezeigt</strong>.
          </p>
          <div className="rounded-md bg-muted p-3 font-mono text-sm break-all flex items-center gap-2">
            <span className="flex-1">
              {shown ? keyData?.plaintext : "rl_" + "•".repeat(60)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => setShown(v => !v)}
            >
              {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {keyData && <CopyButton text={keyData.plaintext} />}
        </div>
        <DialogFooter>
          <Button onClick={() => { setShown(false); onClose(); }}>Verstanden</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeyManagement({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<(ApiKey & { plaintext: string }) | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  function handleCreated(key: ApiKey & { plaintext: string }) {
    setKeys(prev => [key, ...prev]);
    setNewKey(key);
    setRevealOpen(true);
  }

  async function handleToggle(key: ApiKey) {
    setToggling(key.id);
    try {
      const res = await fetch(`/api/v1/apikeys/${key.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !key.active }),
      });
      if (res.ok) {
        const updated = await res.json();
        setKeys(prev => prev.map(k => k.id === key.id ? { ...k, ...updated } : k));
      }
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("API-Key wirklich löschen?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/v1/apikeys/${id}`, { method: "DELETE" });
      if (res.ok) setKeys(prev => prev.filter(k => k.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            API-Keys
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Neuer Key
          </Button>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine API-Keys. Erstelle einen zum Integrieren externer Tools.
            </p>
          ) : (
            <div className="space-y-2">
              {keys.map(key => (
                <div
                  key={key.id}
                  className="rounded-lg border p-3 flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-sm ${!key.active ? "line-through text-muted-foreground" : ""}`}>
                        {key.name}
                      </span>
                      <Badge variant={typeBadgeVariant[key.type] ?? "outline"} className="text-xs">
                        {typeLabels[key.type] ?? key.type}
                      </Badge>
                      {!key.active && (
                        <Badge variant="secondary" className="text-xs">Deaktiviert</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Erstellt: {fmtDate(key.createdAt)}</span>
                      {key.lastUsedAt && (
                        <span>Zuletzt: {fmtDate(key.lastUsedAt)}</span>
                      )}
                      {key.expiresAt && (
                        <span className={new Date(key.expiresAt) < new Date() ? "text-destructive" : ""}>
                          Läuft ab: {fmtDate(key.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={toggling === key.id}
                      onClick={() => handleToggle(key)}
                      title={key.active ? "Deaktivieren" : "Aktivieren"}
                    >
                      {key.active
                        ? <ToggleRight className="h-4 w-4 text-primary" />
                        : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      }
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      disabled={deleting === key.id}
                      onClick={() => handleDelete(key.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreated}
      />

      <NewKeyRevealDialog
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        keyData={newKey}
      />
    </>
  );
}
