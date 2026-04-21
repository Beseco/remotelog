import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSetupState } from "@/lib/setup";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  const { name, email, password, organizationName } = body as Record<string, string | undefined>;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Name, E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }
  if (password.trim().length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben." }, { status: 400 });
  }

  const state = await getSetupState();
  if (state.hasAdmin && state.setupCompleted) {
    return NextResponse.json({ error: "Setup bereits abgeschlossen." }, { status: 409 });
  }

  const emailLower = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password.trim(), 12);

  try {
    await prisma.$transaction(async (tx) => {
      if (organizationName?.trim()) {
        await tx.organization.update({
          where: { id: state.organizationId },
          data: { name: organizationName.trim() },
        });
      }

      const existing = await tx.user.findUnique({ where: { email: emailLower }, select: { id: true } });
      if (existing) throw new Error("EMAIL_EXISTS");

      await tx.user.create({
        data: {
          name: name.trim(),
          email: emailLower,
          passwordHash,
          role: "admin",
          active: true,
          organizationId: state.organizationId,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_EXISTS") {
      return NextResponse.json({ error: "Diese E-Mail ist bereits vergeben." }, { status: 409 });
    }
    console.error("[setup/admin]", err);
    return NextResponse.json({ error: "Admin konnte nicht angelegt werden." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
