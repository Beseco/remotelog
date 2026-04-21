import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPayPalSubscription, cancelPayPalSubscription } from "@/addons/reseller/paypal/client";

export async function POST(req: NextRequest) {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await req.json() as { planId?: string };
  if (!planId) return NextResponse.json({ error: "planId fehlt" }, { status: 400 });

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan?.paypalPlanId) {
    return NextResponse.json(
      { error: "Für diesen Plan ist keine PayPal-Integration konfiguriert" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { approvalUrl, subscriptionId } = await createPayPalSubscription(
    plan.paypalPlanId,
    `${baseUrl}/api/v1/reseller/subscribe/return?subscription_id=${encodeURIComponent("")}&plan_id=${planId}`,
    `${baseUrl}/billing?cancelled=1`
  );

  // Store pending subscription ID so return route can look it up
  await prisma.subscription.upsert({
    where: { organizationId: session.user.organizationId },
    create: {
      organizationId: session.user.organizationId,
      planId,
      status: "trialing",
      paypalSubscriptionId: subscriptionId,
    },
    update: {
      paypalSubscriptionId: subscriptionId,
      planId,
    },
  });

  return NextResponse.json({ approvalUrl });
}

export async function DELETE(req: NextRequest) {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await prisma.subscription.findUnique({
    where: { organizationId: session.user.organizationId },
  });

  if (sub?.paypalSubscriptionId) {
    try {
      await cancelPayPalSubscription(sub.paypalSubscriptionId);
    } catch {
      // Best-effort — still update DB
    }
  }

  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "cancelled" },
    });
  }

  return NextResponse.json({ message: "Abonnement gekündigt" });
}
