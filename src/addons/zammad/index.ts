import { z } from "zod/v4";
import type { AddonDefinition, AddonMeta } from "../types";
import type { ZammadConfigForm as ZammadConfigFormType } from "./config-form";

export const zammadConfigSchema = z.object({
  zammadUrl: z.url({ error: "Gültige URL erforderlich" }),
  apiToken: z.string().min(1, "API-Token erforderlich"),
  licenseKey: z.string().optional(),
});

export type ZammadConfig = z.infer<typeof zammadConfigSchema>;

export const zammadAddonMeta: AddonMeta = {
  key: "zammad",
  name: "Zammad",
  description:
    "Synchronisiert Zammad-Organisationen als Kunden und deren Mitglieder als Kontakte in Remotelog.",
  isPremium: false,
};

// Lazy import to avoid pulling React into server-only code paths.
// The full addon definition (with ConfigFormComponent) is in registry.ts.
export type { ZammadConfigFormType };
