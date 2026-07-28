import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { SESSION_TABLE_DDL } from "../session";

// Requires a throwaway Postgres. Skipped when TEST_DATABASE_URL is unset so the
// default `npm test` run stays hermetic.
const CONN = process.env.TEST_DATABASE_URL;

const PgStore = connectPgSimple(session);

/** Simulates one Autoscale instance: its own pool and its own store object. */
function makeInstance() {
  const pool = new pg.Pool({ connectionString: CONN });
  const store = new PgStore({
    pool,
    tableName: "session",
    createTableIfMissing: false,
    pruneSessionInterval: false,
  });
  return { pool, store };
}

const setSession = (store: session.Store, sid: string, data: any) =>
  new Promise<void>((resolve, reject) =>
    store.set(sid, data, (err) => (err ? reject(err) : resolve()))
  );

const getSession = (store: session.Store, sid: string) =>
  new Promise<any>((resolve, reject) =>
    store.get(sid, (err, sess) => (err ? reject(err) : resolve(sess)))
  );

const A_SESSION = (userId: string) => ({
  cookie: {
    originalMaxAge: 86400000,
    expires: new Date(Date.now() + 86400000).toISOString(),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  },
  userId,
});

describe.skipIf(!CONN)("session persistence (integration)", () => {
  let admin: pg.Pool;

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: CONN });
    await admin.query(SESSION_TABLE_DDL);
  });

  afterAll(async () => {
    await admin.end();
  });

  beforeEach(async () => {
    await admin.query('DELETE FROM "session"');
  });

  it("creates a table connect-pg-simple can round-trip through", async () => {
    const { pool, store } = makeInstance();
    try {
      await setSession(store, "sid-roundtrip", A_SESSION("user-1"));
      const loaded = await getSession(store, "sid-roundtrip");
      expect(loaded?.userId).toBe("user-1");
    } finally {
      await pool.end();
    }
  });

  // This is the production bug: with the in-process MemoryStore, a session
  // created while serving instance A does not exist on instance B, so the next
  // request to land on B fails requireAuth with 401.
  it("shares a session across two concurrent instances", async () => {
    const a = makeInstance();
    const b = makeInstance();
    try {
      await setSession(a.store, "sid-shared", A_SESSION("user-2"));
      const seenByB = await getSession(b.store, "sid-shared");
      expect(seenByB?.userId).toBe("user-2");
    } finally {
      await a.pool.end();
      await b.pool.end();
    }
  });

  // The other half of the bug: redeploys and scale-to-zero wiped every session.
  it("keeps a session alive across a process restart", async () => {
    const before = makeInstance();
    await setSession(before.store, "sid-restart", A_SESSION("user-3"));
    await before.pool.end(); // process exits; heap is gone

    const after = makeInstance();
    try {
      const loaded = await getSession(after.store, "sid-restart");
      expect(loaded?.userId).toBe("user-3");
    } finally {
      await after.pool.end();
    }
  });

  it("is idempotent and preserves existing sessions when re-run", async () => {
    const { pool, store } = makeInstance();
    try {
      await setSession(store, "sid-survivor", A_SESSION("user-4"));

      // Re-running the startup migration must not disturb live sessions.
      await admin.query(SESSION_TABLE_DDL);
      await admin.query(SESSION_TABLE_DDL);

      const loaded = await getSession(store, "sid-survivor");
      expect(loaded?.userId).toBe("user-4");
    } finally {
      await pool.end();
    }
  });

  it("does not resurrect expired sessions", async () => {
    const { pool, store } = makeInstance();
    try {
      await setSession(store, "sid-expired", A_SESSION("user-5"));
      await admin.query(
        `UPDATE "session" SET expire = NOW() - INTERVAL '1 hour' WHERE sid = 'sid-expired'`
      );
      const loaded = await getSession(store, "sid-expired");
      expect(loaded ?? null).toBeNull();
    } finally {
      await pool.end();
    }
  });
});
