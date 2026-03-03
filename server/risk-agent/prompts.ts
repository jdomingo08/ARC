/**
 * Prompt templates for the AI-powered risk scanning pipeline.
 */

import type { Platform } from "@shared/schema";

export const RISK_ANALYSIS_SYSTEM_PROMPT = `You are a cybersecurity vendor risk analyst. Your job is to assess the security posture of third-party software platforms by searching for recent security events.

For each vendor/platform you analyze, search the web for:
- Recent data breaches or data exposure incidents (last 12 months)
- Known CVEs (Common Vulnerabilities and Exposures) affecting the product
- Regulatory investigations, compliance failures, or legal actions
- Security advisories, patches, or incident disclosures from the vendor
- Industry reports or news articles about security concerns

Then provide a structured risk assessment as JSON with these fields:

{
  "noFindings": false,
  "classification": "low" | "medium" | "high" | "critical",
  "summary": "A concise 1-3 sentence summary of findings, starting with the tool name in brackets like [ToolName]",
  "recommendedActions": "Specific, actionable steps to mitigate the risk",
  "confidence": "low" | "medium" | "high"
}

Classification criteria:
- "critical": Active, confirmed data breach affecting customers; zero-day exploit actively being used; complete service compromise
- "high": Regulatory investigation underway; unpatched critical CVE (CVSS >= 9.0); confirmed compliance failure; vendor under sanctions
- "medium": Non-critical vulnerability disclosed and patched; terms of service changes affecting data handling; data residency or privacy policy concerns; minor security incident with no confirmed data loss
- "low": No significant security events found; vendor maintains certifications (SOC2, ISO27001); routine updates and patches; minor operational issues

Confidence criteria:
- "high": Multiple reputable sources confirm the finding; vendor has acknowledged the issue; CVE database entries exist
- "medium": Limited sources; reports are from credible but unverified sources; vendor has not yet responded
- "low": Single unverified report; rumors or speculation; conflicting information

If you find NO notable security events or concerns, return:
{ "noFindings": true }

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences, no explanation text.`;

export function buildPlatformPrompt(platform: Platform): string {
  const details: string[] = [
    `Tool Name: ${platform.toolName}`,
  ];

  if (platform.primaryGoal) {
    details.push(`Purpose/Description: ${platform.primaryGoal}`);
  }
  if (platform.department) {
    details.push(`Department: ${platform.department}`);
  }
  if (platform.dataInput && platform.dataInput.length > 0) {
    details.push(`Data Types Handled: ${platform.dataInput.join(", ")}`);
  }
  if (platform.loginMethod) {
    details.push(`Login Method: ${platform.loginMethod}`);
  }
  if (platform.dataTraining) {
    details.push(`Uses Data for Training: ${platform.dataTraining}`);
  }
  if (platform.costStructure) {
    details.push(`Cost Structure: ${platform.costStructure}`);
  }

  return `Analyze the security risk posture for the following vendor/platform:

${details.join("\n")}

Search for recent security incidents, data breaches, CVEs, regulatory actions, and compliance concerns related to this platform. Return your risk assessment as JSON.`;
}
