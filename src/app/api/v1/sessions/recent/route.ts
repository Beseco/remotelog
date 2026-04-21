import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAuth } from "@/lib/api-auth";

/** Returns the last 15 finished root sessions (parent-child bundled) for the logged-in user's organisation. */
export async function GET() {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.session.findMany({
    where: {
      user:            { organizationId: user.organizationId },
      endedAt:         { not: null },
      parentSessionId: null,
    },
    include: {
      device:   { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      contact:  { select: { id: true, firstName: true, lastName: true } },
      user:     { select: { id: true, name: true } },
      children: {
        select: {
          id:              true,
          type:            true,
          startedAt:       true,
          endedAt:         true,
          durationMinutes: true,
        },
        orderBy: { startedAt: "asc" },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 15,
  });

  return NextResponse.json(
    sessions.map(s => ({
      id:              s.id,
      type:            s.type,
      startedAt:       s.startedAt.toISOString(),
      endedAt:         s.endedAt!.toISOString(),
      durationMinutes: s.durationMinutes,
      parentSessionId: s.parentSessionId,
      device:          s.device,
      customer:        s.customer,
      contact:         s.contact,
      user:            s.user,
      children:        s.children.map(c => ({
        id:              c.id,
        type:            c.type,
        startedAt:       c.startedAt.toISOString(),
        endedAt:         c.endedAt?.toISOString() ?? null,
        durationMinutes: c.durationMinutes,
      })),
    }))
  );
}
