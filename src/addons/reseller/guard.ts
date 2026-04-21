import { NextResponse } from "next/server";
import { checkLimit, type LimitResource } from "./limits";

/**
 * Drop-in guard for POST API routes.
 * Returns null if the action is allowed, or a 403 NextResponse if the limit is reached.
 *
 * Usage (2 lines, easily removable):
 *   const guard = await resellerGuard(orgId, "customers");
 *   if (guard) return guard;
 */
export async function resellerGuard(
  orgId: string,
  resource: LimitResource
): Promise<NextResponse | null> {
  const result = await checkLimit(orgId, resource);
  if (result.allowed) return null;

  const labels: Record<LimitResource, string> = {
    customers: "Kunden",
    projects:  "Projekte",
    devices:   "Geräte",
    users:     "Benutzer",
  };

  return NextResponse.json(
    {
      error: `Ihr Plan erlaubt maximal ${result.limit} ${labels[resource]}. Aktuell: ${result.current}. Bitte upgraden Sie Ihren Plan.`,
      limitReached: true,
      resource,
      current: result.current,
      limit: result.limit,
    },
    { status: 403 }
  );
}
