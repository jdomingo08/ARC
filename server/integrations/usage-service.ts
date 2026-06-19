/**
 * Usage sync orchestration for the API Command Center.
 *
 * Ties together the provider client (OpenAIUsageClient), persistence (storage),
 * a sync-log audit trail, and the optional Slack morning digest.
 */

import type { IStorage } from "../storage";
import type { ApiUsageSnapshot } from "@shared/schema";
import { OpenAIUsageClient } from "./openai-usage";
import { postSlackUsageDigest } from "./slack-notifier";

const PROVIDER = "openai";

function todayUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SyncOptions {
  startDate: Date;
  endDate: Date;
  trigger: "manual" | "scheduled";
  initiatedBy?: string | null;
  sendSlackDigest?: boolean;
}

export interface SyncResult {
  daysFetched: number;
  costUsd: number;
  totalTokens: number;
  summary: string;
  slackDigestSent: boolean;
  snapshots: ApiUsageSnapshot[];
}

/** Sum the cost of snapshots whose usageDate falls within the last `days` days. */
async function rollingCost(storage: IStorage, days: number): Promise<number> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceKey = since.toISOString().slice(0, 10);
  const recent = await storage.getUsageSnapshots(PROVIDER, { startDate: sinceKey });
  return recent.reduce((sum, s) => sum + Number(s.costUsd), 0);
}

/**
 * Fetch OpenAI usage/cost for the given range, upsert daily snapshots, and
 * (optionally) post the Slack morning digest for the most recent completed day.
 * Records a sync log either way. Throws on hard failures after logging them.
 */
export async function runOpenAiSync(storage: IStorage, opts: SyncOptions): Promise<SyncResult> {
  const { startDate, endDate, trigger, initiatedBy, sendSlackDigest } = opts;

  const log = await storage.createApiSyncLog({
    provider: PROVIDER,
    trigger,
    status: "running",
    rangeStart: startDate.toISOString().slice(0, 10),
    rangeEnd: endDate.toISOString().slice(0, 10),
    initiatedBy: initiatedBy ?? null,
  });

  try {
    const client = new OpenAIUsageClient();
    if (!client.isConfigured()) {
      throw new Error("OPENAI_ADMIN_KEY is not configured");
    }

    const normalized = await client.fetchDailyUsage(startDate, endDate);

    const saved: ApiUsageSnapshot[] = [];
    for (const day of normalized) {
      const snapshot = await storage.upsertUsageSnapshot({
        provider: PROVIDER,
        usageDate: day.usageDate,
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
    const totalTokens = normalized.reduce((s, d) => s + d.totalTokens, 0);

    // ── Slack morning digest (most recent COMPLETED day, i.e. before today) ──
    let slackDigestSent = false;
    if (sendSlackDigest) {
      const today = todayUtcDay();
      const completed = saved
        .filter((s) => s.usageDate < today)
        .sort((a, b) => b.usageDate.localeCompare(a.usageDate));
      const headline = completed[0];
      if (headline) {
        const thirtyDayCostUsd = await rollingCost(storage, 30);
        const base = process.env.APP_BASE_URL || process.env.PUBLIC_URL;
        const result = await postSlackUsageDigest({
          day: headline,
          thirtyDayCostUsd,
          dashboardUrl: base ? `${base.replace(/\/$/, "")}/integrations` : undefined,
        });
        slackDigestSent = result.sent;
        if (!result.sent && result.reason && result.reason !== "not_configured") {
          console.warn(`[UsageService] Slack digest not sent: ${result.reason}`);
        }
      }
    }

    const summary = `Synced ${normalized.length} day(s) · $${costUsd.toFixed(2)} · ${totalTokens.toLocaleString("en-US")} tokens`;

    await storage.updateApiSyncLog(log.id, {
      status: "completed",
      daysFetched: normalized.length,
      summary,
      slackDigestSent,
    });

    return { daysFetched: normalized.length, costUsd, totalTokens, summary, slackDigestSent, snapshots: saved };
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    await storage.updateApiSyncLog(log.id, { status: "failed", error: message });
    throw err;
  }
}
