import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAuth } from "@/lib/api-auth";

/** Returns the currently active (not yet ended) session for the logged-in user, or null. */
export async function GET() {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = await prisma.session.findFirst({
    where: { userId: user.id, endedAt: null },
    include: {
      device: {
        select: {
          id: true,
          name: true,
          ipAddress: true,
          remoteIds: { select: { type: true, remoteId: true, label: true } },
        },
      },
      customer:  { select: { id: true, name: true } },
      contact:   { select: { id: true, firstName: true, lastName: true } },
      intervals: true,
      user: {
        select: {
          notifIntervalMins: true,
          organization: { select: { minMins: true } },
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  if (!active) return NextResponse.json(null);

  // Compute worked time and pause state from intervals
  const now = new Date();
  let workedMs = 0;
  let isPaused = false;

  if (active.intervals.length === 0) {
    // No intervals: legacy session without pause support, count from startedAt
    workedMs = now.getTime() - active.startedAt.getTime();
  } else {
    for (const interval of active.intervals) {
      const end = interval.endedAt ?? now;
      workedMs += end.getTime() - interval.startedAt.getTime();
    }
    isPaused = !active.intervals.some((i) => i.endedAt === null);
  }

  return NextResponse.json({
    id:                   active.id,
    startedAt:            active.startedAt.toISOString(),
    type:                 active.type,
    device:               active.device,
    customer:             active.customer,
    contact:              active.contact,
    isPaused,
    workedSecondsAtFetch: Math.floor(workedMs / 1000),
    notifIntervalMins:    active.user.notifIntervalMins,
    minMins:              active.user.organization.minMins,
  });
}
