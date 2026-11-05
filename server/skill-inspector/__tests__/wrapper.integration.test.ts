import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import path from "path";
import { skillSpectorAvailable, SKILLSPECTOR_PYTHON, SKILLSPECTOR_STREAM_SCRIPT } from "../skillspector-cli";

const d = skillSpectorAvailable() ? describe : describe.skip;

d("skillspector_stream.py (integration, requires .venv)", () => {
  it("emits step events and a final result for the risky-skill fixture", () => {
    const fixture = path.resolve(__dirname, "fixtures/risky-skill");
    const res = spawnSync(SKILLSPECTOR_PYTHON, [SKILLSPECTOR_STREAM_SCRIPT, fixture, "--no-llm"], {
      encoding: "utf-8",
      timeout: 120000,
    });
    const lines = (res.stdout || "").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const types = lines.map((l) => l.type);
    expect(types).toContain("step");
    expect(lines.some((l) => l.type === "step" && l.node === "report")).toBe(true);
    const result = lines.find((l) => l.type === "result");
    expect(result).toBeTruthy();
    // report is a JSON string parseable by our existing parser shape
    expect(() => JSON.parse(result.report)).not.toThrow();
  }, 130000);
});
