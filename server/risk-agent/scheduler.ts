/**
 * Risk Scan Scheduler
 *
 * Manages automatic risk scanning on a configurable cron schedule.
 * Uses node-cron for in-process scheduling.
 */

import * as cron from "node-cron";
import { createLLMProvider } from "../ai/provider";
import { RiskScanner } from "./scanner";
import type { IStorage } from "../storage";
import type { ScanSchedule } from "@shared/schema";

export class RiskScheduler {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private storage: IStorage;
  private isRunning = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async initialize(): Promise<void> {
    // Clean up stale "running" logs from prior server crashes
    await this.cleanupStaleRuns();

    // Load schedule from DB and start if enabled
    const schedule = await this.storage.getScanSchedule();
    if (schedule?.enabled && cron.validate(schedule.cronExpression)) {
      this.start(schedule.cronExpression);
      console.log(`[Scheduler] Automatic risk scanning enabled: ${schedule.cronExpression}`);
    } else {
      console.log("[Scheduler] Automatic risk scanning is disabled or not configured");
    }
  }

  /**
   * Reload schedule from a new configuration (e.g., after admin update via API).
   */
  reload(schedule: ScanSchedule): void {
    this.stop();
    if (schedule.enabled && cron.validate(schedule.cronExpression)) {
      this.start(schedule.cronExpression);
      console.log(`[Scheduler] Schedule reloaded: ${schedule.cronExpression}`);
    } else {
      console.log("[Scheduler] Schedule disabled");
    }
  }

  start(cronExpression: string): void {
    this.stop();
    this.task = cron.schedule(cronExpression, () => {
      this.executeScheduledScan();
    });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  private async executeScheduledScan(): Promise<void> {
    if (this.isRunning) {
      console.log("[Scheduler] Skipping scheduled scan — previous scan still running");
      return;
    }

    const llm = createLLMProvider();
    if (!llm) {
      console.warn("[Scheduler] Cannot run scheduled scan — AI provider not configured");
      return;
    }

    this.isRunning = true;
    console.log("[Scheduler] Starting scheduled risk scan...");

    try {
      const allPlatforms = await this.storage.getAllPlatforms();
      const activePlatforms = allPlatforms.filter(
        p => p.status === "approved" || p.status === "on_review"
      );

      if (activePlatforms.length === 0) {
        console.log("[Scheduler] No active platforms to scan");
        return;
      }

      const scanner = new RiskScanner(llm, this.storage);
      const log = await scanner.scanPlatforms(activePlatforms, null, "scheduled", "all");

      // Update schedule's lastRunAt
      await this.storage.upsertScanSchedule({
        lastRunAt: new Date(),
      });

      console.log(`[Scheduler] Scheduled scan complete: ${log.findingsCount} findings`);
    } catch (err: any) {
      console.error("[Scheduler] Scheduled scan failed:", err.message);
    } finally {
      this.isRunning = false;
    }
  }

  private async cleanupStaleRuns(): Promise<void> {
    try {
      const running = await this.storage.getRunningAgentLogs();
      for (const log of running) {
        await this.storage.updateAgentRunLogStatus(
          log.id,
          "failed",
          "Interrupted by server restart",
        );
        console.log(`[Scheduler] Marked stale run ${log.id} as failed`);
      }
    } catch (err: any) {
      console.error("[Scheduler] Error cleaning up stale runs:", err.message);
    }
  }
}
