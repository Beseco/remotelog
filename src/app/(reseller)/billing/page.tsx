import { Suspense } from "react";
import BillingContent from "./billing-content";

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingLoading />}>
      <BillingContent />
    </Suspense>
  );
}

function BillingLoading() {
  return (
    <div className="min-h-screen py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-48 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

