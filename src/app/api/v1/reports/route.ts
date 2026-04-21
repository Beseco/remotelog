import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcBillableMinutes, calcAmount } from "@/lib/billing";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.user.organizationId;
  const { searchParams } = new URL(req.url);

  const from        = searchParams.get("from");
  const to          = searchParams.get("to");
  const deviceId    = searchParams.get("deviceId");
  const groupId     = searchParams.get("groupId");
  const customerId  = searchParams.get("customerId");
  const userId      = searchParams.get("userId");
  const type        = searchParams.get("type");
  const billedParam = searchParams.get("billed"); // "true" | "false" | "" = all

  const fromDate = from ? new Date(from)             : undefined;
  const toDate   = to   ? new Date(to + "T23:59:59") : undefined;
  const billed   = billedParam === "true"  ? true
                 : billedParam === "false" ? false
                 : undefined;

  // Fetch billing settings alongside sessions (single round-trip)
  const [org, sessions] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        hourlyRate: true,
        roundUpMins: true,
        prepMins: true,
        followUpMins: true,
        minMins: true,
      },
    }),
    prisma.session.findMany({
      where: {
        // Only root sessions
        parentSessionId: null,
        // Scope to organisation via the user relation
        user: { organizationId: orgId },
        ...(fromDate || toDate ? {
          startedAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate   ? { lte: toDate   } : {}),
          },
        } : {}),
        ...(deviceId   ? { deviceId }                                               : {}),
        ...(groupId    ? { device: { groupId, organizationId: orgId } }             : {}),
        ...(customerId ? {
          OR: [
            { customerId },
            { device:  { customerId } },
            { contact: { customerId } },
          ],
        } : {}),
        ...(userId     ? { userId }                                                  : {}),
        ...(type       ? { type }                                                    : {}),
        ...(billed !== undefined ? { billed }                                        : {}),
      },
      include: {
        device:   { select: { id: true, name: true, group: { select: { id: true, name: true } } } },
        customer: { select: { id: true, name: true } },
        contact:  { select: { id: true, firstName: true, lastName: true } },
        user:     { select: { id: true, name: true } },
        notes:    { orderBy: { createdAt: "asc" } },
        children: {
          select: {
            id:              true,
            startedAt:       true,
            endedAt:         true,
            durationMinutes: true,
            type:            true,
            billed:          true,
            billedAt:        true,
          },
          orderBy: { startedAt: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const billing = org ?? { hourlyRate: 0, roundUpMins: 15, prepMins: 0, followUpMins: 0, minMins: 0 };

  /** Sum durationMinutes of root + all children */
  function groupDuration(s: typeof sessions[number]): number | null {
    const all = [s, ...s.children];
    const finished = all.filter(e => e.durationMinutes !== null);
    if (finished.length === 0) return null;
    return finished.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  }

  /** Last endedAt among root + children */
  function groupLastEndedAt(s: typeof sessions[number]): Date | null {
    const candidates = [s.endedAt, ...s.children.map(c => c.endedAt)].filter(Boolean) as Date[];
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => b.getTime() - a.getTime())[0];
  }

  const completedSessions = sessions.filter(s => s.endedAt !== null);
  const totalMinutes = completedSessions.reduce((sum, s) => sum + (groupDuration(s) ?? 0), 0);

  const byType: Record<string, { count: number; minutes: number }> = {};
  for (const s of completedSessions) {
    if (!byType[s.type]) byType[s.type] = { count: 0, minutes: 0 };
    byType[s.type].count++;
    byType[s.type].minutes += groupDuration(s) ?? 0;
  }

  const byDevice: Record<string, { name: string; count: number; minutes: number }> = {};
  for (const s of completedSessions) {
    if (!s.device) continue;
    const id = s.device.id;
    if (!byDevice[id]) byDevice[id] = { name: s.device.name, count: 0, minutes: 0 };
    byDevice[id].count++;
    byDevice[id].minutes += groupDuration(s) ?? 0;
  }

  let totalBillableMinutes = 0;
  let totalAmount          = 0;
  let unbilledMinutes      = 0;
  let unbilledAmount       = 0;

  for (const s of completedSessions) {
    const mins = calcBillableMinutes(groupDuration(s) ?? 0, billing);
    const amt  = calcAmount(mins, billing.hourlyRate);
    totalBillableMinutes += mins;
    totalAmount          += amt;
    if (!s.billed) {
      unbilledMinutes += mins;
      unbilledAmount  += amt;
    }
  }

  return NextResponse.json({
    sessions: sessions.map(s => {
      const totalMins    = groupDuration(s);
      const lastEndedAt  = groupLastEndedAt(s);
      const billableMins = totalMins !== null ? calcBillableMinutes(totalMins, billing) : null;
      return {
        ...s,
        startedAt:       s.startedAt.toISOString(),
        endedAt:         s.endedAt?.toISOString() ?? null,
        billedAt:        s.billedAt?.toISOString() ?? null,
        lastEndedAt:     lastEndedAt?.toISOString() ?? null,
        totalDurationMinutes: totalMins,
        billableMinutes: billableMins,
        amount:          billableMins !== null ? calcAmount(billableMins, billing.hourlyRate) : null,
        children:        s.children.map(c => ({
          ...c,
          startedAt: c.startedAt.toISOString(),
          endedAt:   c.endedAt?.toISOString() ?? null,
          billedAt:  c.billedAt?.toISOString() ?? null,
        })),
      };
    }),
    billing: {
      hourlyRate:   billing.hourlyRate,
      roundUpMins:  billing.roundUpMins,
      prepMins:     billing.prepMins,
      followUpMins: billing.followUpMins,
      minMins:      billing.minMins,
      orgName:      org?.name ?? "",
    },
    stats: {
      total:                sessions.length,
      completed:            completedSessions.length,
      active:               sessions.length - completedSessions.length,
      totalMinutes,
      byType,
      byDevice:             Object.values(byDevice).sort((a, b) => b.minutes - a.minutes).slice(0, 10),
      totalBillableMinutes,
      totalAmount,
      unbilledMinutes,
      unbilledAmount,
    },
  });
}
