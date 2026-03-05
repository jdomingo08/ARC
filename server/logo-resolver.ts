/**
 * Platform Logo Resolver
 *
 * Resolves platform/tool names to favicon/logo URLs.
 * Uses a known domain mapping + heuristic fallback,
 * then fetches the favicon via Google's favicon service.
 */

// Well-known tool name -> domain mapping
const KNOWN_DOMAINS: Record<string, string> = {
  "chatgpt": "openai.com",
  "chatgpt enterprise": "openai.com",
  "openai": "openai.com",
  "gpt-4": "openai.com",
  "slack": "slack.com",
  "notion": "notion.so",
  "figma": "figma.com",
  "linear": "linear.app",
  "github": "github.com",
  "github copilot": "github.com",
  "gitlab": "gitlab.com",
  "jira": "atlassian.com",
  "confluence": "atlassian.com",
  "atlassian": "atlassian.com",
  "trello": "trello.com",
  "asana": "asana.com",
  "monday.com": "monday.com",
  "zoom": "zoom.us",
  "teams": "microsoft.com",
  "microsoft teams": "microsoft.com",
  "copilot for m365": "microsoft.com",
  "copilot": "microsoft.com",
  "microsoft copilot": "microsoft.com",
  "google workspace": "google.com",
  "google docs": "google.com",
  "google drive": "google.com",
  "dropbox": "dropbox.com",
  "box": "box.com",
  "salesforce": "salesforce.com",
  "hubspot": "hubspot.com",
  "zendesk": "zendesk.com",
  "intercom": "intercom.com",
  "datadog": "datadoghq.com",
  "splunk": "splunk.com",
  "snowflake": "snowflake.com",
  "tableau": "tableau.com",
  "power bi": "microsoft.com",
  "aws": "aws.amazon.com",
  "azure": "azure.microsoft.com",
  "gcp": "cloud.google.com",
  "vercel": "vercel.com",
  "netlify": "netlify.com",
  "heroku": "heroku.com",
  "docker": "docker.com",
  "kubernetes": "kubernetes.io",
  "terraform": "terraform.io",
  "anthropic": "anthropic.com",
  "claude": "anthropic.com",
  "gemini": "gemini.google.com",
  "perplexity": "perplexity.ai",
  "midjourney": "midjourney.com",
  "dall-e": "openai.com",
  "stable diffusion": "stability.ai",
  "jasper": "jasper.ai",
  "jasper ai": "jasper.ai",
  "grammarly": "grammarly.com",
  "canva": "canva.com",
  "adobe": "adobe.com",
  "photoshop": "adobe.com",
  "illustrator": "adobe.com",
  "miro": "miro.com",
  "loom": "loom.com",
  "calendly": "calendly.com",
  "docusign": "docusign.com",
  "1password": "1password.com",
  "lastpass": "lastpass.com",
  "okta": "okta.com",
  "auth0": "auth0.com",
  "twilio": "twilio.com",
  "sendgrid": "sendgrid.com",
  "stripe": "stripe.com",
  "airtable": "airtable.com",
  "zapier": "zapier.com",
  "make": "make.com",
  "deepseek": "deepseek.com",
  "deepseek coder": "deepseek.com",
  "cursor": "cursor.com",
  "replit": "replit.com",
  "codium": "codium.ai",
  "codeium": "codeium.com",
  "tabnine": "tabnine.com",
  "sourcegraph": "sourcegraph.com",
  "sentry": "sentry.io",
  "pagerduty": "pagerduty.com",
  "clickup": "clickup.com",
  "basecamp": "basecamp.com",
  "freshworks": "freshworks.com",
  "servicenow": "servicenow.com",
  "workday": "workday.com",
  "sap": "sap.com",
  "oracle": "oracle.com",
};

/**
 * Resolve a tool name to a domain for favicon lookup.
 */
function resolveDomain(toolName: string): string {
  const normalized = toolName.toLowerCase().trim();

  // Check exact match first
  if (KNOWN_DOMAINS[normalized]) {
    return KNOWN_DOMAINS[normalized];
  }

  // Check partial match (e.g., "ChatGPT Enterprise" contains "chatgpt")
  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return domain;
    }
  }

  // Heuristic: strip common suffixes and try as domain
  const cleaned = normalized
    .replace(/\s+(ai|enterprise|pro|plus|business|team|teams|for\s+\w+)$/i, "")
    .replace(/[^a-z0-9]/g, "");

  return `${cleaned}.com`;
}

/**
 * Get the logo URL for a platform tool name.
 * Uses Google's favicon service which reliably returns favicons for any domain.
 */
export function getLogoUrl(toolName: string, size: number = 32): string {
  const domain = resolveDomain(toolName);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/**
 * Resolve logos for multiple platforms at once.
 * Returns a map of platformId -> logoUrl.
 */
export function resolveLogos(
  platforms: Array<{ id: string; toolName: string }>
): Map<string, string> {
  const result = new Map<string, string>();
  for (const platform of platforms) {
    result.set(platform.id, getLogoUrl(platform.toolName));
  }
  return result;
}
