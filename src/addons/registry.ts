import type { AddonDefinition } from "./types";
import { zammadAddonMeta, zammadConfigSchema } from "./zammad/index";
import { ZammadConfigForm } from "./zammad/config-form";
import { invoiceNinjaAddonMeta, invoiceNinjaConfigSchema } from "./invoiceninja/index";
import { InvoiceNinjaConfigForm } from "./invoiceninja/config-form";
import { proxmoxAddonMeta, proxmoxConfigSchema } from "./proxmox/index";
import { ProxmoxConfigForm } from "./proxmox/config-form";

export const addonRegistry: AddonDefinition[] = [
  {
    ...zammadAddonMeta,
    configSchema: zammadConfigSchema,
    ConfigFormComponent: ZammadConfigForm,
  },
  {
    ...invoiceNinjaAddonMeta,
    configSchema: invoiceNinjaConfigSchema,
    ConfigFormComponent: InvoiceNinjaConfigForm,
  },
  {
    ...proxmoxAddonMeta,
    configSchema: proxmoxConfigSchema,
    ConfigFormComponent: ProxmoxConfigForm,
  },
];

export function getAddon(key: string): AddonDefinition | undefined {
  return addonRegistry.find((a) => a.key === key);
}
