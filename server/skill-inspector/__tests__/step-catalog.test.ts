import { describe, it, expect } from "vitest";
import { SKILL_STEP_CATALOG } from "@shared/skill-inspector-types";

// The 25 SkillSpector @26d1a9a node ids (4 fixed + 21 analyzers).
const EXPECTED_NODES = [
  "resolve_input", "build_context",
  "static_patterns_prompt_injection", "static_patterns_data_exfiltration",
  "static_patterns_privilege_escalation", "static_patterns_supply_chain",
  "static_patterns_harmful_content", "static_patterns_excessive_agency",
  "static_patterns_output_handling", "static_patterns_system_prompt_leakage",
  "static_patterns_memory_poisoning", "static_patterns_tool_misuse",
  "static_patterns_rogue_agent", "static_patterns_agent_snooping",
  "static_yara", "behavioral_ast", "behavioral_taint_tracking",
  "mcp_least_privilege", "mcp_tool_poisoning", "mcp_rug_pull",
  "semantic_security_discovery", "semantic_developer_intent", "semantic_quality_policy",
  "meta_analyzer", "report",
];

describe("SKILL_STEP_CATALOG", () => {
  it("has exactly the 25 known nodes, in order, unique", () => {
    expect(SKILL_STEP_CATALOG.map((s) => s.node)).toEqual(EXPECTED_NODES);
  });
  it("every entry has a non-empty label and a valid phase", () => {
    const phases = new Set(["fetch", "static", "behavioral", "mcp", "ai", "finalize"]);
    for (const s of SKILL_STEP_CATALOG) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(phases.has(s.phase)).toBe(true);
    }
  });
});
