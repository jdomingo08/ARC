/**
 * Usage sync orchestration for the API Command Center.
 *
 * Provider-agnostic: resolves a client from the registry, fetches normalized
 * daily usage, upserts snapshots, and records a sync-log audit entry. The Slack
 * digest is composed by the scheduler (so it can summarize all providers in one
 * message), not here.
 */

import type { IStorage } from "../storage";
import type { ApiUsageSnapshot } from "@shared/schema";
import { getProviderMeta } from "./registry";

function todayUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SyncOptions {
  startDate: Date;
  endDate: Date;
  trigger: "manual" | "scheduled";
  initiatedBy?: string | null;
}

export interface SyncResult {
  provider: string;
  daysFetched: number;
  costUsd: number;
  totalUnits: number;
  unitLabel: string;
  summary: string;
  /** Most recent fully-completed day (before today) — used for the digest. */
  headline: ApiUsageSnapshot | null;
  snapshots: ApiUsageSnapshot[];
}

/**
 * Fetch a provider's usage for the given range, upsert daily snapshots, and
 * record a sync log. Throws on hard failures after logging them.
 */
export async function runProviderSync(storage: IStorage, providerKey: string, opts: SyncOptions): Promise<SyncResult> {
  const meta = getProviderMeta(providerKey);
  if (!meta) throw new Error(`Unknown provider: ${providerKey}`);

  const log = await storage.createApiSyncLog({
    provider: providerKey,
    trigger: opts.trigger,
    status: "running",
    rangeStart: opts.startDate.toISOString().slice(0, 10),
    rangeEnd: opts.endDate.toISOString().slice(0, 10),
    initiatedBy: opts.initiatedBy ?? null,
  });

  try {
    const client = meta.create();
    if (!client.isConfigured()) {
      throw new Error(`${meta.envVar} is not configured`);
    }

    const normalized = await client.fetchDailyUsage(opts.startDate, opts.endDate);

    const saved: ApiUsageSnapshot[] = [];
    for (const day of normalized) {
      const snapshot = await storage.upsertUsageSnapshot({
        provider: providerKey,
        usageDate: day.usageDate,
        units: day.units,
        unitLabel: day.unitLabel,
        inputTokens: day.inputTokens,
        outputTokens: day.outputTokens,
        cachedInputTokens: day.cachedInputTokens,
        totalTokens: day.totalTokens,
        numRequests: day.numRequests,
        costUsd: String(day.costUsd),
        currency: day.currency,
        byModel: day.byModel,
        byLineItem: day.byLineItem,
        byProject: day.byProject,
        fetchedAt: new Date(),
      });
      saved.push(snapshot);
    }

    const costUsd = normalized.reduce((s, d) => s + d.costUsd, 0);
    const totalUnits = normalized.reduce((s, d) => s + d.units, 0);
    const today = todayUtcDay();
    const headline =
      saved.filter((s) => s.usageDate < today).sort((a, b) => b.usageDate.localeCompare(a.usageDate))[0] ?? null;

    const summary = meta.hasCost
      ? `Synced ${normalized.length} day(s) · $${costUsd.toFixed(2)} · ${totalUnits.toLocaleString("en-US")} ${meta.unitLabel}`
      : `Synced ${normalized.length} day(s) · ${totalUnits.toLocaleString("en-US")} ${meta.unitLabel}`;

    await storage.updateApiSyncLog(log.id, { status: "completed", daysFetched: normalized.length, summary });

    return { provider: providerKey, daysFetched: normalized.length, costUsd, totalUnits, unitLabel: meta.unitLabel, summary, headline, snapshots: saved };
  } catch (err: any) {
    await storage.updateApiSyncLog(log.id, { status: "failed", error: err?.message || "Unknown error" });
    throw err;
  }
}

/** Rolling cost + unit totals for a provider over the last `days` days. */
export async function rollingUsage(storage: IStorage, providerKey: string, days: number): Promise<{ costUsd: number; units: number }> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const recent = await storage.getUsageSnapshots(providerKey, { startDate: since.toISOString().slice(0, 10) });
  return {
    costUsd: recent.reduce((s, r) => s + Number(r.costUsd), 0),
    units: recent.reduce((s, r) => s + r.units, 0),
  };
}
