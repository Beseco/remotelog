-- Add multi-value contact channels (Postgres text[])
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill from legacy scalar fields
UPDATE "Contact"
SET "emails" = ARRAY(
  SELECT DISTINCT e
  FROM unnest(
    COALESCE("emails", ARRAY[]::TEXT[])
    || CASE WHEN "email" IS NULL OR btrim("email") = '' THEN ARRAY[]::TEXT[] ELSE ARRAY[btrim("email")] END
  ) AS e
  WHERE e IS NOT NULL AND btrim(e) <> ''
);

UPDATE "Contact"
SET "phones" = ARRAY(
  SELECT DISTINCT p
  FROM unnest(
    COALESCE("phones", ARRAY[]::TEXT[])
    || CASE WHEN "phone" IS NULL OR btrim("phone") = '' THEN ARRAY[]::TEXT[] ELSE ARRAY[btrim("phone")] END
    || CASE WHEN "mobile" IS NULL OR btrim("mobile") = '' THEN ARRAY[]::TEXT[] ELSE ARRAY[btrim("mobile")] END
  ) AS p
  WHERE p IS NOT NULL AND btrim(p) <> ''
);
