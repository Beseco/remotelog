import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const device = await prisma.device.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });

  if (!device) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (!device.macAddress) return NextResponse.json({ error: "Keine MAC-Adresse hinterlegt" }, { status: 400 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wake = require("wakeonlan") as (mac: string) => Promise<void>;
    await wake(device.macAddress);
    return NextResponse.json({ ok: true, message: `Magic Packet gesendet an ${device.macAddress}` });
  } catch (err) {
    console.error("WoL error:", err);
    return NextResponse.json({ error: "WoL fehlgeschlagen" }, { status: 500 });
  }
}
