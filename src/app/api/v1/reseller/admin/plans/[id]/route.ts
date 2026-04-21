import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    maxCustomers?: number | null;
    maxProjects?: number | null;
    maxDevices?: number | null;
    maxUsers?: number | null;
    paypalPlanId?: string | null;
    price?: number;
    active?: boolean;
  };

  const plan = await prisma.plan.update({
    where: { id },
    data: {
      ...(body.maxCustomers !== undefined ? { maxCustomers: body.maxCustomers } : {}),
      ...(body.maxProjects  !== undefined ? { maxProjects:  body.maxProjects  } : {}),
      ...(body.maxDevices   !== undefined ? { maxDevices:   body.maxDevices   } : {}),
      ...(body.maxUsers     !== undefined ? { maxUsers:     body.maxUsers     } : {}),
      ...(body.paypalPlanId !== undefined ? { paypalPlanId: body.paypalPlanId } : {}),
      ...(body.price        !== undefined ? { price:        body.price        } : {}),
      ...(body.active       !== undefined ? { active:       body.active       } : {}),
    },
  });

  return NextResponse.json(plan);
}
