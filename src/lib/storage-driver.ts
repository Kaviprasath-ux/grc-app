/**
 * Storage driver — abstracts file persistence between local disk and
 * DigitalOcean Spaces (S3-compatible object storage).
 *
 * When ALL the SPACES_* env vars are set, the driver writes to the bucket
 * and serves files via short-lived presigned GET URLs. Otherwise it falls
 * back to the historical local-disk behaviour (process.cwd()/uploads on
 * a normal Node host, /tmp/uploads under serverless), so local dev and
 * standalone droplet deployments keep working unchanged.
 *
 * The URL written into the DB is always relative (`/uploads/<subDir>/<file>`),
 * regardless of driver. That keeps existing DB rows portable across
 * disk-only ↔ S3 — no data migration is needed when flipping the env vars.
 * The serve route (`/api/uploads/[...path]`) is the single place that knows
 * how to translate the relative URL back into bytes:
 *   - Disk driver  → read from filesystem, stream bytes.
 *   - Spaces driver → presign a GET for the same object key, return 302.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import fs from "fs/promises";

// ---- Configuration ----------------------------------------------------------

interface SpacesConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Optional CDN URL prefix. If set, public reads can be served directly from
   * here without hitting the API at all (e.g. https://<bucket>.<region>.cdn.digitaloceanspaces.com).
   * Currently unused — we always use presigned URLs so the bucket can be
   * private — but kept here so a future fast path can be added cheaply.
   */
  publicUrl?: string;
}

let _config: SpacesConfig | null | undefined;

function readSpacesConfig(): SpacesConfig | null {
  if (_config !== undefined) return _config;
  const endpoint = process.env.SPACES_ENDPOINT;
  const region = process.env.SPACES_REGION;
  const bucket = process.env.SPACES_BUCKET;
  const accessKeyId = process.env.SPACES_KEY;
  const secretAccessKey = process.env.SPACES_SECRET;
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    _config = null;
    return null;
  }
  _config = {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicUrl: process.env.SPACES_PUBLIC_URL || undefined,
  };
  return _config;
}

export function isSpacesEnabled(): boolean {
  return readSpacesConfig() !== null;
}

let _client: S3Client | null = null;

function getClient(cfg: SpacesConfig): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    // Required for S3-compatible providers like DO Spaces / MinIO.
    forcePathStyle: false,
  });
  return _client;
}

// ---- Key helpers ------------------------------------------------------------

/**
 * Convert a relative URL path (`/uploads/subDir/file.png`) into an object key
 * (`uploads/subDir/file.png`) for S3-style storage. Strips any leading slash.
 */
export function urlPathToKey(urlPath: string): string {
  return urlPath.replace(/^\/+/, "");
}

/**
 * Inverse: given an object key, return the relative URL path that the app
 * uses everywhere else.
 */
export function keyToUrlPath(key: string): string {
  return `/${key.replace(/^\/+/, "")}`;
}

// ---- Write path -------------------------------------------------------------

/**
 * Upload an object to Spaces. The key is the URL-path with the leading slash
 * stripped (`uploads/<subDir>/<fileName>`). Content-type is best-effort —
 * common extensions are mapped; everything else falls back to octet-stream.
 *
 * Returns void on success; throws on failure. Callers should handle disk
 * fallback themselves if they want graceful degradation.
 */
export async function uploadToSpaces(
  key: string,
  buffer: Buffer,
  contentType?: string
): Promise<void> {
  const cfg = readSpacesConfig();
  if (!cfg) throw new Error("Spaces not configured");
  const client = getClient(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || guessContentType(key),
      // Bucket-level ACL is left as the default (private). Reads happen via
      // presigned URLs from the serve route below.
    })
  );
}

// ---- Read path --------------------------------------------------------------

/**
 * Generate a short-lived presigned GET URL for the given key. Returns null
 * if Spaces isn't configured. The expiresSeconds default of 5 minutes is
 * long enough for a browser to follow the 302 redirect but short enough
 * that a leaked URL is mostly harmless.
 */
export async function presignGet(
  key: string,
  expiresSeconds = 300
): Promise<string | null> {
  const cfg = readSpacesConfig();
  if (!cfg) return null;
  const client = getClient(cfg);
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    { expiresIn: expiresSeconds }
  );
}

/**
 * Check whether an object exists in the bucket. Used by migration scripts
 * to skip files that have already been uploaded.
 */
export async function existsInSpaces(key: string): Promise<boolean> {
  const cfg = readSpacesConfig();
  if (!cfg) return false;
  const client = getClient(cfg);
  try {
    await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove an object from the bucket. No-op if Spaces isn't configured.
 */
export async function deleteFromSpaces(key: string): Promise<void> {
  const cfg = readSpacesConfig();
  if (!cfg) return;
  const client = getClient(cfg);
  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

/**
 * List all keys under a prefix. Used by the migration script and ops tools.
 * Returns up to `maxKeys` results; pass undefined for unbounded.
 */
export async function listSpaces(prefix: string, maxKeys?: number): Promise<string[]> {
  const cfg = readSpacesConfig();
  if (!cfg) return [];
  const client = getClient(cfg);
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: maxKeys && maxKeys - keys.length > 0 ? Math.min(1000, maxKeys - keys.length) : 1000,
      })
    );
    for (const obj of resp.Contents || []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    if (maxKeys && keys.length >= maxKeys) break;
  } while (continuationToken);
  return keys;
}

// ---- Content-type guessing -------------------------------------------------

const CT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".zip": "application/zip",
};

function guessContentType(keyOrName: string): string {
  const ext = path.extname(keyOrName).toLowerCase();
  return CT[ext] || "application/octet-stream";
}

// Re-export for callers that want to derive their own content types.
export { guessContentType };

// ---- Local-disk read helper (used by serve route fallback) -----------------

/**
 * Read a file from local disk under the configured upload base dir. Returns
 * null if it doesn't exist. Kept here so the serve route can ask the
 * "current driver" for the file without branching on env vars directly.
 */
export async function readLocalFile(absolutePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(absolutePath);
  } catch {
    return null;
  }
}
