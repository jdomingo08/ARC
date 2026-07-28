import { Client } from "@replit/object-storage";
import type { Readable } from "stream";

// The Client constructor eagerly starts resolving the default bucket through the
// Replit sidecar. Constructed at module scope, a failed resolution rejects with
// nothing awaiting it — an unhandled rejection, which terminates the process.
// Because routes.ts imports this module at startup, an unreachable sidecar took
// the whole instance down at boot rather than failing the one request that
// needed storage.
//
// Constructing lazily means the rejection surfaces inside an awaited call, where
// withStorageContext() can catch it and turn it into an ordinary error response.
let client: Client | undefined;

function getClient(): Client {
  if (!client) {
    client = new Client();
  }
  return client;
}

export function isLegacyDiskPath(storagePath: string): boolean {
  return storagePath.startsWith("/") || storagePath.includes("/uploads/");
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/]+/g, "_").replace(/^\.+/, "_");
}

export function buildRequestKey(requestId: string, fileName: string): string {
  return `requests/${requestId}/${Date.now()}-${safeFileName(fileName)}`;
}

export function buildPlatformKey(platformId: string, fileName: string): string {
  return `platforms/${platformId}/${Date.now()}-${safeFileName(fileName)}`;
}

/**
 * The client resolves its bucket through the Replit sidecar on first use. When
 * the sidecar is unreachable — object storage not attached to the deployment,
 * or running off-Replit — that surfaces as a bare `fetch failed` with no
 * indication of what failed or why, both in the API response and the logs.
 * Wrap it so the cause is stated.
 */
async function withStorageContext<T>(operation: string, fn: (c: Client) => Promise<T>): Promise<T> {
  try {
    return await fn(getClient());
  } catch (err: any) {
    // Drop the cached client so a failed initialization isn't reused: its
    // internal init promise stays rejected and would keep emitting strays.
    client = undefined;

    const detail = err?.message || String(err);
    const hint =
      /fetch failed|ECONNREFUSED|running on Replit|default bucket/i.test(detail)
        ? " Could not reach Replit Object Storage — check that a bucket is attached to this deployment."
        : "";
    throw new Error(`Object storage ${operation} failed: ${detail}.${hint}`);
  }
}

export async function putObject(key: string, buffer: Buffer): Promise<void> {
  const result = await withStorageContext("upload", (c) =>
    c.uploadFromBytes(key, buffer)
  );
  if (!result.ok) {
    throw new Error(`Object storage upload failed: ${result.error.message}`);
  }
}

export async function deleteObject(key: string): Promise<void> {
  const result = await withStorageContext("delete", (c) => c.delete(key));
  if (!result.ok) {
    throw new Error(`Object storage delete failed: ${result.error.message}`);
  }
}

export function getObjectStream(key: string): Readable {
  return getClient().downloadAsStream(key);
}

export async function objectExists(key: string): Promise<boolean> {
  const result = await withStorageContext("exists check", (c) => c.exists(key));
  if (!result.ok) {
    throw new Error(`Object storage exists check failed: ${result.error.message}`);
  }
  return result.value;
}
