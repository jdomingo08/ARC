/**
 * API Usage Scheduler
 *
 * Runs the daily usage sync for every configured provider on a configurable
 * cron schedule (default 6 AM UTC) and posts one combined Slack morning digest.
 * Mirrors the existing RiskScheduler / AlertScheduler patterns.
 */

import * as cron from "node-cron";
import type { IStorage } from "../storage";
import type { ApiUsageSchedule } from "@shared/schema";
import { runProviderSync, rollingUsage } from "./usage-service";
import { listProviderKeys, getProviderMeta } from "./registry";
import { isSlackConfigured, postSlackMessage, buildProviderSection } from "./slack-notifier";

export class UsageScheduler {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private storage: IStorage;
  private isRunning = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async initialize(): Promise<void> {
    const schedule = await this.storage.getUsageSchedule();
    if (schedule?.enabled && cron.validate(schedule.cronExpression)) {
      this.start(schedule.cronExpression);
      console.log(`[UsageScheduler] Automatic usage sync enabled: ${schedule.cronExpression}`);
    } else {
      console.log("[UsageScheduler] Automatic usage sync is disabled or not configured");
    }
  }

  reload(schedule: ApiUsageSchedule): void {
    this.stop();
    if (schedule.enabled && cron.validate(schedule.cronExpression)) {
      this.start(schedule.cronExpression);
      console.log(`[UsageScheduler] Schedule reloaded: ${schedule.cronExpression}`);
    } else {
      console.log("[UsageScheduler] Usage sync schedule disabled");
    }
  }

  start(cronExpression: string): void {
    this.stop();
    this.task = cron.schedule(cronExpression, () => {
      this.executeScheduledSync();
    });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  private async executeScheduledSync(): Promise<void> {
    if (this.isRunning) {
      console.log("[UsageScheduler] Skipping — previous sync still running");
      return;
    }

    this.isRunning = true;
    console.log("[UsageScheduler] Starting scheduled usage sync...");

    try {
      const schedule = await this.storage.getUsageSchedule();
      const lookbackDays = schedule?.lookbackDays ?? 3;
      const sendSlackDigest = schedule?.slackDigestEnabled ?? true;

      const endDate = new Date();
      endDate.setUTCDate(endDate.getUTCDate() + 1); // exclusive of tomorrow → include today (partial)
      const startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - lookbackDays);

      const sections: string[] = [];
      let anySynced = false;

      for (const key of listProviderKeys()) {
        const meta = getProviderMeta(key)!;
        const client = meta.create();
        if (!client.isConfigured()) continue;

        try {
          const result = await runProviderSync(this.storage, key, { startDate, endDate, trigger: "scheduled" });
          anySynced = true;
          console.log(`[UsageScheduler] ${meta.label}: ${result.summary}`);

          if (sendSlackDigest && result.headline) {
            const rolling = await rollingUsage(this.storage, key, 30);
            sections.push(
              buildProviderSection({
                label: meta.label,
                day: result.headline,
                hasCost: meta.hasCost,
                rolling30Cost: rolling.costUsd,
                rolling30Units: rolling.units,
              }),
            );
          }
        } catch (err: any) {
          console.error(`[UsageScheduler] ${meta.label} sync failed:`, err.message);
        }
      }

      let digestNote = "";
      if (sendSlackDigest && isSlackConfigured() && sections.length > 0) {
        const base = process.env.APP_BASE_URL || process.env.PUBLIC_URL;
        const text = [
          "*API Command Center — morning digest*",
          ...sections,
          base ? `<${base.replace(/\/$/, "")}/integrations|Open the dashboard →>` : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        const r = await postSlackMessage(text);
        digestNote = ` · Slack digest ${r.sent ? "sent" : `skipped (${r.reason})`}`;
      }

      await this.storage.upsertUsageSchedule({
        lastRunAt: new Date(),
        lastRunStatus: anySynced ? "completed" : "skipped (no providers configured)",
        lastRunError: null,
      });

      console.log(`[UsageScheduler] Scheduled sync complete${digestNote}`);
    } catch (err: any) {
      await this.storage
        .upsertUsageSchedule({ lastRunAt: new Date(), lastRunStatus: "failed", lastRunError: err.message })
        .catch(() => {});
      console.error("[UsageScheduler] Scheduled sync failed:", err.message);
    } finally {
      this.isRunning = false;
    }
  }
}
