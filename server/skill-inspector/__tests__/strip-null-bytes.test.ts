import { describe, it, expect } from "vitest";
import { stripNullBytes } from "../inspector";

const NUL = String.fromCharCode(0);

describe("stripNullBytes", () => {
  it("removes NUL chars so the result is valid for Postgres jsonb", () => {
    const dirty = `{"finding":"bad${NUL}byte","ok":"clean"}`;
    const clean = stripNullBytes(dirty);
    expect(clean.includes(NUL)).toBe(false);
    // still parseable, and re-serializing carries no NUL (which jsonb rejects)
    const obj = JSON.parse(clean);
    expect(obj.finding).toBe("badbyte");
    expect(JSON.stringify(obj).includes(NUL)).toBe(false);
  });

  it("leaves NUL-free text unchanged", () => {
    const text = `{"a":1,"b":"hello world"}`;
    expect(stripNullBytes(text)).toBe(text);
  });

  it("removes multiple NULs", () => {
    expect(stripNullBytes(`${NUL}a${NUL}${NUL}b${NUL}`)).toBe("ab");
  });
});
