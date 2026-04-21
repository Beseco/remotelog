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
  const state = await getSetupState();
  if (!(!state.setupCompleted || !state.hasAdmin)) {
    return NextResponse.json({ error: "Setup bereits abgeschlossen." }, { status: 409 });
  }

  const { rustdeskIdServer, rustdeskRelay, rustdeskKey } = body as Record<string, string | null>;
  await prisma.organization.update({
    where: { id: state.organizationId },
    data: {
      rustdeskIdServer: rustdeskIdServer?.trim() || null,
      rustdeskRelay: rustdeskRelay?.trim() || null,
      rustdeskKey: rustdeskKey?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true });
}
