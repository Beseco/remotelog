import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function fmt(n: number | null) {
  return n === null ? "∞" : String(n);
}

export default async function PricingPage() {
  if (!process.env.RESELLER_MODE) redirect("/");

  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-gray-900">Einfache Preise</h1>
          <p className="text-lg text-gray-600">14 Tage kostenlos testen — keine Kreditkarte erforderlich</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => {
            const highlighted = i === 1; // Starter is highlighted
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 space-y-6 ${
                  highlighted
                    ? "bg-blue-600 text-white shadow-xl scale-105"
                    : "bg-white shadow-md"
                }`}
              >
                <div>
                  <h2 className={`text-xl font-bold ${highlighted ? "text-white" : "text-gray-900"}`}>
                    {plan.name}
                  </h2>
                  <div className="mt-2 flex items-end gap-1">
                    <span className={`text-4xl font-extrabold ${highlighted ? "text-white" : "text-gray-900"}`}>
                      {plan.price === 0 ? "0 €" : `${plan.price} €`}
                    </span>
                    {plan.price > 0 && (
                      <span className={`text-sm pb-1 ${highlighted ? "text-blue-200" : "text-gray-500"}`}>
                        /Monat
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2">
                  {[
                    { label: "Kunden", value: fmt(plan.maxCustomers) },
                    { label: "Projekte", value: fmt(plan.maxProjects) },
                    { label: "Geräte", value: fmt(plan.maxDevices) },
                    { label: "Benutzer", value: fmt(plan.maxUsers) },
                  ].map((f) => (
                    <li
                      key={f.label}
                      className={`flex items-center justify-between text-sm ${
                        highlighted ? "text-blue-100" : "text-gray-600"
                      }`}
                    >
                      <span>{f.label}</span>
                      <span className={`font-semibold ${highlighted ? "text-white" : "text-gray-900"}`}>
                        {f.value}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`block text-center rounded-xl py-2.5 font-medium transition-colors ${
                    highlighted
                      ? "bg-white text-blue-600 hover:bg-blue-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {plan.price === 0 ? "Kostenlos starten" : "Jetzt starten"}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-gray-500">
          Bereits registriert?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
