import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      id: true,
      name: true,
      hourlyRate: true,
      roundUpMins: true,
      prepMins: true,
      followUpMins: true,
      minMins: true,
    },
  });

  if (!org) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(org);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, hourlyRate, roundUpMins, prepMins, followUpMins, minMins } = body;

  if (
    name === undefined &&
    hourlyRate === undefined &&
    roundUpMins === undefined &&
    prepMins === undefined &&
    followUpMins === undefined &&
    minMins === undefined
  ) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  if (roundUpMins !== undefined && (typeof roundUpMins !== "number" || roundUpMins < 1)) {
    return NextResponse.json({ error: "Aufrunden muss mindestens 1 Minute sein" }, { status: 400 });
  }

  const numFields: Record<string, unknown> = { hourlyRate, prepMins, followUpMins, minMins };
  for (const [key, val] of Object.entries(numFields)) {
    if (val !== undefined && (typeof val !== "number" || val < 0)) {
      return NextResponse.json({ error: `${key} muss eine nicht-negative Zahl sein` }, { status: 400 });
    }
  }

  const org = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      ...(name?.trim()             ? { name: name.trim() }  : {}),
      ...(hourlyRate  !== undefined ? { hourlyRate }         : {}),
      ...(roundUpMins !== undefined ? { roundUpMins }        : {}),
      ...(prepMins    !== undefined ? { prepMins }           : {}),
      ...(followUpMins !== undefined ? { followUpMins }      : {}),
      ...(minMins     !== undefined ? { minMins }            : {}),
    },
  });

  return NextResponse.json(org);
}
