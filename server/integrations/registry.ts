/**
 * Provider registry for the API Command Center.
 *
 * Each entry describes a monitored API provider and knows how to construct its
 * usage client. Routes, the sync service, and the scheduler all iterate over
 * this registry so adding a provider is a one-entry change.
 */

import type { NormalizedDailyUsage, ProviderQuota } from "@shared/schema";
import { OpenAIUsageClient } from "./openai-usage";
import { ElevenLabsUsageClient } from "./elevenlabs-usage";

export interface UsageProviderClient {
  isConfigured(): boolean;
  testConnection(): Promise<{ ok: boolean; status?: number; message: string }>;
  fetchDailyUsage(startDate: Date, endDate: Date): Promise<NormalizedDailyUsage[]>;
  /** Optional live plan/quota lookup (ElevenLabs). */
  getQuota?(): Promise<ProviderQuota | null>;
}

export interface ProviderMeta {
  key: string;
  label: string;
  hasCost: boolean; // exposes USD spend
  hasRequests: boolean; // exposes request counts
  supportsQuota: boolean; // exposes a plan quota
  unitLabel: string; // default unit label for the primary usage metric
  envVar: string; // env var holding the provider's key (for messaging)
  create: () => UsageProviderClient;
}

export const PROVIDERS: Record<string, ProviderMeta> = {
  openai: {
    key: "openai",
    label: "OpenAI",
    hasCost: true,
    hasRequests: true,
    supportsQuota: false,
    unitLabel: "tokens",
    envVar: "OPENAI_ADMIN_KEY",
    create: () => new OpenAIUsageClient(),
  },
  elevenlabs: {
    key: "elevenlabs",
    label: "ElevenLabs",
    hasCost: false,
    hasRequests: false,
    supportsQuota: true,
    unitLabel: "characters",
    envVar: "ELEVENLABS_API_KEY",
    create: () => new ElevenLabsUsageClient(),
  },
};

export function getProviderMeta(key: string): ProviderMeta | undefined {
  return PROVIDERS[key];
}

export function listProviderKeys(): string[] {
  return Object.keys(PROVIDERS);
}
