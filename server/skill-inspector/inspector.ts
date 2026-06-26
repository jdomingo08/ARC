import { EventEmitter } from "events";
import { spawn } from "child_process";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { IStorage } from "../storage";
import type { SkillScan } from "@shared/schema";
import type { StepState } from "@shared/skill-inspector-types";
import { SKILLSPECTOR_PYTHON, SKILLSPECTOR_STREAM_SCRIPT } from "./skillspector-cli";
import { initialSteps, deriveSteps, summarizeSteps } from "./step-machine";
import { parseSkillSpectorOutput } from "./parse";

export interface RunOpts {
  scanId: string;
  inputType: "url" | "upload";
  target: string;
  fileBuffer?: Buffer;
  fileName?: string;
  timeoutMs?: number;
  // test hooks:
  fixtureDir?: string;
  llm?: boolean;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const PERSIST_THROTTLE_MS = 500;

export class SkillInspector extends EventEmitter {
  private aborted = false;
  constructor(private storage: IStorage) {
    super();
  }
  abort() {
    this.aborted = true;
  }

  async run(opts: RunOpts): Promise<SkillScan> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const useLlm = opts.llm !== false;
    this.emit("scan-start", { scanId: opts.scanId, target: opts.target });

    const workDir = await mkdtemp(path.join(tmpdir(), "skillscan-"));
    const done = new Set<string>();
    let lastPersist = 0;

    const stepStateNow = (failed = false): StepState[] => deriveSteps(done, failed);

    const persist = async (steps: StepState[], force = false) => {
      const now = Date.now();
      if (!force && now - lastPersist < PERSIST_THROTTLE_MS) return;
      lastPersist = now;
      const { current } = summarizeSteps(steps);
      try {
        await this.storage.updateSkillScan(opts.scanId, { steps: steps as any, currentStep: current });
      } catch (e) {
        console.error("[SkillInspector] step persist failed for scan", opts.scanId, e);
      }
    };

    try {
      // Resolve the scan target.
      let scanTarget: string;
      if (opts.fixtureDir) {
        scanTarget = opts.fixtureDir;
      } else if (opts.inputType === "url") {
        scanTarget = opts.target;
      } else {
        if (!opts.fileBuffer || !opts.fileName) throw new Error("Upload is missing file data.");
        const safeName = path.basename(opts.fileName);
        const filePath = path.join(workDir, safeName);
        await writeFile(filePath, opts.fileBuffer);
        scanTarget = filePath;
      }

      const report = await this.streamScan(scanTarget, useLlm, timeoutMs, async (node) => {
        done.add(node);
        const steps = stepStateNow();
        const { current, doneCount, totalCount } = summarizeSteps(steps);
        this.emit("step", { steps, current, doneCount, totalCount });
        await persist(steps);
      });

      const verdict = parseSkillSpectorOutput(report);
      const finalSteps = deriveSteps(new Set(initialSteps().map((s) => s.node))); // all done
      const updated = await this.storage.updateSkillScan(opts.scanId, {
        status: "complete",
        riskScore: verdict.riskScore,
        riskLevel: verdict.riskLevel,
        recommendation: verdict.recommendation,
        summary: verdict.summary as any,
        findings: verdict.findings as any,
        rawOutput: safeJson(report) as any,
        steps: finalSteps as any,
        currentStep: null,
        completedAt: new Date(),
      });
      this.emit("step", { steps: finalSteps, current: null, doneCount: finalSteps.length, totalCount: finalSteps.length });
      this.emit("complete", { scan: updated });
      return updated as SkillScan;
    } catch (err: any) {
      const message = this.aborted ? "Scan cancelled." : err?.message || "Scan failed.";
      const runningSteps = deriveSteps(done);
      const failedNode = summarizeSteps(runningSteps).current;
      const failedSteps = deriveSteps(done, true);
      try {
        const updated = await this.storage.updateSkillScan(opts.scanId, {
          status: "failed",
          error: message,
          steps: failedSteps as any,
          currentStep: failedNode,
          completedAt: new Date(),
        });
        this.emit("error", { message, step: failedNode });
        return updated as SkillScan;
      } catch (persistErr) {
        console.error("[SkillInspector] failed to persist failure for scan", opts.scanId, persistErr);
        this.emit("error", { message, step: failedNode });
        return { id: opts.scanId, status: "failed", error: message } as SkillScan;
      }
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // Spawn the Python wrapper, read NDJSON; call onStep(node) per completed node; resolve with the report JSON string.
  private streamScan(
    target: string,
    useLlm: boolean,
    timeoutMs: number,
    onStep: (node: string) => Promise<void>,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const args = [SKILLSPECTOR_STREAM_SCRIPT, target];
      if (!useLlm) args.push("--no-llm");
      const child = spawn(SKILLSPECTOR_PYTHON, args, {
        env: { ...process.env, SKILLSPECTOR_PROVIDER: "openai" },
      });

      let settled = false;
      let report: string | null = null;
      let errorMsg: string | null = null;
      let stderr = "";
      let buffer = "";
      const chain: Promise<void>[] = [];

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish(new Error(`Scan timed out after ${Math.round(timeoutMs / 1000)}s.`));
      }, timeoutMs);
      const abortPoll = setInterval(() => {
        if (this.aborted) child.kill("SIGKILL");
      }, 500);

      const finish = (err: Error | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearInterval(abortPoll);
        Promise.all(chain).then(() => {
          if (err) return reject(err);
          if (errorMsg) return reject(new Error(errorMsg));
          if (report == null) return reject(new Error("Scanner produced no result."));
          resolve(report);
        }, reject);
      };

      child.stdout.on("data", (b) => {
        buffer += b.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let ev: any;
          try {
            ev = JSON.parse(trimmed);
          } catch {
            continue; // ignore non-JSON output (python warnings)
          }
          if (ev.type === "step" && typeof ev.node === "string") {
            chain.push(onStep(ev.node));
          } else if (ev.type === "result") {
            report = typeof ev.report === "string" ? ev.report : "";
          } else if (ev.type === "error") {
            errorMsg = ev.message || "Scanner error.";
          }
        }
      });
      child.stderr.on("data", (b) => {
        stderr += b.toString();
      });
      child.on("error", (e) => finish(e));
      child.on("close", (code) => {
        if (this.aborted) return finish(new Error("Scan cancelled."));
        if (code === 0 || report != null || errorMsg) return finish(null);
        finish(new Error(`Scanner exited with code ${code}. ${stderr.slice(0, 500)}`));
      });
    });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
