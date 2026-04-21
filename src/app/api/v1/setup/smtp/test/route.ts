import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSetupState } from "@/lib/setup";
import { getEffectiveSmtpConfig } from "@/lib/smtp-config";

export async function POST(req: NextRequest) {
  const state = await getSetupState();
  if (!(!state.setupCompleted || !state.hasAdmin)) {
    return NextResponse.json({ error: "Setup bereits abgeschlossen." }, { status: 409 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const b = body as Record<string, unknown>;
  const effective = await getEffectiveSmtpConfig(state.organizationId);

  const host = (typeof b.host === "string" ? b.host.trim() : "") || effective.host || "";
  const user = (typeof b.user === "string" ? b.user.trim() : "") || effective.user || "";
  const from = (typeof b.from === "string" ? b.from.trim() : "") || effective.from;
  const passInput = typeof b.pass === "string" ? b.pass : undefined;
  const pass = passInput !== undefined ? passInput : (effective.pass ?? "");
  const portRaw = b.port ?? effective.port;
  const secure = typeof b.secure === "boolean" ? b.secure : effective.secure;
  const port = typeof portRaw === "number" ? portRaw : Number(portRaw);

  if (!host) return NextResponse.json({ ok: false, error: "SMTP Host fehlt." }, { status: 400 });
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return NextResponse.json({ ok: false, error: "Ungültiger SMTP-Port." }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Math.trunc(port),
    secure,
    auth: user || pass ? { user: user || undefined, pass: pass || undefined } : undefined,
  });

  try {
    await transporter.verify();
    return NextResponse.json({ ok: true, message: `SMTP erreichbar (${host}:${Math.trunc(port)}).`, from });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter SMTP-Fehler";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
