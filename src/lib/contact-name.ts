/** Normalize a contact name part for comparisons and storage. */
export function normalizeContactNamePart(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\u00a0/g, " ") // NBSP → space
    .replace(/[\s\u2000-\u200b\u202f\u205f\u3000]+/g, " ") // collapse unicode-ish whitespace
    .trim();
}

/** Lowercase + collapse inner spaces (for duplicate grouping keys). */
export function normalizeContactNameKey(raw: string): string {
  return normalizeContactNamePart(raw).toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.normalize("NFKC").trim();
  if (!v) return null;
  return v.toLowerCase();
}

/** Normalize phone numbers for duplicate grouping (digits + optional leading '+'). */
export function normalizePhoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.normalize("NFKC").trim();
  if (!v) return null;
  const digits = v.replace(/[^\d+]/g, "");
  if (!digits) return null;
  // Keep '+' only if it is the first char; strip other '+' occurrences defensively
  const cleaned = digits.startsWith("+") ? `+${digits.slice(1).replace(/\+/g, "")}` : digits.replace(/\+/g, "");
  const digitCount = cleaned.replace(/\D/g, "").length;
  if (digitCount < 6) return null;
  return cleaned;
}

export function dedupePreserveOrder(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
