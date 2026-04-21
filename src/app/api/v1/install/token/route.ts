import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// Short, dictation-friendly token: 6 uppercase chars excluding ambiguous (0/O, 1/I/L)
function generateShortToken(): string {
  const charset = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  // Use crypto.getRandomValues equivalent via randomInt approach
  const { randomInt } = require("crypto") as typeof import("crypto");
  for (let i = 0; i < 6; i++) {
    result += charset[randomInt(charset.length)];
  }
  return result;
}

// GET: return current token (create one if missing)
export async function GET() {
  const session = await requireAuth();

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { registrationToken: true },
  });

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let token = org.registrationToken;
  if (!token) {
    token = generateShortToken();
    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { registrationToken: token },
    });
  }

  return NextResponse.json({ token });
}

// POST: regenerate token
export async function POST() {
  const session = await requireAuth();
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = generateShortToken();
  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { registrationToken: token },
  });

  return NextResponse.json({ token });
}
