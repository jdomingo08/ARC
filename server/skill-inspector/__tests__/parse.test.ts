import { describe, it, expect } from "vitest";
import { parseSkillSpectorOutput, verdictLabel } from "../parse";

const sample = JSON.stringify({
  risk_score: 82,
  risk_severity: "HIGH",
  risk_recommendation: "Review before installing.",
  filtered_findings: [
    {
      severity: "HIGH",
      rule_id: "PROMPT_INJECTION_01",
      message: "Possible prompt injection",
      location: "SKILL.md:12",
      finding: "Instruction to ignore previous rules",
      confidence: 90,
    },
    {
      severity: "LOW",
      rule_id: "INFO_01",
      message: "Uses network",
      location: "tool.py:3",
      finding: "requests.get(...)",
      confidence: 40,
    },
  ],
});

describe("parseSkillSpectorOutput", () => {
  it("maps top-level verdict fields", () => {
    const v = parseSkillSpectorOutput(sample);
    expect(v.riskScore).toBe(82);
    expect(v.riskLevel).toBe("high");
    expect(v.recommendation).toBe("Review before installing.");
  });

  it("maps findings and severity counts", () => {
    const v = parseSkillSpectorOutput(sample);
    expect(v.findings).toHaveLength(2);
    expect(v.findings[0].ruleId).toBe("PROMPT_INJECTION_01");
    expect(v.summary.total).toBe(2);
    expect(v.summary.bySeverity).toEqual({ high: 1, low: 1 });
  });

  it("handles a clean scan with no findings", () => {
    const v = parseSkillSpectorOutput(
      JSON.stringify({ risk_score: 3, risk_severity: "LOW", risk_recommendation: "Safe.", filtered_findings: [] }),
    );
    expect(v.findings).toEqual([]);
    expect(v.summary.total).toBe(0);
    expect(v.riskLevel).toBe("low");
  });

  it("degrades to 'unknown' on unexpected/garbage JSON without throwing", () => {
    const v = parseSkillSpectorOutput("{not json");
    expect(v.riskLevel).toBe("unknown");
    expect(v.findings).toEqual([]);
  });

  it("tolerates missing fields", () => {
    const v = parseSkillSpectorOutput(JSON.stringify({ risk_severity: "CRITICAL" }));
    expect(v.riskLevel).toBe("critical");
    expect(v.riskScore).toBeNull();
    expect(v.recommendation).toBe("");
  });
});

describe("verdictLabel", () => {
  it("maps levels to user-facing labels and tones", () => {
    expect(verdictLabel("low")).toEqual({ label: "Safe to install", tone: "safe" });
    expect(verdictLabel("medium").tone).toBe("caution");
    expect(verdictLabel("high").tone).toBe("caution");
    expect(verdictLabel("critical")).toEqual({ label: "Do not install", tone: "danger" });
    expect(verdictLabel("unknown").tone).toBe("unknown");
  });
});
