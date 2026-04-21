export interface ProxmoxNode {
  node: string;
  status: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  uptime?: number;
}

export interface ProxmoxVM {
  vmid: number;
  name?: string;
  status: "running" | "stopped" | "paused";
  ostype?: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  uptime?: number;
  node?: string;
}

export interface ProxmoxContainer {
  vmid: number;
  name?: string;
  status: "running" | "stopped";
  ostype?: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  uptime?: number;
  node?: string;
}

export interface ProxmoxNetworkInterface {
  name: string;
  "ip-addresses"?: Array<{
    "ip-address": string;
    "ip-address-type": "ipv4" | "ipv6";
  }>;
}

export interface ProxmoxAgentNetworkResult {
  result?: ProxmoxNetworkInterface[];
}

export interface ProxmoxLxcInterface {
  name: string;
  inet?: string;
  inet6?: string;
}

export interface ProxmoxVncTicket {
  ticket: string;
  port: string | number;
  cert?: string;
  upid?: string;
}

export interface ProxmoxApiResponse<T> {
  data: T;
}
