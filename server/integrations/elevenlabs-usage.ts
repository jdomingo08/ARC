/**
 * ElevenLabs usage client.
 *
 * Pulls usage from ElevenLabs' API:
 *   - GET /v1/usage/character-stats  (characters/credits over time, optional model breakdown)
 *   - GET /v1/user/subscription      (current plan quota: used / limit / reset / tier)
 *
 * Auth uses the `xi-api-key` header with ELEVENLABS_API_KEY. ElevenLabs reports
 * usage in characters/credits (not USD), so cost fields are left at zero and the
 * dashboard surfaces credit usage + plan quota instead of dollar spend.
 *
 * Docs: https://elevenlabs.io/docs/api-reference/usage/get
 */

import type { NormalizedDailyUsage, ProviderQuota } from "@shared/schema";

const BASE = "https://api.elevenlabs.io";
const USAGE_URL = `${BASE}/v1/usage/character-stats`;
const SUBSCRIPTION_URL = `${BASE}/v1/user/subscription`;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDayFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Start-of-day (UTC) in milliseconds for a given date. */
function startOfUtcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

interface CharacterStats {
  time?: number[]; // unix ms, one per interval
  usage?: Record<string, number[]>; // breakdown key -> values aligned to `time`
}

export class ElevenLabsUsageClient {
  readonly provider = "elevenlabs";
  private apiKey: string | undefined;

  constructor(apiKey: string | undefined = process.env.ELEVENLABS_API_KEY) {
    this.apiKey = apiKey?.trim() || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private headers(): Record<string, string> {
    return { "xi-api-key": this.apiKey as string, "Content-Type": "application/json" };
  }

  async testConnection(): Promise<{ ok: boolean; status?: number; message: string }> {
    if (!this.apiKey) {
      return { ok: false, message: "ELEVENLABS_API_KEY is not set. Add your ElevenLabs API key and restart." };
    }
    try {
      const res = await fetch(SUBSCRIPTION_URL, { headers: this.headers() });
      if (res.ok) {
        return { ok: true, status: res.status, message: "Connected to the ElevenLabs API successfully." };
      }
      const body = await res.text().catch(() => "");
      let detail = body.slice(0, 300);
      try {
        const parsed = JSON.parse(body);
        detail = parsed?.detail?.message || (typeof parsed?.detail === "string" ? parsed.detail : detail);
      } catch {
        /* keep raw body */
      }
      const hint = res.status === 401 ? " — the API key is invalid or lacks permissions." : "";
      return { ok: false, status: res.status, message: `ElevenLabs returned ${res.status} ${res.statusText}: ${detail}${hint}` };
    } catch (err: any) {
      return { ok: false, message: `Request failed: ${err?.message || "unknown error"}` };
    }
  }

  private async fetchStats(startMs: number, endMs: number, breakdown: boolean): Promise<CharacterStats> {
    const qs = new URLSearchParams({
      start_unix: String(startMs),
      end_unix: String(endMs),
      aggregation_interval: "day",
    });
    if (breakdown) qs.set("breakdown_type", "model");

    const res = await fetch(`${USAGE_URL}?${qs.toString()}`, { headers: this.headers() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ElevenLabs usage request failed (${res.status} ${res.statusText}): ${body.slice(0, 300)}`);
    }
    return (await res.json()) as CharacterStats;
  }

  async fetchDailyUsage(startDate: Date, endDate: Date): Promise<NormalizedDailyUsage[]> {
    if (!this.apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");

    const startMs = startOfUtcDayMs(startDate);
    // end_unix is inclusive; clamp to now so a partial current day is included.
    const endMs = Math.min(startOfUtcDayMs(endDate) + (MS_PER_DAY - 1000), Date.now());

    let data: CharacterStats;
    try {
      data = await this.fetchStats(startMs, endMs, true);
    } catch {
      // Some keys can't request a model breakdown; fall back to the total series.
      data = await this.fetchStats(startMs, endMs, false);
    }

    const time = Array.isArray(data.time) ? data.time : [];
    const usage = data.usage || {};
    const keys = Object.keys(usage);

    const result: NormalizedDailyUsage[] = [];
    for (let i = 0; i < time.length; i++) {
      const usageDate = toUtcDayFromMs(time[i]);
      let total = 0;
      const byModel: NormalizedDailyUsage["byModel"] = [];
      for (const k of keys) {
        const v = Number(usage[k]?.[i] || 0);
        if (v <= 0) continue;
        total += v;
        byModel.push({ model: k === "All" ? "All models" : k, units: v, inputTokens: 0, outputTokens: 0, numRequests: 0 });
      }
      byModel.sort((a, b) => b.units - a.units);
      result.push({
        usageDate,
        units: Math.round(total),
        unitLabel: "characters",
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        totalTokens: 0,
        numRequests: 0,
        costUsd: 0,
        currency: "usd",
        byModel,
        byLineItem: [],
        byProject: [],
      });
    }

    return result.sort((a, b) => a.usageDate.localeCompare(b.usageDate));
  }

  async getQuota(): Promise<ProviderQuota | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(SUBSCRIPTION_URL, { headers: this.headers() });
      if (!res.ok) return null;
      const sub: any = await res.json();
      return {
        tier: sub.tier ?? null,
        used: Number(sub.character_count || 0),
        limit: sub.character_limit != null ? Number(sub.character_limit) : null,
        unitLabel: "characters",
        resetAt: sub.next_character_count_reset_unix
          ? new Date(Number(sub.next_character_count_reset_unix) * 1000).toISOString()
          : null,
      };
    } catch {
      return null;
    }
  }
}
