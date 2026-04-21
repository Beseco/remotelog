import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupState } from "@/lib/setup";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  const { host, port, secure, user, pass, from } = body as Record<string, unknown>;
  const state = await getSetupState();
  if (!(!state.setupCompleted || !state.hasAdmin)) {
    return NextResponse.json({ error: "Setup bereits abgeschlossen." }, { status: 409 });
  }

  const hostVal = typeof host === "string" ? host.trim() : "";
  const userVal = typeof user === "string" ? user.trim() : "";
  const fromVal = typeof from === "string" ? from.trim() : "";
  const passVal = typeof pass === "string" ? pass : undefined;
  const parsedPort = typeof port === "number" ? port : Number(port ?? 587);
  const secureVal = typeof secure === "boolean" ? secure : false;

  if (!hostVal) {
    await prisma.organization.update({
      where: { id: state.organizationId },
      data: {
        smtpHost: null,
        smtpPort: null,
        smtpSecure: null,
        smtpUser: null,
        smtpPass: null,
        smtpFrom: null,
      },
    });
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    return NextResponse.json({ error: "Ungültiger SMTP-Port." }, { status: 400 });
  }

  await prisma.organization.update({
    where: { id: state.organizationId },
    data: {
      smtpHost: hostVal,
      smtpPort: Math.trunc(parsedPort),
      smtpSecure: secureVal,
      smtpUser: userVal || null,
      smtpFrom: fromVal || null,
      ...(passVal !== undefined ? { smtpPass: passVal.trim() || null } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
