import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      notifIntervalMins:   true,
      notifSoundEnabled:   true,
      notifDesktopEnabled: true,
      notifBadgeEnabled:   true,
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { notifIntervalMins, notifSoundEnabled, notifDesktopEnabled, notifBadgeEnabled } = body;

  const data: Record<string, unknown> = {};

  if (notifIntervalMins !== undefined) {
    const mins = Number(notifIntervalMins);
    if (!Number.isInteger(mins) || mins < 1 || mins > 10) {
      return NextResponse.json({ error: "Intervall muss zwischen 1 und 10 Minuten liegen" }, { status: 400 });
    }
    data.notifIntervalMins = mins;
  }
  if (notifSoundEnabled   !== undefined) data.notifSoundEnabled   = Boolean(notifSoundEnabled);
  if (notifDesktopEnabled !== undefined) data.notifDesktopEnabled = Boolean(notifDesktopEnabled);
  if (notifBadgeEnabled   !== undefined) data.notifBadgeEnabled   = Boolean(notifBadgeEnabled);

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      notifIntervalMins:   true,
      notifSoundEnabled:   true,
      notifDesktopEnabled: true,
      notifBadgeEnabled:   true,
    },
  });

  return NextResponse.json(user);
}
