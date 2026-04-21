import { z } from "zod/v4";
import type { AddonDefinition, AddonMeta } from "../types";

export const proxmoxNodeMappingSchema = z.object({
  name: z.string(),
  customerId: z.string().optional(),
  groupId: z.string().optional(),
});

export const proxmoxConfigSchema = z.object({
  apiUrl: z.url({ error: "Gültige URL erforderlich (z.B. https://proxmox.example.com:8006)" }),
  tokenId: z.string().min(1, "Token-ID erforderlich (Format: USER@REALM!TOKENNAME)"),
  tokenSecret: z.string().min(1, "Token-Secret erforderlich (UUID aus Proxmox)"),
  verifySsl: z.boolean().default(false),
  sshUser: z.string().default("root"),
  sshPrivateKey: z.string().optional(),
  importQemu: z.boolean().default(true),
  importLxc: z.boolean().default(true),
  importNodes: z.boolean().default(false),
  importConsole: z.boolean().default(true),
  importSsh: z.boolean().default(true),
  importVnc: z.boolean().default(false),
  nodes: z.array(proxmoxNodeMappingSchema).default([]),
});

export type ProxmoxConfig = z.infer<typeof proxmoxConfigSchema>;
export type ProxmoxNodeMapping = z.infer<typeof proxmoxNodeMappingSchema>;

export const proxmoxAddonMeta: AddonMeta = {
  key: "proxmox",
  name: "Proxmox",
  description:
    "Importiert VMs und Container aus Proxmox als Geräte und ermöglicht SSH-, Konsolen- und RDP-Verbindungen direkt aus RemoteLog.",
  isPremium: false,
};

export type { AddonDefinition };
