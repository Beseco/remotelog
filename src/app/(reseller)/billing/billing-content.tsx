"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Plan = {
  id: string;
  name: string;
  price: number;
  maxCustomers: number | null;
  maxProjects: number | null;
  maxDevices: number | null;
  maxUsers: number | null;
  paypalPlanId: string | null;
};

type SubscriptionData = {
  subscription: {
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
  plan: Plan | null;
  usage: {
    customers: number;
    projects: number;
    devices: number;
    users: number;
  };
};

const statusLabels: Record<string, { label: string; color: string }> = {
  trialing:  { label: "Testphase",  color: "bg-blue-100 text-blue-800" },
  active:    { label: "Aktiv",      color: "bg-green-100 text-green-800" },
  past_due:  { label: "Überfällig", color: "bg-yellow-100 text-yellow-800" },
  cancelled: { label: "Gekündigt",  color: "bg-red-100 text-red-800" },
};

function UsageBar({ current, limit, label }: { current: number; limit: number | null; label: string }) {
  const pct = limit === null ? 0 : Math.min(100, (current / limit) * 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-blue-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">
          {current} / {limit === null ? "∞" : limit}
        </span>
      </div>
      {limit !== null && (
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("success")) setMsg("Abonnement erfolgreich aktiviert!");
    if (searchParams.get("cancelled")) setMsg("Checkout abgebrochen.");
    if (searchParams.get("error")) setMsg("Ein Fehler ist aufgetreten.");
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/reseller/subscription").then((r) => r.json()) as Promise<SubscriptionData>,
      fetch("/api/v1/reseller/plans").then((r) => r.json()) as Promise<Plan[]>,
    ]).then(([sub, pl]) => {
      setData(sub);
      setPlans(pl);
      setLoading(false);
    });
  }, []);

  async function handleUpgrade(planId: string) {
    setUpgrading(planId);
    try {
      const res = await fetch("/api/v1/reseller/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const json = await res.json() as { approvalUrl?: string; error?: string };
      if (json.approvalUrl) {
        window.location.href = json.approvalUrl;
      } else {
        setMsg(json.error ?? "Fehler");
      }
    } finally {
      setUpgrading(null);
    }
  }

  async function handleCancel() {
    if (!confirm("Abonnement wirklich kündigen?")) return;
    setCancelling(true);
    try {
      await fetch("/api/v1/reseller/subscribe", { method: "DELETE" });
      setMsg("Abonnement wurde gekündigt.");
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const { subscription, plan, usage } = data!;
  const statusInfo = subscription ? (statusLabels[subscription.status] ?? { label: subscription.status, color: "bg-gray-100 text-gray-800" }) : null;

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Abonnement & Plan</h1>

        {msg && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 text-sm">
            {msg}
          </div>
        )}

        {/* Current plan */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {plan?.name ?? "Kein Plan"}
              </h2>
              <p className="text-sm text-gray-500">
                {plan && plan.price > 0 ? `${plan.price} €/Monat` : "Kostenlos"}
              </p>
            </div>
            {statusInfo && (
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )}
          </div>

          {subscription?.status === "trialing" && subscription.trialEndsAt && (
            <p className="text-sm text-blue-600">
              Testphase endet am {new Date(subscription.trialEndsAt).toLocaleDateString("de-DE")}
            </p>
          )}
          {subscription?.status === "active" && subscription.currentPeriodEnd && (
            <p className="text-sm text-gray-500">
              Nächste Zahlung: {new Date(subscription.currentPeriodEnd).toLocaleDateString("de-DE")}
            </p>
          )}

          {/* Usage */}
          {plan && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <UsageBar current={usage.customers} limit={plan.maxCustomers} label="Kunden" />
              <UsageBar current={usage.projects}  limit={plan.maxProjects}  label="Projekte" />
              <UsageBar current={usage.devices}   limit={plan.maxDevices}   label="Geräte" />
              <UsageBar current={usage.users}     limit={plan.maxUsers}     label="Benutzer" />
            </div>
          )}
        </div>

        {/* Available plans */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Plan wechseln</h2>
          {plans.map((p) => {
            const isCurrent = p.id === plan?.id;
            const canUpgrade = p.paypalPlanId != null;
            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border p-4 flex items-center justify-between ${
                  isCurrent ? "border-blue-400" : "border-gray-200"
                }`}
              >
                <div>
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-500">
                    {p.price === 0 ? "Kostenlos" : `${p.price} €/Monat`} ·{" "}
                    {p.maxCustomers ?? "∞"} Kunden · {p.maxDevices ?? "∞"} Geräte
                  </p>
                </div>
                {isCurrent ? (
                  <span className="text-xs font-medium text-blue-600">Aktuell</span>
                ) : canUpgrade ? (
                  <button
                    onClick={() => void handleUpgrade(p.id)}
                    disabled={upgrading === p.id}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50 transition-colors"
                  >
                    {upgrading === p.id ? "…" : "Wechseln"}
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">Bald verfügbar</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Cancel */}
        {subscription?.status === "active" && (
          <div className="pt-2">
            <button
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="text-sm text-red-500 hover:underline disabled:opacity-50"
            >
              {cancelling ? "Wird gekündigt…" : "Abonnement kündigen"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
