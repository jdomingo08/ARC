import { EventEmitter } from "events";
import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { IStorage } from "../storage";
import type { SkillScan } from "@shared/schema";
import { SKILLSPECTOR_BIN } from "./skillspector-cli";
import { parseSkillSpectorOutput } from "./parse";

export interface RunOpts {
  scanId: string;
  inputType: "url" | "upload";
  target: string; // github url (url) or original filename (upload)
  fileBuffer?: Buffer; // present for uploads
  fileName?: string; // present for uploads
  timeoutMs?: number;
  // test hooks (not used in production paths):
  fixtureDir?: string;
  llm?: boolean;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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
    const outFile = path.join(workDir, "report.json");

    try {
      // Resolve the scan target.
      let scanTarget: string;
      if (opts.fixtureDir) {
        scanTarget = opts.fixtureDir; // test-only local dir
      } else if (opts.inputType === "url") {
        scanTarget = opts.target; // already validated in the route
      } else {
        if (!opts.fileBuffer || !opts.fileName) {
          throw new Error("Upload is missing file data.");
        }
        const filePath = path.join(workDir, opts.fileName);
        await writeFile(filePath, opts.fileBuffer);
        scanTarget = filePath;
      }

      const args = ["scan", scanTarget, "--format", "json", "--output", outFile];
      if (!useLlm) args.push("--no-llm");

      await this.spawnScan(args, timeoutMs);

      const jsonText = await readFile(outFile, "utf-8");
      const verdict = parseSkillSpectorOutput(jsonText);

      const updated = await this.storage.updateSkillScan(opts.scanId, {
        status: "complete",
        riskScore: verdict.riskScore,
        riskLevel: verdict.riskLevel,
        recommendation: verdict.recommendation,
        summary: verdict.summary as any,
        findings: verdict.findings as any,
        rawOutput: safeJson(jsonText) as any,
        completedAt: new Date(),
      });
      this.emit("complete", { scan: updated });
      return updated as SkillScan;
    } catch (err: any) {
      const message = this.aborted ? "Scan cancelled." : err?.message || "Scan failed.";
      const updated = await this.storage.updateSkillScan(opts.scanId, {
        status: "failed",
        error: message,
        completedAt: new Date(),
      });
      this.emit("error", { message });
      return updated as SkillScan;
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private spawnScan(args: string[], timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(SKILLSPECTOR_BIN, args, {
        env: { ...process.env, SKILLSPECTOR_PROVIDER: "openai" },
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Scan timed out after ${Math.round(timeoutMs / 1000)}s.`));
      }, timeoutMs);

      const onAbort = setInterval(() => {
        if (this.aborted) {
          child.kill("SIGKILL");
        }
      }, 500);

      child.stdout.on("data", (b) => {
        const line = b.toString().trim();
        if (line) this.emit("progress", { line });
      });
      let stderr = "";
      child.stderr.on("data", (b) => {
        stderr += b.toString();
      });

      child.on("error", (e) => {
        clearTimeout(timer);
        clearInterval(onAbort);
        reject(e);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        clearInterval(onAbort);
        if (this.aborted) return reject(new Error("aborted"));
        if (code === 0) resolve();
        else reject(new Error(`SkillSpector exited with code ${code}. ${stderr.slice(0, 500)}`));
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
