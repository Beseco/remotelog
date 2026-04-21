import { NextRequest, NextResponse } from "next/server";
import { handlePayPalWebhookEvent } from "@/addons/reseller/paypal/webhook";

export async function POST(req: NextRequest) {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Note: For production, verify the PayPal webhook signature here.
  // PayPal sends: PAYPAL-TRANSMISSION-ID, PAYPAL-TRANSMISSION-TIME,
  // PAYPAL-CERT-URL, PAYPAL-TRANSMISSION-SIG headers.
  // For now we trust the event (protect via PAYPAL_WEBHOOK_SECRET in the future).

  try {
    await handlePayPalWebhookEvent(
      body as Parameters<typeof handlePayPalWebhookEvent>[0]
    );
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("PayPal webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
