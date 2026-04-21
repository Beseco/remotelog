export type BillingSettings = {
  hourlyRate: number;
  roundUpMins: number;
  prepMins: number;
  followUpMins: number;
  minMins: number;
};

/**
 * Returns the billable minutes for a session:
 *   - If actual < minMins → 0 (not billed at all)
 *   - Otherwise: ceil((actual + prepMins + followUpMins) / roundUpMins) * roundUpMins
 */
export function calcBillableMinutes(
  actualMinutes: number,
  settings: BillingSettings,
): number {
  if (actualMinutes < settings.minMins) return 0;
  const total = actualMinutes + settings.prepMins + settings.followUpMins;
  const r = Math.max(1, settings.roundUpMins); // guard against division by zero
  return Math.ceil(total / r) * r;
}

/**
 * Returns the net amount in EUR for the given billable minutes and hourly rate.
 */
export function calcAmount(billableMinutes: number, hourlyRate: number): number {
  return (billableMinutes / 60) * hourlyRate;
}

/**
 * Format a currency amount as EUR string (German locale).
 */
export function fmtEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}
