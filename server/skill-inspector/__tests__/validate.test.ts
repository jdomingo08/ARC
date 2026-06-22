import { describe, it, expect } from "vitest";
import { validateGitHubUrl, validateUploadName } from "../validate";

describe("validateGitHubUrl", () => {
  it("accepts a normal github https repo url", () => {
    expect(validateGitHubUrl("https://github.com/NVIDIA/SkillSpector")).toEqual({
      ok: true,
      url: "https://github.com/NVIDIA/SkillSpector",
    });
  });

  it("accepts a trailing .git and trims whitespace", () => {
    const r = validateGitHubUrl("  https://github.com/owner/repo.git  ");
    expect(r.ok).toBe(true);
  });

  it("rejects non-https schemes", () => {
    expect(validateGitHubUrl("http://github.com/owner/repo").ok).toBe(false);
    expect(validateGitHubUrl("file:///etc/passwd").ok).toBe(false);
  });

  it("rejects non-github hosts (SSRF guard)", () => {
    expect(validateGitHubUrl("https://gitlab.com/owner/repo").ok).toBe(false);
    expect(validateGitHubUrl("https://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(validateGitHubUrl("https://localhost/owner/repo").ok).toBe(false);
  });

  it("rejects embedded credentials and non-standard ports", () => {
    expect(validateGitHubUrl("https://user:pass@github.com/owner/repo").ok).toBe(false);
    expect(validateGitHubUrl("https://github.com@evil.com/owner/repo").ok).toBe(false);
    expect(validateGitHubUrl("https://github.com:8080/owner/repo").ok).toBe(false);
  });

  it("rejects urls without an owner/repo path", () => {
    expect(validateGitHubUrl("https://github.com/").ok).toBe(false);
    expect(validateGitHubUrl("https://github.com/owner").ok).toBe(false);
  });

  it("rejects garbage", () => {
    expect(validateGitHubUrl("not a url").ok).toBe(false);
    expect(validateGitHubUrl("").ok).toBe(false);
  });
});

describe("validateUploadName", () => {
  it("accepts .md and .zip", () => {
    expect(validateUploadName("SKILL.md").ok).toBe(true);
    expect(validateUploadName("my-skill.zip").ok).toBe(true);
  });
  it("rejects other extensions", () => {
    expect(validateUploadName("evil.sh").ok).toBe(false);
    expect(validateUploadName("noext").ok).toBe(false);
  });
  it("rejects path-traversal-ish names", () => {
    expect(validateUploadName("../../etc/passwd.md").ok).toBe(false);
  });
});
