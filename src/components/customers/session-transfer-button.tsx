"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Send } from "lucide-react";

export function SessionTransferButton({
  sessionId,
  taskId,
  invoiceNinjaUrl,
}: {
  sessionId: string;
  taskId: string | null;
  invoiceNinjaUrl: string;
}) {
  const [loading, setLoading] = useState(false);
  const [transferred, setTransferred] = useState<string | null>(taskId);
  const [error, setError] = useState(false);

  if (transferred) {
    return (
      <a
        href={`${invoiceNinjaUrl.replace(/\/$/, "")}/#tasks`}
        target="_blank"
        rel="noopener noreferrer"
        title="In Invoice Ninja öffnen"
      >
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      </a>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      disabled={loading}
      title={error ? "Fehler – erneut versuchen" : "Nach Invoice Ninja übertragen"}
      onClick={async () => {
        setLoading(true);
        setError(false);
        try {
          const res = await fetch("/api/v1/addons/invoiceninja/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionIds: [sessionId] }),
          });
          const data = await res.json() as { transferred?: number; errors?: string[] };
          if (res.ok && data.transferred === 1) {
            setTransferred("ok");
          } else {
            setError(true);
          }
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <Send className={`h-3 w-3 ${error ? "text-destructive" : ""}`} />
      }
    </Button>
  );
}
