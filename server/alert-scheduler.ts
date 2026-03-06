/**
 * Alert Scheduler
 *
 * Manages automatic expiration alert checking on a configurable cron schedule.
 * Uses node-cron for in-process scheduling.
 */

import * as cron from "node-cron";
import type { IStorage } from "./storage";
import type { AlertSchedule, PlatformAttributeDefinition } from "@shared/schema";

export class AlertScheduler {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private storage: IStorage;
  private isRunning = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async initialize(): Promise<void> {
    const schedule = await this.storage.getAlertSchedule();
    if (schedule?.enabled && cron.validate(schedule.cronExpression)) {
      this.start(schedule.cronExpression);
      console.log(`[AlertScheduler] Automatic alert checking enabled: ${schedule.cronExpression}`);
    } else {
      console.log("[AlertScheduler] Automatic alert checking is disabled or not configured");
    }
  }

  reload(schedule: AlertSchedule): void {
    this.stop();
    if (schedule.enabled && cron.validate(schedule.cronExpression)) {
      this.start(schedule.cronExpression);
      console.log(`[AlertScheduler] Schedule reloaded: ${schedule.cronExpression}`);
    } else {
      console.log("[AlertScheduler] Alert schedule disabled");
    }
  }

  start(cronExpression: string): void {
    this.stop();
    this.task = cron.schedule(cronExpression, () => {
      this.executeAlertCheck();
    });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  private async executeAlertCheck(): Promise<void> {
    if (this.isRunning) {
      console.log("[AlertScheduler] Skipping — previous check still running");
      return;
    }

    this.isRunning = true;
    console.log("[AlertScheduler] Starting expiration alert check...");

    try {
      const allPlatforms = await this.storage.getAllPlatforms();
      const allAlerts = await this.storage.getAllExpirationAlerts();
      const attrDefs = await this.storage.getAllAttributeDefinitions();
      const contractAttr = attrDefs.find((a: PlatformAttributeDefinition) => a.name === "Contract Expiration Date");

      if (!contractAttr) {
        console.log("[AlertScheduler] No 'Contract Expiration Date' attribute defined");
        return;
      }

      let notified = 0;
      const now = new Date();

      for (const platform of allPlatforms) {
        const dynAttrs = (platform.dynamicAttributes || {}) as Record<string, any>;
        const expiryDate = dynAttrs["Contract Expiration Date"];
        if (!expiryDate) continue;

        const expiry = new Date(expiryDate);
        if (isNaN(expiry.getTime())) continue;

        const alertConfig = allAlerts.find(a => a.platformId === platform.id);
        const daysBefore = alertConfig?.alertDaysBefore || 30;

        const alertDate = new Date(expiry);
        alertDate.setDate(alertDate.getDate() - daysBefore);

        if (now >= alertDate && now < expiry) {
          if (alertConfig?.alertSent) continue;

          const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`[AlertScheduler] Alert triggered for "${platform.toolName}" — ${daysUntilExpiry} day(s) remaining`);

          if (alertConfig) {
            await this.storage.updateExpirationAlert(alertConfig.id, { alertSent: true, alertSentAt: new Date() });
          }
          notified++;
        }
      }

      await this.storage.upsertAlertSchedule({ lastRunAt: new Date() });
      console.log(`[AlertScheduler] Check complete: ${notified} alert(s) triggered, ${allPlatforms.length} platform(s) checked`);
    } catch (err: any) {
      console.error("[AlertScheduler] Check failed:", err.message);
    } finally {
      this.isRunning = false;
    }
  }
}
