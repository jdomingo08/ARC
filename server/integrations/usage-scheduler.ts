/**
 * API Usage Scheduler
 *
 * Runs the daily OpenAI usage sync on a configurable cron schedule (default
 * 6 AM) and posts the optional Slack morning digest. Mirrors the existing
 * RiskScheduler / AlertScheduler patterns and uses node-cron for in-process
 * scheduling.
 */

import * as cron from "node-cron";
import type { IStorage } from "../storage";
import type { ApiUsageSchedule } from "@shared/schema";
import { runOpenAiSync } from "./usage-service";
import { OpenAIUsageClient } from "./openai-usage";

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
      console.log(`[UsageScheduler] Automatic OpenAI usage sync enabled: ${schedule.cronExpression}`);
    } else {
      console.log("[UsageScheduler] Automatic OpenAI usage sync is disabled or not configured");
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

    const client = new OpenAIUsageClient();
    if (!client.isConfigured()) {
      console.warn("[UsageScheduler] Cannot run scheduled sync — OPENAI_ADMIN_KEY not configured");
      return;
    }

    this.isRunning = true;
    console.log("[UsageScheduler] Starting scheduled OpenAI usage sync...");

    try {
      const schedule = await this.storage.getUsageSchedule();
      const lookbackDays = schedule?.lookbackDays ?? 3;
      const sendSlackDigest = schedule?.slackDigestEnabled ?? true;

      // Re-fetch the last `lookbackDays` days (through today) so late-arriving
      // restatements are captured; end date is exclusive of tomorrow.
      const endDate = new Date();
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - lookbackDays);

      const result = await runOpenAiSync(this.storage, {
        startDate,
        endDate,
        trigger: "scheduled",
        sendSlackDigest,
      });

      await this.storage.upsertUsageSchedule({
        lastRunAt: new Date(),
        lastRunStatus: "completed",
        lastRunError: null,
      });

      console.log(
        `[UsageScheduler] Scheduled sync complete: ${result.summary}` +
          (sendSlackDigest ? ` · Slack digest ${result.slackDigestSent ? "sent" : "skipped"}` : ""),
      );
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
