"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

type Status = "connecting" | "connected" | "error" | "closed";

export function SshTerminalWindow() {
  const termRef   = useRef<HTMLDivElement>(null);
  const tokenRef  = useRef<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const [status, setStatus]   = useState<Status>("connecting");
  const [label, setLabel]     = useState("SSH Terminal");
  const [errorMsg, setErrorMsg] = useState("");

  const cleanup = useCallback(() => {
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    tokenRef.current = null;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const remoteIdId = params.get("id");
    const labelParam = params.get("label");
    if (labelParam) setLabel(decodeURIComponent(labelParam));
    if (!remoteIdId) { setErrorMsg("Keine remoteId angegeben"); setStatus("error"); return; }

    document.title = `SSH – ${labelParam ? decodeURIComponent(labelParam) : remoteIdId}`;

    let cancelled = false;

    async function connect() {
      if (!termRef.current) return;

      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon }  = await import("@xterm/addon-fit");
      await import("@xterm/xterm/css/xterm.css");

      if (cancelled) return;

      const term = new Terminal({
        cursorBlink: true,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        fontSize: 13,
        theme: { background: "#1a1b26", foreground: "#c0caf5" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(termRef.current);
      fit.fit();

      const ro = new ResizeObserver(() => fit.fit());
      ro.observe(termRef.current!);
      window.addEventListener("resize", () => fit.fit());

      // Get session token
      let token: string;
      try {
        const res = await fetch("/api/v1/ssh/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remoteIdId }),
        });
        if (!res.ok) {
          const { error } = await res.json() as { error: string };
          throw new Error(error ?? "Verbindung fehlgeschlagen");
        }
        ({ token } = await res.json() as { token: string });
      } catch (e) {
        if (cancelled) return;
        setErrorMsg((e as Error).message);
        setStatus("error");
        ro.disconnect();
        return;
      }

      if (cancelled) return;
      tokenRef.current = token;

      // Open SSE stream
      const response = await fetch(`/api/v1/ssh/stream?token=${encodeURIComponent(token)}`);
      if (!response.ok || !response.body) {
        setErrorMsg("Stream-Verbindung fehlgeschlagen");
        setStatus("error");
        ro.disconnect();
        return;
      }

      setStatus("connected");
      readerRef.current = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      void (async () => {
        try {
          while (true) {
            const { done, value } = await readerRef.current!.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const text: string = JSON.parse(line.slice(6)) as string;
                  term.write(text);
                } catch { /* skip malformed */ }
              }
            }
          }
        } catch { /* stream ended */ }
        if (!cancelled) setStatus("closed");
        ro.disconnect();
      })();

      term.onData((data) => {
        if (!tokenRef.current) return;
        void fetch("/api/v1/ssh/input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tokenRef.current, data }),
        });
      });
    }

    void connect();
    return () => { cancelled = true; cleanup(); };
  }, [cleanup]);

  return (
    <div className="flex flex-col h-screen bg-[#1a1b26]">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#13131e] border-b border-white/10 shrink-0">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/70" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
          <div className="h-3 w-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-slate-400 font-mono ml-2">{label}</span>
        {status === "connected" && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            Verbunden
          </span>
        )}
        {status === "closed" && (
          <span className="ml-auto text-xs text-slate-500">Verbindung beendet</span>
        )}
      </div>

      {/* Terminal area */}
      <div className="relative flex-1 overflow-hidden">
        {status === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verbinde…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 px-8 text-center">
            {errorMsg || "Verbindungsfehler"}
          </div>
        )}
        <div
          ref={termRef}
          className="w-full h-full"
          style={{
            padding: "8px",
            visibility: status === "connected" || status === "closed" ? "visible" : "hidden",
          }}
        />
      </div>
    </div>
  );
}
