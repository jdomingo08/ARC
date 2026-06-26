export interface ParsedFinding {
  severity: string;
  ruleId: string;
  message: string;
  location: string;
  finding: string;
  confidence: number | null;
}

export interface ParsedVerdict {
  riskScore: number | null;
  riskLevel: "low" | "medium" | "high" | "critical" | "unknown";
  recommendation: string;
  summary: { total: number; bySeverity: Record<string, number> };
  findings: ParsedFinding[];
}

export function verdictLabel(
  level: ParsedVerdict["riskLevel"],
): { label: string; tone: "safe" | "caution" | "danger" | "unknown" } {
  switch (level) {
    case "low":
      return { label: "Safe to install", tone: "safe" };
    case "medium":
    case "high":
      return { label: "Review before installing", tone: "caution" };
    case "critical":
      return { label: "Do not install", tone: "danger" };
    default:
      return { label: "Could not determine", tone: "unknown" };
  }
}

export type ScanPhase = "fetch" | "static" | "behavioral" | "mcp" | "ai" | "finalize";
export type StepStatus = "pending" | "running" | "done" | "failed";

export interface ScanStep {
  node: string;
  label: string;
  phase: ScanPhase;
}

export interface StepState extends ScanStep {
  status: StepStatus;
  finishedAt?: string;
}

// Verbatim node ids from SkillSpector @26d1a9a (graph.py + ANALYZER_NODE_IDS), in execution order.
export const SKILL_STEP_CATALOG: ScanStep[] = [
  { node: "resolve_input", label: "Fetching & unpacking skill", phase: "fetch" },
  { node: "build_context", label: "Reading files", phase: "fetch" },
  { node: "static_patterns_prompt_injection", label: "Prompt injection", phase: "static" },
  { node: "static_patterns_data_exfiltration", label: "Data exfiltration", phase: "static" },
  { node: "static_patterns_privilege_escalation", label: "Privilege escalation", phase: "static" },
  { node: "static_patterns_supply_chain", label: "Supply-chain risks", phase: "static" },
  { node: "static_patterns_harmful_content", label: "Harmful content", phase: "static" },
  { node: "static_patterns_excessive_agency", label: "Excessive agency", phase: "static" },
  { node: "static_patterns_output_handling", label: "Output handling", phase: "static" },
  { node: "static_patterns_system_prompt_leakage", label: "System-prompt leakage", phase: "static" },
  { node: "static_patterns_memory_poisoning", label: "Memory poisoning", phase: "static" },
  { node: "static_patterns_tool_misuse", label: "Tool misuse", phase: "static" },
  { node: "static_patterns_rogue_agent", label: "Rogue agent", phase: "static" },
  { node: "static_patterns_agent_snooping", label: "Agent snooping", phase: "static" },
  { node: "static_yara", label: "YARA signatures", phase: "static" },
  { node: "behavioral_ast", label: "AST behavioral analysis", phase: "behavioral" },
  { node: "behavioral_taint_tracking", label: "Taint tracking", phase: "behavioral" },
  { node: "mcp_least_privilege", label: "MCP least-privilege", phase: "mcp" },
  { node: "mcp_tool_poisoning", label: "MCP tool poisoning", phase: "mcp" },
  { node: "mcp_rug_pull", label: "MCP rug-pull", phase: "mcp" },
  { node: "semantic_security_discovery", label: "AI: security discovery", phase: "ai" },
  { node: "semantic_developer_intent", label: "AI: developer intent", phase: "ai" },
  { node: "semantic_quality_policy", label: "AI: quality policy", phase: "ai" },
  { node: "meta_analyzer", label: "AI meta-analysis", phase: "ai" },
  { node: "report", label: "Building report", phase: "finalize" },
];
