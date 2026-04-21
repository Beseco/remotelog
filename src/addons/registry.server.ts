import type { AddonMeta } from "./types";
import { zammadAddonMeta } from "./zammad/index";
import { invoiceNinjaAddonMeta } from "./invoiceninja/index";
import { proxmoxAddonMeta } from "./proxmox/index";

export const addonRegistryMeta: AddonMeta[] = [zammadAddonMeta, invoiceNinjaAddonMeta, proxmoxAddonMeta];

export function getAddonMeta(key: string): AddonMeta | undefined {
  return addonRegistryMeta.find((a) => a.key === key);
}
