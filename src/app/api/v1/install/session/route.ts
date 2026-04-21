import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Generates a short token like "K7MX9P2A" (8 uppercase chars, no ambiguous chars)
function generateSessionToken(): string {
  const charset = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  const { randomInt } = require("crypto") as typeof import("crypto");
  for (let i = 0; i < 8; i++) {
    result += charset[randomInt(charset.length)];
  }
  return result;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orgToken, email } = body as Record<string, string>;

  if (!orgToken) {
    return NextResponse.json({ error: "orgToken fehlt" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { registrationToken: orgToken.toUpperCase() },
    select: { id: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Ungültiger Token" }, { status: 404 });
  }

  // Generate unique session token (retry on collision)
  let sessionToken: string;
  let attempts = 0;
  do {
    sessionToken = generateSessionToken();
    attempts++;
    if (attempts > 10) {
      return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
    }
    const existing = await prisma.deviceRegistration.findUnique({
      where: { sessionToken },
    });
    if (!existing) break;
  } while (true);

  await prisma.deviceRegistration.create({
    data: {
      organizationId: org.id,
      email: email?.trim() || null,
      sessionToken,
      rustdeskId: "",
      password: "",
      status: "pending",
    },
  });

  return NextResponse.json({ sessionToken });
}
