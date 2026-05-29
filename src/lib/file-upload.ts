import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { isSpacesEnabled, uploadToSpaces, urlPathToKey } from './storage-driver';

/**
 * Get the base upload directory for the LOCAL-DISK driver only.
 * On Vercel (serverless), uses /tmp which is the only writable directory.
 * Locally, uses process.cwd()/uploads.
 *
 * When the Spaces driver is active, the disk write below is a best-effort
 * backup that nothing else reads; this base dir is still where it lands.
 */
export function getUploadBaseDir(): string {
  if (process.env.VERCEL) {
    return '/tmp/uploads';
  }
  return path.join(process.cwd(), 'uploads');
}

/**
 * Save a file and return the relative URL path used everywhere in the app.
 *
 * Resolution order:
 *   1. If Spaces is configured (SPACES_ENDPOINT + SPACES_REGION +
 *      SPACES_BUCKET + SPACES_KEY + SPACES_SECRET), upload to the bucket.
 *      A best-effort local disk write also runs so dev tooling that pokes
 *      around `uploads/` keeps finding files, but reads no longer depend
 *      on it — the serve route at /api/uploads/[...path] presigns from
 *      Spaces when the env is set.
 *   2. Otherwise write to disk only (historical behaviour).
 *
 * The returned `urlPath` is always `/uploads/<subDir>/<fileName>` so the
 * value stored in the DB is portable across drivers — no migration is
 * needed when toggling Spaces on or off.
 *
 * The returned `buffer` lets callers persist the bytes inline in the DB
 * for belt-and-braces durability (some routes already do this for small /
 * sensitive payloads).
 */
export async function saveUploadedFile(
  file: File,
  subDir: string
): Promise<{ diskPath: string; urlPath: string; fileName: string; buffer: Buffer }> {
  const timestamp = Date.now();
  const originalName = file.name;
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const fileName = `${baseName}_${timestamp}${ext}`;

  // Read file buffer first (this always works)
  const buffer = Buffer.from(await file.arrayBuffer());

  const baseDir = getUploadBaseDir();
  const uploadDir = path.join(baseDir, subDir);
  const diskPath = path.join(uploadDir, fileName);
  const urlPath = `/uploads/${subDir}/${fileName}`;

  // ── Path A: Spaces driver ────────────────────────────────────────────────
  if (isSpacesEnabled()) {
    try {
      await uploadToSpaces(urlPathToKey(urlPath), buffer, file.type || undefined);
    } catch (err) {
      // If Spaces is configured but the upload fails, the user's request
      // must fail loudly — a half-written DB row pointing at a non-existent
      // object is exactly the bug this driver was added to eliminate.
      throw new Error(
        `Storage error: failed to upload ${fileName} to Spaces: ${(err as Error).message}`
      );
    }
    // Best-effort local write for dev tooling that pokes at uploads/.
    try {
      await mkdir(uploadDir, { recursive: true });
      await writeFile(diskPath, buffer);
    } catch { /* non-fatal */ }
    return { diskPath, urlPath, fileName, buffer };
  }

  // ── Path B: Local-disk only ──────────────────────────────────────────────
  try {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(diskPath, buffer);
  } catch (err) {
    console.warn(`[file-upload] Disk write failed for ${fileName} (non-fatal on serverless):`, err);
  }

  return { diskPath, urlPath, fileName, buffer };
}
