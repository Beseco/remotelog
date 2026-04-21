import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPayPalSubscription } from "@/addons/reseller/paypal/client";

export async function GET(req: NextRequest) {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get("subscription_id");
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  if (!subscriptionId) {
    return NextResponse.redirect(new URL("/billing?error=missing_id", baseUrl));
  }

  try {
    const ppSub = await getPayPalSubscription(subscriptionId);
    const nextBilling = ppSub.billing_info?.next_billing_time;

    await prisma.subscription.updateMany({
      where: { paypalSubscriptionId: subscriptionId },
      data: {
        status: ppSub.status === "ACTIVE" ? "active" : "trialing",
        paypalSubscriptionId: subscriptionId,
        currentPeriodEnd: nextBilling ? new Date(nextBilling) : null,
      },
    });
  } catch {
    // Webhook will correct this later
  }

  return NextResponse.redirect(new URL("/billing?success=1", baseUrl));
}
