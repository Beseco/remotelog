import { z } from "zod/v4";
import type { AddonDefinition, AddonMeta } from "../types";

export const invoiceNinjaConfigSchema = z.object({
  invoiceNinjaUrl: z.url({ error: "Gültige URL erforderlich" }),
  apiToken: z.string().min(1, "API-Token erforderlich"),
  licenseKey: z.string().optional(),
});

export type InvoiceNinjaConfig = z.infer<typeof invoiceNinjaConfigSchema>;

export const invoiceNinjaAddonMeta: AddonMeta = {
  key: "invoiceninja",
  name: "Invoice Ninja",
  description:
    "Synchronisiert Kunden und Kontakte aus Remotelog nach Invoice Ninja.",
  isPremium: false,
};

export type { AddonDefinition };
