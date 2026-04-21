import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await prisma.group.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "readonly") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, parentId } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      parentId: parentId ?? null,
      organizationId: session.user.organizationId,
    },
  });

  return NextResponse.json(group, { status: 201 });
}
