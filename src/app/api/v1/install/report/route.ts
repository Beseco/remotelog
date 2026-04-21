import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionToken, orgToken, email, computerName, rustdeskId, password } =
    body as Record<string, string>;

  if (!rustdeskId || !password) {
    return NextResponse.json({ error: "Fehlende Pflichtfelder" }, { status: 400 });
  }

  // EXE flow: session token already created, just update the record
  if (sessionToken) {
    const existing = await prisma.deviceRegistration.findUnique({
      where: { sessionToken: sessionToken.toUpperCase() },
    });

    if (!existing) {
      return NextResponse.json({ error: "Ungültiger Session-Token" }, { status: 404 });
    }

    const updated = await prisma.deviceRegistration.update({
      where: { id: existing.id },
      data: {
        computerName: computerName?.trim() || null,
        rustdeskId: rustdeskId.trim(),
        password,
        status: "pending",
      },
    });

    console.log(
      `[install/report] Neues Gerät (EXE): ${computerName ?? "unbekannt"} (${rustdeskId}) von ${existing.email ?? "unbekannt"}`
    );

    return NextResponse.json({ ok: true, id: updated.id });
  }

  // Legacy PS1 flow: orgToken + email
  if (!orgToken) {
    return NextResponse.json({ error: "sessionToken oder orgToken erforderlich" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { registrationToken: orgToken },
    select: { id: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Ungültiger Token" }, { status: 404 });
  }

  const registration = await prisma.deviceRegistration.create({
    data: {
      organizationId: org.id,
      email: email?.trim() || null,
      computerName: computerName?.trim() || null,
      rustdeskId: rustdeskId.trim(),
      password,
      status: "pending",
    },
  });

  console.log(
    `[install/report] Neues Gerät (PS1): ${computerName ?? "unbekannt"} (${rustdeskId}) von ${email ?? "unbekannt"}`
  );

  return NextResponse.json({ ok: true, id: registration.id });
}
