import { prisma } from "@/lib/prisma";

type PayPalWebhookEvent = {
  event_type: string;
  resource: {
    id: string;            // PayPal subscription ID
    status?: string;
    billing_info?: {
      next_billing_time?: string;
    };
  };
};

/**
 * Processes a verified PayPal webhook event and updates the subscription in the DB.
 */
export async function handlePayPalWebhookEvent(event: PayPalWebhookEvent) {
  const paypalSubId = event.resource.id;

  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const nextBilling = event.resource.billing_info?.next_billing_time;
      await prisma.subscription.updateMany({
        where: { paypalSubscriptionId: paypalSubId },
        data: {
          status: "active",
          currentPeriodEnd: nextBilling ? new Date(nextBilling) : null,
        },
      });
      break;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED": {
      await prisma.subscription.updateMany({
        where: { paypalSubscriptionId: paypalSubId },
        data: { status: "cancelled" },
      });
      break;
    }

    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "PAYMENT.SALE.DENIED":
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      await prisma.subscription.updateMany({
        where: { paypalSubscriptionId: paypalSubId },
        data: { status: "past_due" },
      });
      break;
    }

    case "BILLING.SUBSCRIPTION.RENEWED": {
      const nextBilling = event.resource.billing_info?.next_billing_time;
      await prisma.subscription.updateMany({
        where: { paypalSubscriptionId: paypalSubId },
        data: {
          status: "active",
          currentPeriodEnd: nextBilling ? new Date(nextBilling) : null,
        },
      });
      break;
    }

    default:
      // Unhandled event type — safe to ignore
      break;
  }
}
