// Public API of the Reseller addon.
// Import from here in app code — never import internals directly.
export { resellerGuard } from "./guard";
export { checkLimit, type LimitResource, type LimitResult } from "./limits";
export { DEFAULT_PLANS, type PlanName } from "./plans";
