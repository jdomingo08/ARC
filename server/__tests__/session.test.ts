import { describe, it, expect } from "vitest";
import session from "express-session";
import pg from "pg";
import { buildSessionOptions } from "../session";

/** A stand-in store so tests never construct the real Postgres-backed one. */
const fakeStore = () => new session.MemoryStore();

// A pg Pool opens no connection until it is queried, so this is inert here.
const fakePool = () =>
  new pg.Pool({ connectionString: "postgres://unused@127.0.0.1:5432/unused" });

describe("buildSessionOptions", () => {
  it("persists sessions in a store rather than the default MemoryStore", async () => {
    const pool = fakePool();
    const opts = buildSessionOptions({
      env: { NODE_ENV: "production", SESSION_SECRET: "s3cret" },
      pool,
    });

    // The regression: with no `store`, express-session silently falls back to an
    // in-process MemoryStore, so sessions die on restart and are invisible to
    // sibling Autoscale instances.
    expect(opts.store).toBeDefined();
    expect(opts.store).not.toBeInstanceOf(session.MemoryStore);
    expect(opts.store!.constructor.name).toBe("PGStore");
    await pool.end();
  });

  it("refuses to start in production without SESSION_SECRET", async () => {
    expect(() =>
      buildSessionOptions({ env: { NODE_ENV: "production" }, store: fakeStore() })
    ).toThrow(/SESSION_SECRET must be set in production/);
  });

  it("never falls back to the committed dev secret in production", async () => {
    const opts = buildSessionOptions({
      env: { NODE_ENV: "production", SESSION_SECRET: "s3cret" },
      store: fakeStore(),
    });
    expect(opts.secret).toBe("s3cret");
    expect(opts.secret).not.toBe("arc-intelligence-dev-secret");
  });

  it("allows a default secret outside production", async () => {
    const opts = buildSessionOptions({
      env: { NODE_ENV: "development" },
      store: fakeStore(),
    });
    expect(opts.secret).toBe("arc-intelligence-dev-secret");
  });

  it("uses rolling expiry so active users are not logged out at 24h", async () => {
    const opts = buildSessionOptions({
      env: { NODE_ENV: "production", SESSION_SECRET: "s3cret" },
      store: fakeStore(),
    });
    expect(opts.rolling).toBe(true);
    expect(opts.cookie?.maxAge).toBe(24 * 60 * 60 * 1000);
  });

  it("sets secure, httpOnly, lax cookies in production", async () => {
    const opts = buildSessionOptions({
      env: { NODE_ENV: "production", SESSION_SECRET: "s3cret" },
      store: fakeStore(),
    });
    expect(opts.cookie?.secure).toBe(true);
    expect(opts.cookie?.httpOnly).toBe(true);
    expect(opts.cookie?.sameSite).toBe("lax");
  });

  it("does not require secure cookies in development (no TLS locally)", async () => {
    const opts = buildSessionOptions({
      env: { NODE_ENV: "development" },
      store: fakeStore(),
    });
    expect(opts.cookie?.secure).toBe(false);
  });

  it("keeps saveUninitialized off so anonymous hits don't create rows", async () => {
    const opts = buildSessionOptions({
      env: { NODE_ENV: "production", SESSION_SECRET: "s3cret" },
      store: fakeStore(),
    });
    expect(opts.saveUninitialized).toBe(false);
    expect(opts.resave).toBe(false);
  });
});
