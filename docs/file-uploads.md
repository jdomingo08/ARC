# File uploads

Attachments are held in Replit Object Storage, not on disk — the deployment
filesystem is ephemeral, so a Publish used to wipe uploaded files while the
database rows survived. `server/object-storage.ts` wraps the client;
`storagePath` on an attachment row holds either a bucket key (current) or a
legacy local path (pre-migration), told apart by `isLegacyDiskPath()`.

## Upload surfaces

| Route | Purpose |
|-------|---------|
| `POST /api/requests/:id/attachments` | Supporting docs on a request, per section |
| `POST /api/platforms/:id/attachments` | Docs attached to a platform |
| `POST /api/skill-inspector/scan` | Skill archive submitted for scanning |

All three use `uploadSingle("file")`, which wraps multer and translates its
rejections into accurate status codes.

## Size limit

`MAX_UPLOAD_MB` (default `10`) sets the cap. Exceeding it returns **413** with a
message naming the limit, rather than the bare `500 File too large` that multer's
default error path produced. Raise it on the deployment if vendor security
packets are being rejected — large SOC 2 reports clear 10 MB routinely.

## Diagnosing a failed upload

The client surfaces the response body directly in the "Upload failed" toast, and
`server/index.ts` logs every `/api` response, so the Replit deployment log
carries the same text:

```
POST /api/requests/<id>/attachments 500 in 42ms :: {"message":"..."}
```

| Message | Cause |
|---------|-------|
| `File is larger than the N MB upload limit` | Over `MAX_UPLOAD_MB` |
| `Object storage upload failed: ... Could not reach Replit Object Storage` | Sidecar unreachable or no bucket attached to the deployment |
| `Upload rejected (LIMIT_...)` | Other multer rejection, e.g. unexpected field name |
| `No file uploaded` | Form field was not named `file` |
| `Not authenticated` | No valid session — see [session-storage.md](./session-storage.md) |
| `Cannot upload yet` (toast only, no request sent) | Draft request not created yet, so there is no ID to attach to |

## Why the client is constructed lazily

`new Client()` eagerly starts resolving the default bucket through the Replit
sidecar. At module scope, a failed resolution rejected with nothing awaiting it —
and Node terminates the process on an unhandled rejection. Since `routes.ts`
imports this module at startup, an unreachable sidecar **killed the instance at
boot**, before any upload was attempted. On Autoscale that means a crash loop,
and while sessions lived in memory it also wiped every logged-in session on each
restart.

The client is therefore created on first use, inside `withStorageContext()`, so
the failure lands in a `try`/`catch` and becomes an ordinary error response. A
failed client is discarded rather than cached, since its internal init promise
stays rejected and would keep emitting stray rejections.

`server/index.ts` additionally installs a `process.on("unhandledRejection")`
handler, so a stray rejection from any dependency logs instead of taking the
instance down.

`server/__tests__/object-storage.test.ts` guards both behaviors by running a
child process with `REPLIT_SIDECAR_ENDPOINT` pointed at a closed port. It needs
no database and no bucket.
