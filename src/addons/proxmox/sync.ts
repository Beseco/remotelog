import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { ProxmoxClient } from "./client";
import type { ProxmoxVM, ProxmoxContainer } from "./types";
import type { ProxmoxConfig } from "./index";

export type ProxmoxSyncSummary = {
  created: number;
  updated: number;
  unchanged: number;
  found: number;
  errors: string[];
};

function isWindowsOs(ostype?: string): boolean {
  return (ostype ?? "").startsWith("win");
}

function buildConsoleUrl(apiUrl: string, node: string, vmid: number, type: "kvm" | "lxc"): string {
  const base = apiUrl.replace(/\/$/, "");
  return `${base}/?console=${type}&vmid=${vmid}&node=${node}&resize=scale`;
}

export async function runProxmoxSync(
  organizationId: string,
  config: ProxmoxConfig
): Promise<ProxmoxSyncSummary> {
  const summary: ProxmoxSyncSummary = { created: 0, updated: 0, unchanged: 0, found: 0, errors: [] };

  const client = new ProxmoxClient(config.apiUrl, config.tokenId, config.tokenSecret, config.verifySsl);

  let nodes;
  try {
    nodes = await client.getNodes();
  } catch (err) {
    summary.errors.push(`Nodes laden fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    return summary;
  }

  for (const node of nodes) {
    const nodeMapping = config.nodes.find((n) => n.name === node.node);
    const customerId = nodeMapping?.customerId ?? null;
    const groupId = nodeMapping?.groupId ?? null;

    if (config.importQemu) {
      let vms: ProxmoxVM[];
      try {
        vms = await client.getVMs(node.node);
        summary.found += vms.length;
        if (vms.length === 0) {
          summary.errors.push(`Node "${node.node}": Keine VMs gefunden (leer oder keine Berechtigung)`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`VMs auf Node "${node.node}": ${msg}${msg.includes("403") ? " — Token benötigt VM.Audit-Berechtigung auf /vms" : ""}`);
        vms = [];
      }

      for (const vm of vms) {
        try {
          await upsertDevice({
            organizationId,
            client,
            config,
            node: node.node,
            vmid: vm.vmid,
            name: vm.name ?? `VM ${vm.vmid}`,
            type: "qemu",
            ostype: vm.ostype,
            customerId,
            groupId,
            summary,
          });
        } catch (err) {
          summary.errors.push(
            `VM ${vm.vmid} ("${vm.name ?? vm.vmid}") auf Node "${node.node}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    if (config.importLxc) {
      let containers: ProxmoxContainer[];
      try {
        containers = await client.getContainers(node.node);
        summary.found += containers.length;
        if (containers.length === 0) {
          summary.errors.push(`Node "${node.node}": Keine Container gefunden (leer oder keine Berechtigung)`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`Container auf Node "${node.node}": ${msg}${msg.includes("403") ? " — Token benötigt VM.Audit-Berechtigung auf /vms" : ""}`);
        containers = [];
      }

      for (const ct of containers) {
        try {
          await upsertDevice({
            organizationId,
            client,
            config,
            node: node.node,
            vmid: ct.vmid,
            name: ct.name ?? `CT ${ct.vmid}`,
            type: "lxc",
            ostype: ct.ostype,
            customerId,
            groupId,
            summary,
          });
        } catch (err) {
          summary.errors.push(
            `Container ${ct.vmid} ("${ct.name ?? ct.vmid}") auf Node "${node.node}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    if (config.importNodes) {
      try {
        await upsertNodeDevice({
          organizationId,
          config,
          nodeName: node.node,
          customerId,
          groupId,
          summary,
        });
      } catch (err) {
        summary.errors.push(
          `Node "${node.node}": ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  return summary;
}

async function upsertDevice({
  organizationId,
  client,
  config,
  node,
  vmid,
  name,
  type,
  ostype,
  customerId,
  groupId,
  summary,
}: {
  organizationId: string;
  client: ProxmoxClient;
  config: ProxmoxConfig;
  node: string;
  vmid: number;
  name: string;
  type: "qemu" | "lxc";
  ostype?: string;
  customerId: string | null;
  groupId: string | null;
  summary: ProxmoxSyncSummary;
}) {
  const vmidTag = `proxmox-vmid:${vmid}`;
  const tags = ["proxmox", vmidTag, `node:${node}`, `type:${type}`];

  const ipAddress =
    type === "qemu"
      ? await client.getVMIp(node, vmid)
      : await client.getContainerIp(node, vmid);

  const consoleUrl = buildConsoleUrl(config.apiUrl, node, vmid, type === "qemu" ? "kvm" : "lxc");
  const isWindows = isWindowsOs(ostype);

  const existing = await prisma.device.findFirst({
    where: {
      organizationId,
      tags: { has: vmidTag },
    },
    select: { id: true, remoteIds: { select: { id: true, type: true } } },
  });

  if (existing) {
    await prisma.device.update({
      where: { id: existing.id },
      data: {
        name,
        ipAddress: ipAddress ?? undefined,
        tags,
        ...(customerId !== null ? { customerId } : {}),
        ...(groupId !== null ? { groupId } : {}),
      },
    });

    await prisma.remoteId.deleteMany({
      where: {
        deviceId: existing.id,
        type: { in: ["ssh", "rdp", "vnc", "proxmox_console"] },
      },
    });

    await prisma.remoteId.createMany({
      data: buildRemoteIds(existing.id, config, ipAddress, consoleUrl, isWindows),
    });

    summary.updated++;
  } else {
    const device = await prisma.device.create({
      data: {
        organizationId,
        name,
        ipAddress: ipAddress ?? null,
        tags,
        customerId: customerId ?? null,
        groupId: groupId ?? null,
      },
      select: { id: true },
    });

    await prisma.remoteId.createMany({
      data: buildRemoteIds(device.id, config, ipAddress, consoleUrl, isWindows),
    });

    summary.created++;
  }
}

async function upsertNodeDevice({
  organizationId,
  config,
  nodeName,
  customerId,
  groupId,
  summary,
}: {
  organizationId: string;
  config: ProxmoxConfig;
  nodeName: string;
  customerId: string | null;
  groupId: string | null;
  summary: ProxmoxSyncSummary;
}) {
  const nodeTag = `proxmox-node:${nodeName}`;
  const tags = ["proxmox", nodeTag, "type:node"];

  const apiHost = new URL(config.apiUrl).hostname;

  const existing = await prisma.device.findFirst({
    where: { organizationId, tags: { has: nodeTag } },
    select: { id: true },
  });

  if (existing) {
    await prisma.device.update({
      where: { id: existing.id },
      data: {
        tags,
        ...(customerId !== null ? { customerId } : {}),
        ...(groupId !== null ? { groupId } : {}),
      },
    });

    await prisma.remoteId.deleteMany({
      where: { deviceId: existing.id, type: { in: ["ssh", "proxmox_console"] } },
    });

    await prisma.remoteId.createMany({
      data: [
        { deviceId: existing.id, type: "ssh", remoteId: apiHost, sshUser: config.sshUser },
        { deviceId: existing.id, type: "proxmox_console", remoteId: config.apiUrl.replace(/\/$/, ""), label: "Proxmox Web UI" },
      ],
    });

    summary.updated++;
  } else {
    const device = await prisma.device.create({
      data: {
        organizationId,
        name: `Proxmox Node: ${nodeName}`,
        ipAddress: apiHost,
        tags,
        customerId: customerId ?? null,
        groupId: groupId ?? null,
      },
      select: { id: true },
    });

    await prisma.remoteId.createMany({
      data: [
        { deviceId: device.id, type: "ssh", remoteId: apiHost, sshUser: config.sshUser },
        { deviceId: device.id, type: "proxmox_console", remoteId: config.apiUrl.replace(/\/$/, ""), label: "Proxmox Web UI" },
      ],
    });

    summary.created++;
  }
}

type RemoteIdRow = {
  deviceId: string;
  type: string;
  remoteId: string;
  label?: string | null;
  sshUser?: string | null;
  sshPrivateKeyEnc?: string | null;
};

function buildRemoteIds(
  deviceId: string,
  config: ProxmoxConfig,
  ipAddress: string | null,
  consoleUrl: string,
  isWindows: boolean
): RemoteIdRow[] {
  const remoteIds: RemoteIdRow[] = [];

  if (config.importConsole) {
    remoteIds.push({ deviceId, type: "proxmox_console", remoteId: consoleUrl, label: "Proxmox Konsole" });
  }

  if (ipAddress) {
    if (isWindows) {
      remoteIds.push({ deviceId, type: "rdp", remoteId: ipAddress });
    } else {
      if (config.importSsh) {
        const sshRow: RemoteIdRow = { deviceId, type: "ssh", remoteId: ipAddress, sshUser: config.sshUser };
        if (config.sshPrivateKey) sshRow.sshPrivateKeyEnc = encrypt(config.sshPrivateKey);
        remoteIds.push(sshRow);
      }
      if (config.importVnc) {
        remoteIds.push({ deviceId, type: "vnc", remoteId: `${ipAddress}:5900` });
      }
    }
  }

  return remoteIds;
}
