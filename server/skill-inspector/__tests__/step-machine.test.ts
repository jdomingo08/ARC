import { describe, it, expect } from "vitest";
import { initialSteps, deriveSteps, summarizeSteps } from "../step-machine";

const status = (steps: ReturnType<typeof deriveSteps>, node: string) =>
  steps.find((s) => s.node === node)!.status;

describe("step machine", () => {
  it("initialSteps: all 25 pending", () => {
    const s = initialSteps();
    expect(s).toHaveLength(25);
    expect(s.every((x) => x.status === "pending")).toBe(true);
  });

  it("nothing done: resolve_input running, rest pending", () => {
    const s = deriveSteps(new Set());
    expect(status(s, "resolve_input")).toBe("running");
    expect(status(s, "build_context")).toBe("pending");
    expect(status(s, "report")).toBe("pending");
  });

  it("after resolve_input: build_context running", () => {
    const s = deriveSteps(new Set(["resolve_input"]));
    expect(status(s, "resolve_input")).toBe("done");
    expect(status(s, "build_context")).toBe("running");
    expect(status(s, "static_patterns_prompt_injection")).toBe("pending");
  });

  it("after build_context: all analyzers running", () => {
    const s = deriveSteps(new Set(["resolve_input", "build_context"]));
    expect(status(s, "static_patterns_prompt_injection")).toBe("running");
    expect(status(s, "semantic_quality_policy")).toBe("running");
    expect(status(s, "meta_analyzer")).toBe("pending");
  });

  it("analyzers complete OUT OF ORDER: done ones done, others still running", () => {
    const done = new Set(["resolve_input", "build_context", "static_yara", "mcp_rug_pull"]);
    const s = deriveSteps(done);
    expect(status(s, "static_yara")).toBe("done");
    expect(status(s, "mcp_rug_pull")).toBe("done");
    expect(status(s, "static_patterns_prompt_injection")).toBe("running");
    expect(status(s, "meta_analyzer")).toBe("pending");
  });

  it("all analyzers done: meta_analyzer running", () => {
    const done = new Set<string>(["resolve_input", "build_context"]);
    for (const n of [
      "static_patterns_prompt_injection","static_patterns_data_exfiltration","static_patterns_privilege_escalation",
      "static_patterns_supply_chain","static_patterns_harmful_content","static_patterns_excessive_agency",
      "static_patterns_output_handling","static_patterns_system_prompt_leakage","static_patterns_memory_poisoning",
      "static_patterns_tool_misuse","static_patterns_rogue_agent","static_patterns_agent_snooping",
      "static_yara","behavioral_ast","behavioral_taint_tracking","mcp_least_privilege","mcp_tool_poisoning",
      "mcp_rug_pull","semantic_security_discovery","semantic_developer_intent","semantic_quality_policy",
    ]) done.add(n);
    const s = deriveSteps(done);
    expect(status(s, "meta_analyzer")).toBe("running");
    expect(status(s, "report")).toBe("pending");
  });

  it("all done: everything done", () => {
    const all = new Set(initialSteps().map((x) => x.node));
    const s = deriveSteps(all);
    expect(s.every((x) => x.status === "done")).toBe(true);
    expect(summarizeSteps(s)).toEqual({ current: null, doneCount: 25, totalCount: 25 });
  });

  it("failure: running steps become failed, future stays pending", () => {
    const s = deriveSteps(new Set(["resolve_input"]), true);
    expect(status(s, "resolve_input")).toBe("done");
    expect(status(s, "build_context")).toBe("failed");
    expect(status(s, "report")).toBe("pending");
  });

  it("summarizeSteps: current is the first running, counts done", () => {
    const s = deriveSteps(new Set(["resolve_input"]));
    expect(summarizeSteps(s)).toEqual({ current: "build_context", doneCount: 1, totalCount: 25 });
  });
});
