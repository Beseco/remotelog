import https from "https";
import type {
  ProxmoxApiResponse,
  ProxmoxNode,
  ProxmoxVM,
  ProxmoxContainer,
  ProxmoxAgentNetworkResult,
  ProxmoxLxcInterface,
  ProxmoxVncTicket,
} from "./types";

export class ProxmoxClient {
  private baseUrl: string;
  private apiToken: string;
  private verifySsl: boolean;

  constructor(apiUrl: string, tokenId: string, tokenSecret: string, verifySsl: boolean) {
    this.baseUrl = apiUrl.replace(/\/$/, "") + "/api2/json";
    this.apiToken = `${tokenId}=${tokenSecret}`;
    this.verifySsl = verifySsl;
  }

  private request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const bodyStr = body ? JSON.stringify(body) : undefined;

    return new Promise<T>((resolve, reject) => {
      const req = https.request(
        url,
        {
          method,
          headers: {
            Authorization: `PVEAPIToken=${this.apiToken}`,
            ...(bodyStr ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) } : {}),
          },
          rejectUnauthorized: this.verifySsl,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf-8");
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Proxmox API ${path}: ${res.statusCode} ${res.statusMessage}`));
            } else {
              const json = JSON.parse(text) as ProxmoxApiResponse<T>;
              resolve(json.data);
            }
          });
        }
      );
      req.on("error", reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async getNodes(): Promise<ProxmoxNode[]> {
    return this.get<ProxmoxNode[]>("/nodes");
  }

  async getVMs(node: string): Promise<ProxmoxVM[]> {
    const vms = await this.get<ProxmoxVM[]>(`/nodes/${node}/qemu`);
    return vms.map((vm) => ({ ...vm, node }));
  }

  async getContainers(node: string): Promise<ProxmoxContainer[]> {
    const containers = await this.get<ProxmoxContainer[]>(`/nodes/${node}/lxc`);
    return containers.map((c) => ({ ...c, node }));
  }

  async getVMIp(node: string, vmid: number): Promise<string | null> {
    try {
      const result = await this.get<ProxmoxAgentNetworkResult>(
        `/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`
      );
      for (const iface of result.result ?? []) {
        if (iface.name === "lo") continue;
        for (const addr of iface["ip-addresses"] ?? []) {
          if (addr["ip-address-type"] === "ipv4" && !addr["ip-address"].startsWith("127.")) {
            return addr["ip-address"];
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async getContainerIp(node: string, vmid: number): Promise<string | null> {
    try {
      const interfaces = await this.get<ProxmoxLxcInterface[]>(
        `/nodes/${node}/lxc/${vmid}/interfaces`
      );
      for (const iface of interfaces) {
        if (iface.name === "lo") continue;
        const inet = iface.inet;
        if (inet) {
          const ip = inet.split("/")[0];
          if (ip && !ip.startsWith("127.")) return ip;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async getVncTicket(node: string, vmid: number, type: "qemu" | "lxc"): Promise<ProxmoxVncTicket> {
    const path = `/nodes/${node}/${type}/${vmid}/vncproxy`;
    return this.request<ProxmoxVncTicket>("POST", path, { websocket: 1 });
  }

  async getAllStatuses(nodes: ProxmoxNode[]): Promise<{ vmid: number; node: string; type: "qemu" | "lxc"; status: string }[]> {
    const result: { vmid: number; node: string; type: "qemu" | "lxc"; status: string }[] = [];
    await Promise.all(
      nodes.map(async (n) => {
        try {
          const vms = await this.get<ProxmoxVM[]>(`/nodes/${n.node}/qemu`);
          for (const vm of vms) result.push({ vmid: vm.vmid, node: n.node, type: "qemu", status: vm.status });
        } catch { /* no access */ }
        try {
          const cts = await this.get<ProxmoxContainer[]>(`/nodes/${n.node}/lxc`);
          for (const ct of cts) result.push({ vmid: ct.vmid, node: n.node, type: "lxc", status: ct.status });
        } catch { /* no access */ }
      })
    );
    return result;
  }
}
