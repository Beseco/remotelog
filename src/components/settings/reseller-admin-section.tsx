"use client";

import { useEffect, useState } from "react";

type OrgRow = {
  id: string;
  name: string;
  createdAt: string;
  planName: string | null;
  status: string | null;
  trialEndsAt: string | null;
  userCount: number;
};

type PlanRow = {
  id: string;
  name: string;
  price: number;
  maxCustomers: number | null;
  maxProjects: number | null;
  maxDevices: number | null;
  maxUsers: number | null;
  paypalPlanId: string | null;
  active: boolean;
};

const statusColors: Record<string, string> = {
  trialing:  "bg-blue-100 text-blue-700",
  active:    "bg-green-100 text-green-700",
  past_due:  "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

export function ResellerAdminSection() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [tab, setTab] = useState<"orgs" | "plans">("orgs");
  const [editPlan, setEditPlan] = useState<PlanRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/v1/reseller/admin/orgs").then((r) => r.json()).then(setOrgs).catch(() => null);
    fetch("/api/v1/reseller/admin/plans").then((r) => r.json()).then(setPlans).catch(() => null);
  }, []);

  async function savePlan(plan: PlanRow) {
    setSaving(true);
    try {
      await fetch(`/api/v1/reseller/admin/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      setPlans((ps) => ps.map((p) => (p.id === plan.id ? plan : p)));
      setEditPlan(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
          RESELLER
        </span>
        <h2 className="text-lg font-semibold text-gray-900">Reseller-Verwaltung</h2>
      </div>

      <div className="flex gap-2">
        {(["orgs", "plans"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "orgs" ? "Organisationen" : "Pläne"}
          </button>
        ))}
      </div>

      {tab === "orgs" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-orange-200">
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Organisation</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Plan</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Status</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Benutzer</th>
                <th className="text-left py-2 font-medium text-gray-600">Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className="border-b border-orange-100">
                  <td className="py-2 pr-4 font-medium text-gray-900">{org.name}</td>
                  <td className="py-2 pr-4 text-gray-600">{org.planName ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {org.status ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[org.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {org.status}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{org.userCount}</td>
                  <td className="py-2 text-gray-500 text-xs">
                    {new Date(org.createdAt).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-400 text-xs">
                    Keine Organisationen
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "plans" && (
        <div className="space-y-3">
          {plans.map((plan) =>
            editPlan?.id === plan.id ? (
              <PlanEditRow
                key={plan.id}
                plan={editPlan}
                saving={saving}
                onChange={setEditPlan}
                onSave={() => void savePlan(editPlan)}
                onCancel={() => setEditPlan(null)}
              />
            ) : (
              <div
                key={plan.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{plan.name}</p>
                  <p className="text-xs text-gray-500">
                    {plan.price} €/mo · K:{plan.maxCustomers ?? "∞"} P:{plan.maxProjects ?? "∞"}{" "}
                    G:{plan.maxDevices ?? "∞"} B:{plan.maxUsers ?? "∞"}
                    {plan.paypalPlanId && ` · PP: ${plan.paypalPlanId.slice(0, 12)}…`}
                  </p>
                </div>
                <button
                  onClick={() => setEditPlan(plan)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Bearbeiten
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function PlanEditRow({
  plan,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  plan: PlanRow;
  saving: boolean;
  onChange: (p: PlanRow) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  function set(field: keyof PlanRow) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onChange({
        ...plan,
        [field]: field === "paypalPlanId" ? (val || null) : (val === "" ? null : Number(val)),
      });
    };
  }

  return (
    <div className="bg-white rounded-xl border border-blue-300 p-4 space-y-3">
      <p className="font-medium text-gray-900">{plan.name}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {(["maxCustomers", "maxProjects", "maxDevices", "maxUsers"] as const).map((f) => (
          <div key={f}>
            <label className="block text-xs text-gray-500 mb-0.5">
              {f.replace("max", "Max. ").replace("C", "K").replace("U", "B")}
            </label>
            <input
              type="number"
              placeholder="leer = ∞"
              value={plan[f] ?? ""}
              onChange={set(f)}
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-0.5">PayPal Plan-ID</label>
        <input
          type="text"
          placeholder="P-xxxx (aus PayPal Dashboard)"
          value={plan.paypalPlanId ?? ""}
          onChange={(e) => onChange({ ...plan, paypalPlanId: e.target.value || null })}
          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 hover:bg-gray-50"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
