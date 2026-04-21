"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface Props {
  remoteIdId: string;
  label: string;
  open: boolean;
  onClose: () => void;
}

type Status = "connecting" | "connected" | "error" | "closed";

export function SshTerminal({ remoteIdId, label, open, onClose }: Props) {
  const termRef    = useRef<HTMLDivElement>(null);
  const xtermRef   = useRef<import("@xterm/xterm").Terminal | null>(null);
  const tokenRef   = useRef<string | null>(null);
  const readerRef  = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [errorMsg, setErrorMsg] = useState("");

  const cleanup = useCallback(() => {
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    xtermRef.current?.dispose();
    xtermRef.current = null;
    tokenRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      cleanup();
      setStatus("connecting");
      return;
    }

    let cancelled = false;

    async function connect() {
      if (!termRef.current) return;

      // Lazy-load xterm to avoid SSR issues
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon }  = await import("@xterm/addon-fit");
      await import("@xterm/xterm/css/xterm.css");

      if (cancelled) return;

      const term = new Terminal({
        cursorBlink: true,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        fontSize: 13,
        theme: { background: "#1a1b26" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(termRef.current);
      fit.fit();
      xtermRef.current = term;

      // Resize observer to keep terminal sized to dialog
      const ro = new ResizeObserver(() => fit.fit());
      ro.observe(termRef.current);

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

      // Read SSE output
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

      // Send keystrokes to server
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

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [open, remoteIdId, cleanup]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-mono">SSH — {label}</DialogTitle>
        </DialogHeader>

        <div className="relative bg-[#1a1b26] min-h-[400px]">
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
          {status === "closed" && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              Verbindung beendet
            </div>
          )}
          <div
            ref={termRef}
            className="w-full"
            style={{ padding: "8px", visibility: status === "connected" ? "visible" : "hidden" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
