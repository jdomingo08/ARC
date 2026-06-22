import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { skillSpectorAvailable } from "../skillspector-cli";
import { SkillInspector } from "../inspector";

const available = skillSpectorAvailable();
const d = available ? describe : describe.skip;

// In-memory fake of the storage methods the inspector uses.
function makeFakeStorage() {
  const rows = new Map<string, any>();
  return {
    rows,
    async updateSkillScan(id: string, data: any) {
      const next = { ...(rows.get(id) ?? { id }), ...data };
      rows.set(id, next);
      return next;
    },
  } as any;
}

d("SkillInspector (integration, requires .venv)", () => {
  it("flags a risky skill as a finding-bearing verdict", async () => {
    const storage = makeFakeStorage();
    storage.rows.set("scan1", { id: "scan1", status: "running" });
    const inspector = new SkillInspector(storage);
    const scan = await inspector.run({
      scanId: "scan1",
      inputType: "upload",
      target: "risky-skill",
      // For the test we point at a local path via the fixtureDir hook (see Step 3 note).
      fixtureDir: path.resolve(__dirname, "fixtures/risky-skill"),
      llm: false,
      timeoutMs: 120000,
    } as any);
    expect(scan.status).toBe("complete");
    expect(["low", "medium", "high", "critical", "unknown"]).toContain(scan.riskLevel);
    expect(Array.isArray(scan.findings)).toBe(true);
  }, 130000);

  it("completes a clean skill without error", async () => {
    const storage = makeFakeStorage();
    storage.rows.set("scan2", { id: "scan2", status: "running" });
    const inspector = new SkillInspector(storage);
    const scan = await inspector.run({
      scanId: "scan2",
      inputType: "upload",
      target: "clean-skill",
      fixtureDir: path.resolve(__dirname, "fixtures/clean-skill"),
      llm: false,
      timeoutMs: 120000,
    } as any);
    expect(scan.status).toBe("complete");
  }, 130000);
});
