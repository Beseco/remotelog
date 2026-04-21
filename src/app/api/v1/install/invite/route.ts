import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendInstallerInvite } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recipientEmail } = body as Record<string, string>;

  if (!recipientEmail?.trim()) {
    return NextResponse.json({ error: "E-Mail-Adresse fehlt" }, { status: 400 });
  }

  const [org, sender] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true, registrationToken: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true, name: true, email: true },
    }),
  ]);

  if (!org?.registrationToken) {
    return NextResponse.json({ error: "Kein Download-Token vorhanden" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://app.remotelog.de";
  const downloadUrl = `${baseUrl.replace(/\/$/, "")}/${org.registrationToken}`;

  const senderName = [sender?.firstName, sender?.lastName].filter(Boolean).join(" ")
    || sender?.name
    || sender?.email
    || "Ihr Techniker";

  try {
    await sendInstallerInvite(recipientEmail.trim(), downloadUrl, senderName, org.name, session.user.organizationId);
  } catch (err) {
    console.error("[install/invite] E-Mail-Versand fehlgeschlagen:", err);
    return NextResponse.json({ error: "E-Mail konnte nicht gesendet werden" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
