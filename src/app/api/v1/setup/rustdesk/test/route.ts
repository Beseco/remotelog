import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import { getSetupState } from "@/lib/setup";

function hostOnly(value: string) {
  const v = value.trim();
  if (!v) return "";
  return v.includes(":") ? v.split(":")[0]!.trim() : v;
}

export async function POST(req: NextRequest) {
  const state = await getSetupState();
  if (!(!state.setupCompleted || !state.hasAdmin)) {
    return NextResponse.json({ error: "Setup bereits abgeschlossen." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  const { rustdeskIdServer, rustdeskRelay } = body as Record<string, string | undefined>;
  const idHost = rustdeskIdServer ? hostOnly(rustdeskIdServer) : "";
  const relayHost = rustdeskRelay ? hostOnly(rustdeskRelay) : "";
  if (!idHost && !relayHost) {
    return NextResponse.json({ ok: true, message: "Kein eigener RustDesk-Server gesetzt (Skip möglich)." });
  }

  try {
    if (idHost) await dns.lookup(idHost);
    if (relayHost) await dns.lookup(relayHost);
    return NextResponse.json({ ok: true, message: "RustDesk-Hosts sind auflösbar." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DNS-Test fehlgeschlagen";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
