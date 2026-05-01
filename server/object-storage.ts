import { Client } from "@replit/object-storage";
import type { Readable } from "stream";

const client = new Client();

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

export async function putObject(key: string, buffer: Buffer): Promise<void> {
  const result = await client.uploadFromBytes(key, buffer);
  if (!result.ok) {
    throw new Error(`Object storage upload failed: ${result.error.message}`);
  }
}

export async function deleteObject(key: string): Promise<void> {
  const result = await client.delete(key);
  if (!result.ok) {
    throw new Error(`Object storage delete failed: ${result.error.message}`);
  }
}

export function getObjectStream(key: string): Readable {
  return client.downloadAsStream(key);
}

export async function objectExists(key: string): Promise<boolean> {
  const result = await client.exists(key);
  if (!result.ok) {
    throw new Error(`Object storage exists check failed: ${result.error.message}`);
  }
  return result.value;
}
