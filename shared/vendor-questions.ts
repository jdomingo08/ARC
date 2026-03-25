export interface VendorQuestion {
  id: string;
  title: string;
  question: string;
  conditional?: string;
}

export const vendorQuestions: VendorQuestion[] = [
  {
    id: "data_input_categories",
    title: "Data Input Categories",
    question: "What categories of data does your platform process or store on behalf of customers? Select all that apply: Public Data / Client Data / Personally Identifiable Information (PII) / Internal Financials / Other (describe).",
  },
  {
    id: "login_method_sso",
    title: "Login Method / SSO",
    question: "Does your platform support Single Sign-On (SSO) via Okta or SAML? Does it support Multi-Factor Authentication (MFA) independent of SSO?",
  },
  {
    id: "soc2_type2",
    title: "SOC 2 Type II with AI Mapping",
    question: "Do you hold a current SOC 2 Type II certification? Does the report explicitly include Processing Integrity and Confidentiality for AI training and inference? Please attach the most recent report.",
  },
  {
    id: "iso_42001",
    title: "ISO/IEC 42001",
    question: "Do you hold ISO/IEC 42001 certification for AI Management Systems? If yes, provide certification details and renewal date.",
  },
  {
    id: "eu_ai_act",
    title: "EU AI Act Classification",
    question: "Has your organization formally classified this product under the EU AI Act (Minimal Risk / Limited Risk / High Risk)? Provide your transparency statement or conformity documentation.",
    conditional: "ats_or_both",
  },
  {
    id: "ai_ethics",
    title: "AI Ethics Policy",
    question: "Does your organization maintain a formal written policy for bias mitigation, fairness testing, and human-in-the-loop requirements for high-stakes decisions? Please provide a link or summary.",
  },
  {
    id: "training_opt_out",
    title: "Training Opt-Out",
    question: "Is there a legally binding contractual guarantee that our data — including prompts, uploads, and outputs — will never be used to train or improve your base AI models? Provide the specific contract clause or addendum.",
  },
  {
    id: "zero_data_retention",
    title: "Zero Data Retention (ZDR)",
    question: "Do you offer a Zero Data Retention mode where prompts and responses are deleted immediately after generation and never written to persistent storage? Is this available at enterprise license tier?",
  },
  {
    id: "data_isolation",
    title: "Data Isolation",
    question: "Is our data stored in a logically or physically isolated environment — for example, a dedicated VPC or private tenant — so it cannot comingle with other customers' data? Please describe your isolation architecture.",
  },
  {
    id: "pii_scrubbing",
    title: "PII Scrubbing",
    question: "Does your platform automatically detect and redact sensitive information — such as Social Security Numbers, API keys, or financial account numbers — before it reaches the AI model? Please describe how this works.",
  },
  {
    id: "prompt_injection_defense",
    title: "Prompt Injection Defense",
    question: "What specific input sanitization and validation layers are in place to prevent prompt injection attacks, jailbreaking attempts, and malicious system-prompt overrides? Please describe your defense architecture.",
  },
  {
    id: "output_validation",
    title: "Output Validation",
    question: "Does your system scan AI-generated outputs for hallucinated sensitive data, malicious code, or unintended information disclosures before returning results to end users?",
  },
  {
    id: "model_red_teaming",
    title: "Model Red Teaming",
    question: "Can you provide a summary of your most recent internal or third-party adversarial (red team) testing results? What vulnerabilities were identified and how were they remediated?",
  },
  {
    id: "rate_limiting",
    title: "Rate Limiting (Token-based)",
    question: "Does your API enforce token-based rate limiting to prevent model scraping attacks — where an attacker uses high-volume queries to reverse-engineer your model? Please describe the limits and enforcement mechanism.",
  },
  {
    id: "non_human_identity",
    title: "Non-Human Identity (NHI)",
    question: "Are AI agents, plugins, and API integrations authenticated using short-lived OAuth tokens rather than static API keys? What is the maximum token lifetime and your rotation policy?",
  },
  {
    id: "human_in_the_loop",
    title: "Human-in-the-Loop (HITL)",
    question: "For high-risk automated actions — such as sending emails, modifying records, or publishing content — does your platform enforce a mandatory human approval step before the AI executes? Can this be configured per use case?",
  },
  {
    id: "prompt_level_auditing",
    title: "Prompt-Level Auditing",
    question: "Do your system logs capture the full prompt text and full AI response for every interaction, with timestamps and user identifiers? Are these logs exportable for forensic review? How long are they retained by default?",
  },
];

export function getFilteredQuestions(division?: string): VendorQuestion[] {
  const includeAts = division === "ats_international" || division === "both";
  return vendorQuestions.filter(q => {
    if (q.conditional === "ats_or_both" && !includeAts) return false;
    return true;
  });
}

export function formatQuestionsAsText(division?: string): string {
  const questions = getFilteredQuestions(division);
  let text = "ENTRAVISION — VENDOR SECURITY QUESTIONNAIRE\n";
  text += "=============================================\n\n";
  text += "Please answer each question below. Provide as much detail as possible.\n\n";

  questions.forEach((q, i) => {
    text += `${i + 1}. ${q.title}\n`;
    text += `${q.question}\n`;
    text += `\nAnswer:\n\n\n`;
  });

  return text;
}
