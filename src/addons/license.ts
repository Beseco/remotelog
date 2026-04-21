export function checkAddonAccess(
  isPremium: boolean,
  config: Record<string, unknown>
): { allowed: boolean; reason?: string } {
  if (!isPremium) return { allowed: true };
  const key = config.licenseKey;
  if (typeof key === "string" && key.trim().length > 0) return { allowed: true };
  return { allowed: false, reason: "Gültiger Lizenzschlüssel erforderlich" };
}
