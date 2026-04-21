const PAYPAL_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PayPal credentials not configured");

  const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function paypalFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal API ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export interface PayPalSubscription {
  id: string;
  status: string; // ACTIVE | SUSPENDED | CANCELLED | EXPIRED
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { time?: string };
  };
}

export interface PayPalSubscriptionLinks {
  id: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

/**
 * Creates a PayPal subscription and returns the approval URL + subscription ID.
 */
export async function createPayPalSubscription(
  paypalPlanId: string,
  returnUrl: string,
  cancelUrl: string
): Promise<{ approvalUrl: string; subscriptionId: string }> {
  const data = await paypalFetch<PayPalSubscriptionLinks>(
    "/v1/billing/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        plan_id: paypalPlanId,
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          user_action: "SUBSCRIBE_NOW",
        },
      }),
    }
  );

  const approvalUrl = data.links.find((l) => l.rel === "approve")?.href;
  if (!approvalUrl) throw new Error("No approval URL in PayPal response");

  return { approvalUrl, subscriptionId: data.id };
}

/**
 * Fetches the current status of a PayPal subscription.
 */
export async function getPayPalSubscription(
  subscriptionId: string
): Promise<PayPalSubscription> {
  return paypalFetch<PayPalSubscription>(
    `/v1/billing/subscriptions/${subscriptionId}`
  );
}

/**
 * Cancels a PayPal subscription.
 */
export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason = "Cancelled by user"
): Promise<void> {
  await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
