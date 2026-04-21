export type ZammadOrg = {
  id: number;
  name: string;
  active: boolean;
  member_ids: number[];
};

export type ZammadUser = {
  id: number;
  firstname: string;
  lastname: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
};

export type ZammadTicket = {
  id: number;
  number: string;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
};

type OrgPayload = {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  note?: string;
};

export class ZammadClient {
  constructor(
    private baseUrl: string,
    private apiToken: string
  ) {}

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Token token=${this.apiToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Zammad API Fehler ${res.status} bei ${path}`);
    }
    return res.json() as Promise<T>;
  }

  private async requestMut<T>(method: "POST" | "PUT", path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Token token=${this.apiToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Zammad API Fehler ${res.status} bei ${method} ${path}`);
    }
    return res.json() as Promise<T>;
  }

  async listOrganizations(page = 1, limit = 100): Promise<ZammadOrg[]> {
    return this.request<ZammadOrg[]>(
      `/organizations?limit=${limit}&page=${page}&expand=true`
    );
  }

  async getUser(id: number): Promise<ZammadUser> {
    return this.request<ZammadUser>(`/users/${id}`);
  }

  async listTickets(orgId: number, perPage = 10): Promise<ZammadTicket[]> {
    return this.request<ZammadTicket[]>(
      `/tickets/search?query=organization_id:${orgId}&per_page=${perPage}&sort_by=created_at&order_by=desc&expand=true`
    );
  }

  async createOrganization(data: OrgPayload): Promise<ZammadOrg> {
    return this.requestMut<ZammadOrg>("POST", "/organizations", data);
  }

  async updateOrganization(id: number, data: OrgPayload): Promise<ZammadOrg> {
    return this.requestMut<ZammadOrg>("PUT", `/organizations/${id}`, data);
  }

  async *allOrganizations(): AsyncGenerator<ZammadOrg> {
    let page = 1;
    while (true) {
      const batch = await this.listOrganizations(page);
      if (batch.length === 0) break;
      yield* batch;
      if (batch.length < 100) break;
      page++;
    }
  }

  async testConnection(): Promise<number> {
    const orgs = await this.listOrganizations(1, 1);
    void orgs;
    const full = await this.listOrganizations(1, 100);
    return full.length;
  }
}
