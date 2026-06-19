/**
 * Slack notifier for the API Command Center morning digest.
 *
 * This runs inside the deployed server (not via any IDE/assistant tooling), so
 * it posts to Slack using the app's own credentials. Two options are supported,
 * checked in this order:
 *
 *   1. SLACK_BOT_TOKEN + SLACK_USAGE_CHANNEL  → chat.postMessage (richer, can target a channel)
 *   2. SLACK_WEBHOOK_URL                       → Incoming Webhook (simplest)
 *
 * When neither is configured the digest is skipped gracefully.
 */

import type { ApiUsageSnapshot } from "@shared/schema";

export function isSlackConfigured(): boolean {
  return Boolean(
    (process.env.SLACK_BOT_TOKEN && process.env.SLACK_USAGE_CHANNEL) || process.env.SLACK_WEBHOOK_URL,
  );
}

function fmtUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(value: number): string {
  return value.toLocaleString("en-US");
}

interface DigestInput {
  /** The headline day (usually yesterday). */
  day: ApiUsageSnapshot;
  /** Rolling 30-day spend total, for context. */
  thirtyDayCostUsd: number;
  dashboardUrl?: string;
}

/** Build the human-readable digest text shared by both delivery paths. */
export function buildDigestText({ day, thirtyDayCostUsd, dashboardUrl }: DigestInput): string {
  const cost = Number(day.costUsd);
  const topModels = (day.byModel as Array<{ model: string; inputTokens: number; outputTokens: number }> | null) || [];
  const modelLine = topModels
    .slice(0, 3)
    .map((m) => `${m.model} (${fmtNum(m.inputTokens + m.outputTokens)} tok)`)
    .join(", ");

  const lines = [
    `*OpenAI usage — ${day.usageDate}*`,
    `• Spend: *${fmtUsd(cost)}*  (30-day: ${fmtUsd(thirtyDayCostUsd)})`,
    `• Tokens: ${fmtNum(day.totalTokens)} (${fmtNum(day.inputTokens)} in / ${fmtNum(day.outputTokens)} out)`,
    `• Requests: ${fmtNum(day.numRequests)}`,
  ];
  if (modelLine) lines.push(`• Top models: ${modelLine}`);
  if (dashboardUrl) lines.push(`<${dashboardUrl}|Open the API Command Center →>`);
  return lines.join("\n");
}

export interface SlackSendResult {
  sent: boolean;
  reason?: string;
}

/**
 * Post the morning digest to Slack. Never throws — returns a result describing
 * what happened so callers can record it without failing the sync.
 */
export async function postSlackUsageDigest(input: DigestInput): Promise<SlackSendResult> {
  if (!isSlackConfigured()) {
    return { sent: false, reason: "not_configured" };
  }

  const text = buildDigestText(input);

  try {
    const botToken = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_USAGE_CHANNEL;

    if (botToken && channel) {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ channel, text, unfurl_links: false }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        return { sent: false, reason: `slack_api_error:${body.error || res.status}` };
      }
      return { sent: true };
    }

    const webhook = process.env.SLACK_WEBHOOK_URL!;
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      return { sent: false, reason: `webhook_error:${res.status}` };
    }
    return { sent: true };
  } catch (err: any) {
    return { sent: false, reason: `exception:${err?.message || "unknown"}` };
  }
}
