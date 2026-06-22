const ALLOWED_UPLOAD_EXT = new Set([".md", ".zip"]);

export function validateGitHubUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, error: "A GitHub repository URL is required." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That is not a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Only https:// GitHub URLs are allowed." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "URLs with embedded credentials are not allowed." };
  }
  if (parsed.port && parsed.port !== "443") {
    return { ok: false, error: "Non-standard ports are not allowed." };
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    return { ok: false, error: "Only public github.com repositories can be scanned." };
  }
  // Require an /owner/repo path (at least two non-empty segments).
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return { ok: false, error: "Provide a full repository URL: https://github.com/owner/repo" };
  }
  // Normalize: strip a trailing .git, drop query/hash.
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");
  return { ok: true, url: `https://github.com/${owner}/${repo}` };
}

export function validateUploadName(
  name: string,
): { ok: true } | { ok: false; error: string } {
  const clean = (name ?? "").trim();
  if (!clean || clean.includes("/") || clean.includes("\\") || clean.includes("..")) {
    return { ok: false, error: "Invalid file name." };
  }
  const dot = clean.lastIndexOf(".");
  const ext = dot >= 0 ? clean.slice(dot).toLowerCase() : "";
  if (!ALLOWED_UPLOAD_EXT.has(ext)) {
    return { ok: false, error: "Only .md or .zip skill files can be uploaded." };
  }
  return { ok: true };
}
