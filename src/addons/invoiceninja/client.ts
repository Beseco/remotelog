export type INContact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
};

export type INClient = {
  id: string;
  name: string;
  number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address1: string | null;
  city: string | null;
  postal_code: string | null;
  contacts: INContact[];
};

export type INInvoice = {
  id: string;
  number: string;
  amount: number;
  balance: number;
  status_id: number;
  date: string;
  due_date: string | null;
};

export type INTask = {
  id: string;
  description: string;
  client_id: string;
  project_id: string | null;
};

export type INProject = {
  id: string;
  name: string;
  client_id: string;
  task_rate: number;
  due_date: string | null;
  budgeted_hours: number;
  is_deleted: boolean;
};

export type INProjectInput = {
  name: string;
  client_id: string;
  task_rate?: number;
  due_date?: string | null;
  budgeted_hours?: number;
};

type INListResponse<T> = {
  data: T[];
  meta: {
    pagination: {
      total: number;
      total_pages: number;
      current_page: number;
      per_page: number;
    };
  };
};

export type INClientInput = {
  name: string;
  number?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address1?: string | null;
  city?: string | null;
  postal_code?: string | null;
  contacts?: Array<{
    id?: string;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
  }>;
};

export class InvoiceNinjaClient {
  constructor(
    private baseUrl: string,
    private apiToken: string
  ) {}

  private get headers() {
    return {
      "X-API-TOKEN": this.apiToken,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json",
    };
  }

  private apiUrl(path: string) {
    return `${this.baseUrl.replace(/\/$/, "")}/api/v1${path}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.apiUrl(path), {
      ...init,
      headers: { ...this.headers, ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Invoice Ninja API Fehler ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  async listClients(page = 1, perPage = 100): Promise<INListResponse<INClient>> {
    return this.request<INListResponse<INClient>>(
      `/clients?per_page=${perPage}&page=${page}&is_deleted=false`
    );
  }

  async createClient(data: INClientInput): Promise<INClient> {
    const res = await this.request<{ data: INClient }>("/clients", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateClient(id: string, data: INClientInput): Promise<INClient> {
    const res = await this.request<{ data: INClient }>(`/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async listInvoices(clientId: string, perPage = 10): Promise<INInvoice[]> {
    const res = await this.request<INListResponse<INInvoice>>(
      `/invoices?client_id=${clientId}&per_page=${perPage}&sort=date%7Cdesc&is_deleted=false`
    );
    return res.data;
  }

  async createTask(data: {
    client_id: string;
    description: string;
    time_log: string;
    project_id?: string;
  }): Promise<INTask> {
    const res = await this.request<{ data: INTask }>("/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async listProjects(page = 1, perPage = 100): Promise<INListResponse<INProject>> {
    return this.request<INListResponse<INProject>>(
      `/projects?per_page=${perPage}&page=${page}&is_deleted=false`
    );
  }

  async createProject(data: INProjectInput): Promise<INProject> {
    const res = await this.request<{ data: INProject }>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateProject(id: string, data: INProjectInput): Promise<INProject> {
    const res = await this.request<{ data: INProject }>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async testConnection(): Promise<number> {
    const res = await this.listClients(1, 1);
    return res.meta.pagination.total;
  }
}
