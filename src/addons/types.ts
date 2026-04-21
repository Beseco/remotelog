import type { z } from "zod/v4";
import type { ComponentType } from "react";

export interface AddonConfigFormProps<TConfig = Record<string, unknown>> {
  config: Partial<TConfig>;
  onSave: (config: TConfig) => Promise<void>;
  isSaving: boolean;
  error: string | null;
  isPremium?: boolean;
}

export interface AddonDefinition<TConfig extends z.ZodTypeAny = z.ZodTypeAny> {
  key: string;
  name: string;
  description: string;
  isPremium: boolean;
  configSchema: TConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ConfigFormComponent: ComponentType<AddonConfigFormProps<any>>;
}

export interface AddonMeta {
  key: string;
  name: string;
  description: string;
  isPremium: boolean;
}

export interface AddonRecord {
  key: string;
  enabled: boolean;
  config: Record<string, unknown>;
}
