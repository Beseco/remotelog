import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Hash a plaintext key
function hashKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

// Generate a random API key
function generateKey(): string {
  return "rl_" + crypto.randomBytes(32).toString("hex");
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      type: true,
      active: true,
      expiresAt: true,
      lastUsedAt: true,
      ipWhitelist: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    keys.map((k) => ({
      ...k,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, type, expiresAt, ipWhitelist } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  const validTypes = ["setup", "full", "readonly"];
  if (type && !validTypes.includes(type)) {
    return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 });
  }

  const plaintext = generateKey();
  const keyHash = hashKey(plaintext);

  const key = await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      keyHash,
      type: type ?? "readonly",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      ipWhitelist: Array.isArray(ipWhitelist) ? ipWhitelist : [],
    },
    select: {
      id: true,
      name: true,
      type: true,
      active: true,
      expiresAt: true,
      lastUsedAt: true,
      ipWhitelist: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      ...key,
      plaintext, // only returned once on creation
      expiresAt: key.expiresAt?.toISOString() ?? null,
      lastUsedAt: null,
      createdAt: key.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
