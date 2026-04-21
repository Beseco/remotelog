import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { customerId, deviceName } = body as Record<string, string>;

  const registration = await prisma.deviceRegistration.findUnique({
    where: { id },
    select: { id: true, organizationId: true, rustdeskId: true, password: true, computerName: true, status: true },
  });

  if (!registration || registration.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  if (registration.status !== "pending") {
    return NextResponse.json({ error: "Bereits verarbeitet" }, { status: 409 });
  }

  // Create the device + RemoteId in one transaction
  const device = await prisma.$transaction(async (tx) => {
    const newDevice = await tx.device.create({
      data: {
        name: deviceName?.trim() || registration.computerName || "Neues Gerät",
        organizationId: registration.organizationId,
        customerId: customerId || null,
      },
    });

    await tx.remoteId.create({
      data: {
        deviceId: newDevice.id,
        type: "rustdesk",
        remoteId: registration.rustdeskId,
        label: registration.computerName || undefined,
        password: registration.password,
      },
    });

    await tx.deviceRegistration.update({
      where: { id: registration.id },
      data: { status: "assigned", deviceId: newDevice.id },
    });

    return newDevice;
  });

  return NextResponse.json({ ok: true, deviceId: device.id });
}
