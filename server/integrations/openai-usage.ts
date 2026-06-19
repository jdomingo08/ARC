/**
 * OpenAI Organization Usage & Costs client.
 *
 * Pulls org-wide consumption from OpenAI's Admin endpoints:
 *   - GET https://api.openai.com/v1/organization/usage/completions  (tokens / requests)
 *   - GET https://api.openai.com/v1/organization/costs              (USD spend)
 *
 * These require an **Organization Admin key** (sk-admin-…), which is distinct
 * from the regular OPENAI_API_KEY used for inference. It is read from the
 * OPENAI_ADMIN_KEY environment variable. When unset, the client reports itself
 * as not configured and the API Command Center degrades gracefully.
 *
 * Docs: https://platform.openai.com/docs/api-reference/usage
 */

import type { NormalizedDailyUsage } from "@shared/schema";

const USAGE_URL = "https://api.openai.com/v1/organization/usage/completions";
const COSTS_URL = "https://api.openai.com/v1/organization/costs";

const SECONDS_PER_DAY = 24 * 60 * 60;

interface OpenAIBucket {
  start_time: number;
  end_time: number;
  results: any[];
}

interface OpenAIPage {
  data?: OpenAIBucket[];
  has_more?: boolean;
  next_page?: string | null;
}

/** Convert a unix-seconds timestamp to a UTC YYYY-MM-DD day key. */
function toUtcDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** Start-of-day (UTC) unix seconds for a given date. */
function startOfUtcDay(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
}

export class OpenAIUsageClient {
  readonly provider = "openai";
  private adminKey: string | undefined;

  constructor(adminKey: string | undefined = process.env.OPENAI_ADMIN_KEY) {
    this.adminKey = adminKey?.trim() || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.adminKey);
  }

  private async fetchAllPages(url: string, baseParams: Record<string, string | string[]>): Promise<OpenAIBucket[]> {
    if (!this.adminKey) {
      throw new Error("OPENAI_ADMIN_KEY is not configured");
    }

    const buckets: OpenAIBucket[] = [];
    let page: string | undefined;
    // Safety cap on pagination to avoid an unbounded loop on unexpected responses.
    for (let i = 0; i < 200; i++) {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(baseParams)) {
        if (Array.isArray(value)) {
          for (const v of value) qs.append(key, v);
        } else {
          qs.set(key, value);
        }
      }
      if (page) qs.set("page", page);

      const res = await fetch(`${url}?${qs.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.adminKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `OpenAI usage request failed (${res.status} ${res.statusText}) for ${url}: ${body.slice(0, 300)}`,
        );
      }

      const json = (await res.json()) as OpenAIPage;
      if (Array.isArray(json.data)) buckets.push(...json.data);

      if (json.has_more && json.next_page) {
        page = json.next_page;
      } else {
        break;
      }
    }
    return buckets;
  }

  /**
   * Fetch and normalize daily usage + cost for the half-open range
   * [startDate, endDate). Returns one normalized record per UTC day that has
   * any data, sorted ascending by date.
   */
  async fetchDailyUsage(startDate: Date, endDate: Date): Promise<NormalizedDailyUsage[]> {
    const startTime = startOfUtcDay(startDate);
    // end_time is exclusive; clamp to "now" so a partial current day is included.
    const endTime = Math.min(startOfUtcDay(endDate), Math.floor(Date.now() / 1000));
    const safeEnd = Math.max(endTime, startTime + SECONDS_PER_DAY);

    const [usageBuckets, costBuckets] = await Promise.all([
      this.fetchAllPages(USAGE_URL, {
        start_time: String(startTime),
        end_time: String(safeEnd),
        bucket_width: "1d",
        group_by: ["model"],
        limit: "31",
      }),
      this.fetchAllPages(COSTS_URL, {
        start_time: String(startTime),
        end_time: String(safeEnd),
        bucket_width: "1d",
        group_by: ["line_item"],
        limit: "180",
      }),
    ]);

    const days = new Map<string, NormalizedDailyUsage>();

    const ensureDay = (key: string): NormalizedDailyUsage => {
      let day = days.get(key);
      if (!day) {
        day = {
          usageDate: key,
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          totalTokens: 0,
          numRequests: 0,
          costUsd: 0,
          currency: "usd",
          byModel: [],
          byLineItem: [],
          byProject: [],
        };
        days.set(key, day);
      }
      return day;
    };

    // ── Token usage ──────────────────────────────────────────────────────────
    for (const bucket of usageBuckets) {
      const key = toUtcDay(bucket.start_time);
      const day = ensureDay(key);
      for (const r of bucket.results || []) {
        const input = Number(r.input_tokens || 0);
        const output = Number(r.output_tokens || 0);
        const cached = Number(r.input_cached_tokens || 0);
        const requests = Number(r.num_model_requests || 0);

        day.inputTokens += input;
        day.outputTokens += output;
        day.cachedInputTokens += cached;
        day.totalTokens += input + output;
        day.numRequests += requests;

        const model = r.model || "unknown";
        const existing = day.byModel.find((m) => m.model === model);
        if (existing) {
          existing.inputTokens += input;
          existing.outputTokens += output;
          existing.numRequests += requests;
        } else {
          day.byModel.push({ model, inputTokens: input, outputTokens: output, numRequests: requests });
        }
      }
    }

    // ── Cost ─────────────────────────────────────────────────────────────────
    for (const bucket of costBuckets) {
      const key = toUtcDay(bucket.start_time);
      const day = ensureDay(key);
      for (const r of bucket.results || []) {
        const value = Number(r?.amount?.value || 0);
        if (r?.amount?.currency) day.currency = r.amount.currency;
        day.costUsd += value;

        const lineName = r.line_item || "Other";
        const li = day.byLineItem.find((l) => l.name === lineName);
        if (li) {
          li.costUsd += value;
        } else {
          day.byLineItem.push({ name: lineName, costUsd: value });
        }

        if (r.project_id) {
          const proj = day.byProject.find((p) => p.projectId === r.project_id);
          if (proj) {
            proj.costUsd += value;
          } else {
            day.byProject.push({ projectId: r.project_id, costUsd: value });
          }
        }
      }
    }

    // Round costs to cents-ish precision to avoid float noise in the UI.
    for (const day of Array.from(days.values())) {
      day.costUsd = Math.round(day.costUsd * 10000) / 10000;
      day.byModel.sort((a, b) => b.outputTokens + b.inputTokens - (a.outputTokens + a.inputTokens));
      day.byLineItem.forEach((l) => (l.costUsd = Math.round(l.costUsd * 10000) / 10000));
      day.byLineItem.sort((a, b) => b.costUsd - a.costUsd);
    }

    return Array.from(days.values()).sort((a, b) => a.usageDate.localeCompare(b.usageDate));
  }
}
