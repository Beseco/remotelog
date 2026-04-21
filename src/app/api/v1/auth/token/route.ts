import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// POST /api/v1/auth/token
// Body: { email, password, deviceName? }
// Returns: { apiKey, user: { name, email, role } }
//
// Used by the desktop app to exchange email/password for an API key.
// Creates a new "full" API key named "Desktop: <deviceName>" if none exists,
// or returns the existing one (by name prefix) if it was already issued.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    email?: string;
    password?: string;
    deviceName?: string;
  };

  const { email, password, deviceName = "Desktop App" } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "E-Mail und Passwort sind erforderlich" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
  }

  // Update lastLogin
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Reuse existing active desktop key for this user (same device name)
  // We can't retrieve the plaintext key from the hash, so we generate a new one
  // and invalidate the old desktop key if it exists.
  const keyName = `Desktop: ${deviceName}`;

  // Deactivate any existing desktop keys with same name
  const existingKeys = await prisma.apiKey.findMany({
    where: { userId: user.id, name: keyName, active: true, type: "full" },
  });
  if (existingKeys.length > 0) {
    await prisma.apiKey.updateMany({
      where: { id: { in: existingKeys.map((k) => k.id) } },
      data: { active: false },
    });
  }

  // Generate new API key
  const rawKey = `rl_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  await prisma.apiKey.create({
    data: {
      userId: user.id,
      name: keyName,
      keyHash,
      type: "full",
      active: true,
    },
  });

  return NextResponse.json({
    apiKey: rawKey,
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}
