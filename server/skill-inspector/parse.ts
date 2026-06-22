import type { ParsedFinding, ParsedVerdict } from "@shared/skill-inspector-types";
export type { ParsedFinding, ParsedVerdict };
export { verdictLabel } from "@shared/skill-inspector-types";

function toRiskLevel(severity: unknown): ParsedVerdict["riskLevel"] {
  const s = String(severity ?? "").toLowerCase();
  if (s === "low" || s === "medium" || s === "high" || s === "critical") return s;
  return "unknown";
}

export function parseSkillSpectorOutput(jsonText: string): ParsedVerdict {
  const empty: ParsedVerdict = {
    riskScore: null,
    riskLevel: "unknown",
    recommendation: "",
    summary: { total: 0, bySeverity: {} },
    findings: [],
  };

  let raw: any;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return empty;
  }
  if (!raw || typeof raw !== "object") return empty;

  const rawFindings = Array.isArray(raw.filtered_findings) ? raw.filtered_findings : [];
  const findings: ParsedFinding[] = rawFindings.map((f: any) => ({
    severity: String(f?.severity ?? "unknown").toLowerCase(),
    ruleId: String(f?.rule_id ?? ""),
    message: String(f?.message ?? ""),
    location: String(f?.location ?? ""),
    finding: String(f?.finding ?? ""),
    confidence: typeof f?.confidence === "number" ? f.confidence : null,
  }));

  const bySeverity: Record<string, number> = {};
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;

  return {
    riskScore: typeof raw.risk_score === "number" ? raw.risk_score : null,
    riskLevel: toRiskLevel(raw.risk_severity),
    recommendation: typeof raw.risk_recommendation === "string" ? raw.risk_recommendation : "",
    summary: { total: findings.length, bySeverity },
    findings,
  };
}
