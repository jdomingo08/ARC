/**
 * Risk Scanning Pipeline
 *
 * Orchestrates the per-platform risk analysis:
 * 1. Iterates over platforms
 * 2. Calls LLM with web search for each platform
 * 3. Parses and validates structured output
 * 4. Stores findings in the database
 * 5. Emits events for SSE streaming
 */

import { EventEmitter } from "events";
import { z } from "zod";
import type { LLMProvider } from "../ai/provider";
import type { IStorage } from "../storage";
import { RISK_ANALYSIS_SYSTEM_PROMPT, buildPlatformPrompt } from "./prompts";
import type { Platform, RiskFinding, AgentRunLog, InsertRiskFinding } from "@shared/schema";

// Zod schema for validating LLM risk finding response
const riskFindingResultSchema = z.object({
  classification: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string(),
  recommendedActions: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

export type ScanEvent =
  | { type: "scan-start"; totalPlatforms: number }
  | { type: "platform-start"; platformId: string; toolName: string; index: number }
  | { type: "finding"; finding: RiskFinding }
  | { type: "platform-complete"; platformId: string; index: number }
  | { type: "platform-error"; platformId: string; toolName: string; error: string }
  | { type: "complete"; log: AgentRunLog; totalFindings: number }
  | { type: "error"; message: string };

export class RiskScanner extends EventEmitter {
  private aborted = false;

  constructor(
    private llm: LLMProvider,
    private storage: IStorage,
  ) {
    super();
  }

  abort() {
    this.aborted = true;
  }

  async scanPlatforms(
    platforms: Platform[],
    initiatedBy: string | null,
    trigger: "manual" | "scheduled" = "manual",
    scope: string = "all",
  ): Promise<AgentRunLog> {
    // Create the run log upfront with "running" status
    const log = await this.storage.createAgentRunLog({
      initiatedBy,
      scope,
      prompt: scope === "all"
        ? "AI-powered sweep: search web for breaches/CVEs/security events for all active platforms"
        : `AI-powered scan: search web for breaches/CVEs/security events for ${platforms[0]?.toolName || "unknown"}`,
      platformsChecked: platforms.map(p => p.toolName),
      resultsSummary: "Scan in progress...",
      findingsCount: 0,
      status: "running",
      trigger,
    });

    this.emit("scan-start", { totalPlatforms: platforms.length });

    const findings: RiskFinding[] = [];
    let index = 0;

    try {
      for (const platform of platforms) {
        if (this.aborted) break;

        index++;
        this.emit("platform-start", {
          platformId: platform.id,
          toolName: platform.toolName,
          index,
        });

        try {
          const finding = await this.analyzePlatform(platform);
          if (finding) {
            const stored = await this.storage.createRiskFinding(finding);
            findings.push(stored);
            this.emit("finding", { finding: stored });
          }
        } catch (err: any) {
          console.error(`[RiskScanner] Error analyzing ${platform.toolName}:`, err.message);
          this.emit("platform-error", {
            platformId: platform.id,
            toolName: platform.toolName,
            error: err.message,
          });
        }

        this.emit("platform-complete", { platformId: platform.id, index });

        // Small delay between platforms to avoid rate limits
        if (index < platforms.length && !this.aborted) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const resultsSummary = `${platforms.length} platforms checked. ${findings.length} findings logged.`;
      await this.storage.updateAgentRunLogStatus(log.id, "completed", resultsSummary, findings.length);

      const completedLog = { ...log, status: "completed", resultsSummary, findingsCount: findings.length };
      this.emit("complete", { log: completedLog, totalFindings: findings.length });
      return completedLog;
    } catch (err: any) {
      const errorSummary = `Scan failed: ${err.message}`;
      await this.storage.updateAgentRunLogStatus(log.id, "failed", errorSummary, findings.length);
      this.emit("error", { message: err.message });
      throw err;
    }
  }

  private async analyzePlatform(platform: Platform): Promise<InsertRiskFinding | null> {
    const userPrompt = buildPlatformPrompt(platform);

    const response = await this.llm.complete({
      systemPrompt: RISK_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
      enableWebSearch: true,
      responseFormat: "json",
      temperature: 0.3,
    });

    const parsed = this.parseResponse(response.content, platform, response.citations);
    return parsed;
  }

  private parseResponse(
    content: string,
    platform: Platform,
    citations: Array<{ url: string; title: string }>,
  ): InsertRiskFinding | null {
    try {
      // Clean up response — remove markdown fences if present
      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const json = JSON.parse(cleaned);

      // Check if no findings before full validation
      if (json.noFindings === true) {
        return null;
      }

      const result = riskFindingResultSchema.parse(json);

      // Build sources from LLM citations + any sources in the response
      const sources = citations.length > 0
        ? citations.slice(0, 5) // Limit to top 5 most relevant
        : [{ url: `https://www.google.com/search?q=${encodeURIComponent(platform.toolName + " security breach CVE")}`, title: `Search: ${platform.toolName} security` }];

      // Ensure summary includes tool name prefix
      const summary = result.summary.startsWith(`[${platform.toolName}]`)
        ? result.summary
        : `[${platform.toolName}] ${result.summary}`;

      return {
        platformId: platform.id,
        classification: result.classification,
        summary,
        sources,
        recommendedActions: result.recommendedActions,
        confidence: result.confidence,
      };
    } catch (err: any) {
      console.error(`[RiskScanner] Failed to parse LLM response for ${platform.toolName}:`, err.message);
      console.error(`[RiskScanner] Raw content:`, content.slice(0, 500));

      // Fallback: create a low-confidence finding from raw text
      return {
        platformId: platform.id,
        classification: "low",
        summary: `[${platform.toolName}] AI analysis returned unparseable results. Manual review recommended.`,
        sources: citations.slice(0, 5),
        recommendedActions: "Review raw analysis output. Re-run scan or manually assess vendor risk.",
        confidence: "low",
      };
    }
  }
}
