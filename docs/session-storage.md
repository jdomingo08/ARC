# Session storage

Login sessions are stored in Postgres, in a table named `session`, via
[`connect-pg-simple`](https://github.com/voxpelli/node-connect-pg-simple).

## Why not the default store

`express-session` falls back to an in-process `MemoryStore` when no `store` is
configured. That is incompatible with how this app is deployed: `.replit` sets
`deploymentTarget = "autoscale"`, so production runs **multiple instances
concurrently** and restarts or scales them to zero freely.

With `MemoryStore` that produced intermittent, hard-to-read `401`s:

1. A user signs in — the session is written to instance A's heap, and the
   browser gets a cookie.
2. The next XHR is routed to instance B, which has no record of that session ID.
   `requireAuth` sees `req.session.userId === undefined` and returns
   `401 Not authenticated`.
3. Any redeploy, crash, or scale-to-zero drops every session at once.

The symptom was a burst of console errors like:

```
/api/requests/draft:1  Failed to load resource: the server responded with a status of 401 ()
/api/requests:1        Failed to load resource: the server responded with a status of 401 ()
```

Requests that happened to land on the instance holding the session succeeded,
which is why the failures looked random. The `/api/requests/draft` case was the
costly one: it is the new-request autosave, so a lost session meant lost
form input.

## How it is wired

- `server/session.ts` — `buildSessionOptions()` builds the `express-session`
  config: the Postgres store, `rolling: true`, and secure cookie flags. It also
  exports `SESSION_TABLE_DDL`.
- `server/storage.ts` — `ensureSessionTable()` runs `SESSION_TABLE_DDL`.
- `server/routes.ts` — awaits `ensureSessionTable()` **before** mounting the
  session middleware, then mounts `session(buildSessionOptions({ pool }))`.

The store reuses the application's existing `pg.Pool` from `server/db.ts` rather
than opening a second one.

## Two things to be careful about

**1. The `session` table is declared in `shared/schema.ts`.**

Drizzle does not read or write this table — `connect-pg-simple` owns it. It is
declared anyway because `drizzle-kit push` drops tables it finds in the database
but not in the schema. Without the declaration, `npm run db:push` silently
executes `DROP TABLE "session"` and signs out every logged-in user. If you
change the table, keep the Drizzle definition, `SESSION_TABLE_DDL`, and
connect-pg-simple's own `table.sql` in agreement.

**2. `SESSION_SECRET` is required in production.**

`buildSessionOptions()` throws at startup if `NODE_ENV=production` and
`SESSION_SECRET` is unset, rather than falling back to the development default —
that default is committed to this repository, so anyone could forge a session
cookie signed with it. Set it in Replit Secrets before deploying. Changing it
invalidates all existing cookies and forces everyone to sign in again.

## Expiry

`cookie.maxAge` is 24 hours and `rolling: true` is set, so the window is sliding
and refreshed on each response — an active user is not cut off 24 hours after
signing in. Expired rows are swept by connect-pg-simple every ~15 minutes, with
a randomized delay so concurrent instances don't all prune at once.

## Tests

- `server/__tests__/session.test.ts` — config unit tests, no database needed.
- `server/__tests__/session-store.integration.test.ts` — requires a throwaway
  Postgres and is skipped unless `TEST_DATABASE_URL` is set. Covers the two
  failure modes above (cross-instance sharing, restart survival) plus migration
  idempotency and expiry.

```bash
TEST_DATABASE_URL="postgres://user@host:5432/scratch_db" npm test
```

Point it at a scratch database: the suite runs `DELETE FROM "session"` between
tests.
