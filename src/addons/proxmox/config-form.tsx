"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle, ChevronDown, ChevronRight, Loader2, RefreshCw, Server } from "lucide-react";
import type { AddonConfigFormProps } from "@/addons/types";
import type { ProxmoxConfig, ProxmoxNodeMapping } from "./index";

type NodeInfo = { node: string };
type SyncSummary = { created: number; updated: number; unchanged: number; found: number; errors: string[] };

export function ProxmoxConfigForm({
  config,
  onSave,
  isSaving,
  error,
}: AddonConfigFormProps<ProxmoxConfig>) {
  const [apiUrl, setApiUrl] = useState(config.apiUrl ?? "");
  const [tokenId, setTokenId] = useState(config.tokenId ?? "");
  const [tokenSecret, setTokenSecret] = useState(config.tokenSecret ?? "");
  const [verifySsl, setVerifySsl] = useState(config.verifySsl ?? false);
  const [sshUser, setSshUser] = useState(config.sshUser ?? "root");
  const [sshPrivateKey, setSshPrivateKey] = useState(config.sshPrivateKey ?? "");
  const [importQemu, setImportQemu] = useState(config.importQemu ?? true);
  const [importLxc, setImportLxc] = useState(config.importLxc ?? true);
  const [importNodes, setImportNodes] = useState(config.importNodes ?? false);
  const [importConsole, setImportConsole] = useState(config.importConsole ?? true);
  const [importSsh, setImportSsh] = useState(config.importSsh ?? true);
  const [importVnc, setImportVnc] = useState(config.importVnc ?? false);
  const [nodes, setNodes] = useState<ProxmoxNodeMapping[]>(config.nodes ?? []);

  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesError, setNodesError] = useState<string | null>(null);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [connOpen, setConnOpen] = useState(true);
  const [sshOpen, setSshOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSyncResult(null);
    setSyncError(null);
    await onSave({
      apiUrl: apiUrl.trim(),
      tokenId: tokenId.trim(),
      tokenSecret: tokenSecret.trim(),
      verifySsl,
      sshUser: sshUser.trim() || "root",
      sshPrivateKey: sshPrivateKey.trim() || undefined,
      importQemu,
      importLxc,
      importNodes,
      importConsole,
      importSsh,
      importVnc,
      nodes,
    });
  }

  async function handleLoadNodes() {
    setNodesLoading(true);
    setNodesError(null);
    try {
      const res = await fetch("/api/v1/addons/proxmox/nodes");
      const data = await res.json() as { nodes?: NodeInfo[]; error?: string };
      if (!res.ok || !data.nodes) {
        setNodesError(data.error ?? "Nodes konnten nicht geladen werden");
        return;
      }

      const [cusRes, grpRes] = await Promise.all([
        fetch("/api/v1/customers"),
        fetch("/api/v1/groups"),
      ]);
      const cusData = await cusRes.json() as { id: string; name: string }[];
      const grpData = await grpRes.json() as { id: string; name: string }[];
      setCustomers(Array.isArray(cusData) ? cusData : []);
      setGroups(Array.isArray(grpData) ? grpData : []);

      const merged = data.nodes.map((n) => {
        const existing = nodes.find((x) => x.name === n.node);
        return existing ?? { name: n.node };
      });
      setNodes(merged);
    } catch {
      setNodesError("Netzwerkfehler beim Laden der Nodes");
    } finally {
      setNodesLoading(false);
    }
  }

  function updateNodeMapping(index: number, field: keyof ProxmoxNodeMapping, value: string) {
    setNodes((prev) => prev.map((n, i) => (i === index ? { ...n, [field]: value || undefined } : n)));
  }

  async function handleSync() {
    setSyncLoading(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/v1/addons/proxmox/sync", { method: "POST" });
      const data = await res.json() as SyncSummary & { error?: string };
      if (!res.ok) {
        setSyncError(data.error ?? "Synchronisation fehlgeschlagen");
      } else {
        setSyncResult(data);
      }
    } catch {
      setSyncError("Netzwerkfehler");
    } finally {
      setSyncLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-2">

      {/* ── Verbindung ── */}
      <div className="space-y-1">
        <button type="button" onClick={() => setConnOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 w-full">
          {connOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          Verbindung
        </button>
        {connOpen && (
          <div className="pl-5 space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="apiUrl">Proxmox API URL</Label>
              <Input id="apiUrl" type="url" placeholder="https://proxmox.example.com:8006"
                value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tokenId">Token-ID</Label>
                <Input id="tokenId" type="text" placeholder="root@pam!remotelog"
                  value={tokenId} onChange={(e) => setTokenId(e.target.value)} required />
                <p className="text-xs text-muted-foreground">Format: <code className="font-mono bg-muted px-1 rounded">USER@REALM!NAME</code></p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tokenSecret">Token-Secret</Label>
                <Input id="tokenSecret" type="password" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={tokenSecret} onChange={(e) => setTokenSecret(e.target.value)} required />
                <p className="text-xs text-muted-foreground">UUID — Proxmox → Datacenter → API Tokens</p>
              </div>
            </div>
            <p className="text-xs text-amber-700">Wichtig: <strong>Privilege Separation</strong> deaktivieren <em>oder</em> Rolle <strong>PVEAuditor</strong> auf <code className="font-mono bg-muted px-1 rounded">/</code> zuweisen.</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={verifySsl} onChange={(e) => setVerifySsl(e.target.checked)} className="accent-primary h-4 w-4" />
              SSL-Zertifikat verifizieren
            </label>
          </div>
        )}
      </div>

      {/* ── SSH ── */}
      <div className="space-y-1">
        <button type="button" onClick={() => setSshOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 w-full">
          {sshOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          SSH
        </button>
        {sshOpen && (
          <div className="pl-5 space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="sshUser">Standard SSH-Benutzer</Label>
              <Input id="sshUser" type="text" placeholder="root"
                value={sshUser} onChange={(e) => setSshUser(e.target.value)} className="max-w-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sshPrivateKey">SSH Private Key <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea id="sshPrivateKey" rows={4}
                placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                value={sshPrivateKey} onChange={(e) => setSshPrivateKey(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground">Ohne Key wird Passwort- oder Keyboard-Interactive-Auth versucht.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Importieren ── */}
      <div className="space-y-1">
        <button type="button" onClick={() => setImportOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 w-full">
          {importOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          Importieren
        </button>
        {importOpen && (
          <div className="pl-5 space-y-3 pt-1">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Gerätetypen</p>
              {[
                { key: "importQemu", label: "QEMU/KVM VMs", value: importQemu, set: setImportQemu },
                { key: "importLxc", label: "LXC Container", value: importLxc, set: setImportLxc },
                { key: "importNodes", label: "Proxmox Nodes selbst", value: importNodes, set: setImportNodes },
              ].map(({ key, label, value, set }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="accent-primary h-4 w-4" />
                  {label}
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Verbindungsarten</p>
              {[
                { key: "importConsole", label: "Proxmox Konsole", value: importConsole, set: setImportConsole },
                { key: "importSsh", label: "SSH", value: importSsh, set: setImportSsh },
                { key: "importVnc", label: "VNC", value: importVnc, set: setImportVnc },
              ].map(({ key, label, value, set }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="accent-primary h-4 w-4" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSaving ? "Speichern…" : "Speichern"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={nodesLoading || !apiUrl || !tokenId || !tokenSecret}
          onClick={handleLoadNodes}
        >
          {nodesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
          Nodes laden
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={syncLoading}
          onClick={handleSync}
        >
          {syncLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Jetzt synchronisieren
        </Button>
      </div>

      {nodesError && <p className="text-sm text-destructive">{nodesError}</p>}

      {nodes.length > 0 && (
        <div className="space-y-2">
          <Label>Node-Zuordnung</Label>
          {nodes.map((n, i) => (
            <div key={n.name} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                {n.name}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Kunde</Label>
                  <select
                    className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={n.customerId ?? ""}
                    onChange={(e) => updateNodeMapping(i, "customerId", e.target.value)}
                  >
                    <option value="">— kein Kunde —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Gruppe</Label>
                  <select
                    className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={n.groupId ?? ""}
                    onChange={(e) => updateNodeMapping(i, "groupId", e.target.value)}
                  >
                    <option value="">— keine Gruppe —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {syncError && <p className="text-sm text-destructive">{syncError}</p>}

      {syncResult && (
        <div className="text-sm space-y-1 rounded-md border p-3 bg-muted/50">
          <p className="font-medium flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-green-600" /> Synchronisation abgeschlossen
          </p>
          <p className="text-muted-foreground">
            {syncResult.found} gefunden — {syncResult.created} neu erstellt, {syncResult.updated} aktualisiert
          </p>
          {syncResult.errors.length > 0 && (
            <details className="mt-1">
              <summary className="text-destructive cursor-pointer">
                {syncResult.errors.length} Fehler
              </summary>
              <ul className="mt-1 space-y-0.5 text-destructive text-xs">
                {syncResult.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
