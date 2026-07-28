import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { writeFileSync, rmSync } from "fs";
import path from "path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
let counter = 0;

/**
 * Runs a snippet in a fresh Node process with the object-storage sidecar pointed
 * at a closed port, so bucket resolution always fails. Returns the exit code —
 * an unhandled rejection surfaces as a non-zero exit.
 */
function runWithDeadSidecar(source: string): { status: number; output: string } {
  // Written inside the repo so the snippet's relative imports and tsconfig apply.
  const file = path.join(REPO_ROOT, `.objstore-probe-${process.pid}-${counter++}.ts`);
  writeFileSync(file, source);
  try {
    const output = execFileSync("npx", ["tsx", file], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        // Port 1 is reserved and never listening, so bucket resolution always
        // fails — including on Replit, where the real sidecar would answer.
        REPLIT_SIDECAR_ENDPOINT: "http://127.0.0.1:1",
        DATABASE_URL:
          process.env.DATABASE_URL || "postgres://unused@127.0.0.1:5432/unused",
      },
    });
    return { status: 0, output };
  } catch (err: any) {
    return {
      status: err.status ?? 1,
      output: `${err.stdout || ""}${err.stderr || ""}`,
    };
  } finally {
    rmSync(file, { force: true });
  }
}

describe("object storage client", () => {
  // Regression: `new Client()` at module scope eagerly resolved the default
  // bucket. With the sidecar unreachable that rejection had nothing awaiting it,
  // and Node terminates the process on an unhandled rejection — so importing
  // this module (as routes.ts does at startup) killed the instance at boot.
  it("does not crash the process when imported with no reachable sidecar", () => {
    const { status, output } = runWithDeadSidecar(`
      import "./server/object-storage";
      // Idle like a booted server that has not served an upload yet.
      setTimeout(() => { console.log("ALIVE"); process.exit(0); }, 1500);
    `);
    expect(output).toContain("ALIVE");
    expect(status).toBe(0);
  }, 60_000);

  it("reports an unreachable sidecar as a catchable error naming the cause", () => {
    const { status, output } = runWithDeadSidecar(`
      import { putObject } from "./server/object-storage";
      (async () => {
        try {
          await putObject("k", Buffer.from("x"));
          console.log("UNEXPECTED_SUCCESS");
        } catch (e: any) {
          console.log("CAUGHT:" + e.message);
        }
        process.exit(0);
      })();
    `);
    expect(output).toContain("CAUGHT:");
    expect(output).toContain("Object storage upload failed");
    expect(output).toMatch(/bucket is attached to this deployment/);
    expect(status).toBe(0);
  }, 60_000);
});
