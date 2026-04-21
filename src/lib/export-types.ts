export const EXPORT_VERSION = "1" as const;

export type ExportCategory =
  | "settings"
  | "customers"
  | "groups"
  | "devices"
  | "projects"
  | "sessions"
  | "addons"
  | "users";

export const ALL_CATEGORIES: ExportCategory[] = [
  "settings",
  "customers",
  "groups",
  "devices",
  "projects",
  "sessions",
  "addons",
  "users",
];

export interface ExportSettings {
  hourlyRate: number;
  roundUpMins: number;
  prepMins: number;
  followUpMins: number;
  minMins: number;
  rustdeskIdServer: string | null;
  rustdeskRelay: string | null;
  rustdeskKey: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string | null;
}

export interface ExportContact {
  originalId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  emails: string[];
  phones: string[];
  notes: string | null;
  zammadUserId: number | null;
  invoiceNinjaId: string | null;
}

export interface ExportCustomer {
  originalId: string;
  name: string;
  notes: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  customerNumber: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  zammadOrgId: number | null;
  invoiceNinjaId: string | null;
  contacts: ExportContact[];
}

export interface ExportGroup {
  originalId: string;
  name: string;
  originalParentId: string | null;
  originalCustomerId: string | null;
  sortOrder: number;
}

export interface ExportRemoteId {
  type: string;
  remoteId: string;
  label: string | null;
  password: string | null;
  sshUser: string | null;
  sshPasswordEnc: string | null;
}

export interface ExportDevice {
  originalId: string;
  name: string;
  originalGroupId: string | null;
  originalCustomerId: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  notes: string | null;
  tags: string[];
  remoteIds: ExportRemoteId[];
}

export interface ExportProject {
  originalId: string;
  name: string;
  status: string;
  originalCustomerId: string;
  taskRate: number | null;
  dueDate: string | null;
  notes: string | null;
  budgetedHours: number | null;
  invoiceNinjaProjectId: string | null;
}

export interface ExportSessionNote {
  content: string;
  createdAt: string;
}

export interface ExportSessionInterval {
  startedAt: string;
  endedAt: string | null;
}

export interface ExportSession {
  originalId: string;
  originalDeviceId: string | null;
  originalCustomerId: string | null;
  originalProjectId: string | null;
  originalUserId: string;
  originalParentSessionId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  type: string;
  tags: string[];
  billed: boolean;
  billedAt: string | null;
  notes: ExportSessionNote[];
  intervals: ExportSessionInterval[];
}

export interface ExportAddon {
  key: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface ExportUser {
  originalId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  active: boolean;
}

export interface RemoteLogExport {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  organizationName: string;
  includes: ExportCategory[];
  settings?: ExportSettings;
  customers?: ExportCustomer[];
  groups?: ExportGroup[];
  devices?: ExportDevice[];
  projects?: ExportProject[];
  sessions?: ExportSession[];
  addons?: ExportAddon[];
  users?: ExportUser[];
}

export interface ImportSummaryEntry {
  created: number;
  updated: number;
  skipped: number;
}

export interface ImportSummary {
  settings?: ImportSummaryEntry;
  customers?: ImportSummaryEntry;
  contacts?: ImportSummaryEntry;
  groups?: ImportSummaryEntry;
  devices?: ImportSummaryEntry;
  projects?: ImportSummaryEntry;
  sessions?: ImportSummaryEntry;
  addons?: ImportSummaryEntry;
  users?: ImportSummaryEntry;
  errors: string[];
}
