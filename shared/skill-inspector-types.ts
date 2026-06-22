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
