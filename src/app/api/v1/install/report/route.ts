import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionToken, orgToken, customerId, mode, email, computerName, rustdeskId, password } =
    body as Record<string, string>;

  if (!rustdeskId) {
    return NextResponse.json({ error: "rustdeskId fehlt" }, { status: 400 });
  }

  const isApproval = mode === "approval";

  // ── Session-Token-Flow ────────────────────────────────────────────────────
  if (sessionToken) {
    const existing = await prisma.deviceRegistration.findUnique({
      where: { sessionToken: sessionToken.toUpperCase() },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ungültiger Session-Token" }, { status: 404 });
    }

    const effectiveCustomerId = existing.customerId ?? customerId?.trim() ?? null;
    const effectiveMode = existing.mode ?? (isApproval ? "approval" : "unattended");

    const updated = await prisma.deviceRegistration.update({
      where: { id: existing.id },
      data: {
        computerName: computerName?.trim() || null,
        rustdeskId: rustdeskId.trim(),
        password: effectiveMode === "approval" ? "" : (password ?? ""),
        status: "pending",
      },
    });

    // Auto-assign if customer is pre-set
    if (effectiveCustomerId) {
      await autoAssignDevice({
        organizationId: existing.organizationId,
        customerId: effectiveCustomerId,
        registrationId: updated.id,
        rustdeskId: rustdeskId.trim(),
        computerName: computerName?.trim() ?? null,
        password: effectiveMode === "approval" ? null : (password ?? null),
      });
    }

    console.log(`[install/report] ${computerName ?? "?"} (${rustdeskId}) mode=${effectiveMode}`);
    return NextResponse.json({ ok: true, id: updated.id });
  }

  // ── OrgToken-Flow (MDM / Kunden-Installer) ────────────────────────────────
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

  const effectiveCustomerId = customerId?.trim() || null;
  const registration = await prisma.deviceRegistration.create({
    data: {
      organizationId: org.id,
      email: email?.trim() || null,
      computerName: computerName?.trim() || null,
      customerId: effectiveCustomerId,
      mode: isApproval ? "approval" : "unattended",
      rustdeskId: rustdeskId.trim(),
      password: isApproval ? "" : (password ?? ""),
      status: "pending",
    },
  });

  if (effectiveCustomerId) {
    await autoAssignDevice({
      organizationId: org.id,
      customerId: effectiveCustomerId,
      registrationId: registration.id,
      rustdeskId: rustdeskId.trim(),
      computerName: computerName?.trim() ?? null,
      password: isApproval ? null : (password ?? null),
    });
  }

  console.log(`[install/report] ${computerName ?? "?"} (${rustdeskId}) org=${orgToken} customer=${effectiveCustomerId ?? "none"}`);
  return NextResponse.json({ ok: true, id: registration.id });
}

async function autoAssignDevice(p: {
  organizationId: string;
  customerId: string;
  registrationId: string;
  rustdeskId: string;
  computerName: string | null;
  password: string | null;
}) {
  // Skip if RustDesk ID already exists as a device in this org
  const existing = await prisma.remoteId.findFirst({
    where: { remoteId: p.rustdeskId, type: "rustdesk", device: { organizationId: p.organizationId } },
    select: { id: true },
  });
  if (existing) return;

  const device = await prisma.device.create({
    data: {
      name: p.computerName ?? p.rustdeskId,
      organizationId: p.organizationId,
      customerId: p.customerId,
      tags: ["remotelog-installer"],
      remoteIds: {
        create: {
          type: "rustdesk",
          remoteId: p.rustdeskId,
          ...(p.password ? { password: p.password } : {}),
        },
      },
    },
  });

  await prisma.deviceRegistration.update({
    where: { id: p.registrationId },
    data: { status: "assigned", deviceId: device.id },
  });
}
