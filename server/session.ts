import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Pool } from "pg";

const DEV_SESSION_SECRET = "arc-intelligence-dev-secret";

/**
 * DDL for the login session table, mirroring connect-pg-simple's bundled
 * table.sql. Both statements are IF NOT EXISTS, so re-running this on every
 * deploy is a no-op that leaves existing sessions (i.e. everyone currently
 * signed in) intact.
 */
export const SESSION_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
  );
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`;

// Absolute cap on how long a session can live without activity. Because
// `rolling` is enabled below, this is a sliding window refreshed on every
// request rather than a hard deadline measured from login.
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface BuildSessionOptionsDeps {
  env?: NodeJS.ProcessEnv;
  /** Connection pool backing the session store. Required unless `store` is given. */
  pool?: Pool;
  /** Test seam: skip constructing the real Postgres-backed store. */
  store?: session.Store;
}

/**
 * Builds the express-session configuration.
 *
 * Sessions are persisted in Postgres rather than in the default in-process
 * MemoryStore. The deployment target is Replit Autoscale, which runs several
 * instances concurrently and restarts or scales them to zero freely — with
 * MemoryStore a session created on one instance is invisible to every other
 * instance and is destroyed on restart, so authenticated requests intermittently
 * returned 401 from requireAuth.
 */
export function buildSessionOptions(
  deps: BuildSessionOptionsDeps = {}
): session.SessionOptions {
  const env = deps.env ?? process.env;
  const isProduction = env.NODE_ENV === "production";
  const secret = env.SESSION_SECRET;

  // A default secret is fine for local development, but in production it would
  // mean signing cookies with a value that is committed to this repository —
  // anyone could forge a session. Fail fast instead of starting up insecurely.
  if (isProduction && !secret) {
    throw new Error(
      "SESSION_SECRET must be set in production. Without it, session cookies " +
        "would be signed with a publicly known development secret."
    );
  }

  let store = deps.store;
  if (!store) {
    if (!deps.pool) {
      throw new Error("buildSessionOptions requires either a `pool` or a `store`.");
    }
    const PgStore = connectPgSimple(session);
    store = new PgStore({
      // Reuse the application's existing pool rather than opening a second one.
      pool: deps.pool,
      tableName: "session",
      // The table is created by storage.ensureSessionTable() before this
      // middleware mounts, so the store never needs to create it lazily.
      createTableIfMissing: false,
      // Sweep expired rows every 15 minutes. connect-pg-simple randomizes the
      // actual delay so concurrent instances don't all prune in lockstep.
      pruneSessionInterval: 15 * 60,
    });
  }

  return {
    store,
    secret: secret || DEV_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // Refresh the cookie's expiry on each response so an actively used session
    // is not cut off 24h after login.
    rolling: true,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_MS,
      sameSite: "lax",
    },
  };
}
