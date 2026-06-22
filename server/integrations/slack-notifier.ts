/**
 * Slack notifier for the API Command Center morning digest.
 *
 * Runs inside the deployed server, so it posts using the app's own credentials,
 * checked in this order:
 *   1. SLACK_BOT_TOKEN + SLACK_USAGE_CHANNEL  → chat.postMessage
 *   2. SLACK_WEBHOOK_URL                       → Incoming Webhook
 *
 * The scheduler composes one combined message covering every provider; this
 * module builds each provider's section and handles delivery.
 */

import type { ApiUsageSnapshot } from "@shared/schema";

export function isSlackConfigured(): boolean {
  return Boolean(
    (process.env.SLACK_BOT_TOKEN && process.env.SLACK_USAGE_CHANNEL) || process.env.SLACK_WEBHOOK_URL,
  );
}

function fmtUsd(value: number): string {
  return `$${(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(value: number): string {
  return (value || 0).toLocaleString("en-US");
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export interface ProviderDigestInput {
  label: string;
  day: ApiUsageSnapshot;
  hasCost: boolean;
  rolling30Cost: number;
  rolling30Units: number;
}

/** Build one provider's section of the digest. */
export function buildProviderSection({ label, day, hasCost, rolling30Cost, rolling30Units }: ProviderDigestInput): string {
  const lines = [`*${label} — ${day.usageDate}*`];
  if (hasCost) {
    lines.push(`• Spend: *${fmtUsd(Number(day.costUsd))}*  (30-day: ${fmtUsd(rolling30Cost)})`);
  }
  lines.push(`• ${capitalize(day.unitLabel)}: ${fmtNum(day.units)}  (30-day: ${fmtNum(rolling30Units)})`);
  if (day.numRequests) lines.push(`• Requests: ${fmtNum(day.numRequests)}`);

  const top = (day.byModel as Array<{ model: string; units: number }> | null) || [];
  const modelLine = top
    .slice(0, 3)
    .map((m) => `${m.model} (${fmtNum(m.units)})`)
    .join(", ");
  if (modelLine) lines.push(`• Top: ${modelLine}`);

  return lines.join("\n");
}

export interface SlackSendResult {
  sent: boolean;
  reason?: string;
}

/** Post a message to Slack. Never throws — returns a result describing the outcome. */
export async function postSlackMessage(text: string): Promise<SlackSendResult> {
  if (!isSlackConfigured()) {
    return { sent: false, reason: "not_configured" };
  }

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
