import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupState } from "@/lib/setup";

export async function POST() {
  const state = await getSetupState();
  if (state.setupCompleted) return NextResponse.json({ ok: true });
  if (!state.hasAdmin) {
    return NextResponse.json({ error: "Bitte zuerst einen Admin anlegen." }, { status: 400 });
  }

  await prisma.organization.update({
    where: { id: state.organizationId },
    data: { setupCompletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
