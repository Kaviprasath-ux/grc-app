import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * Get the base upload directory.
 * On Vercel (serverless), uses /tmp which is the only writable directory.
 * Locally, uses process.cwd()/uploads.
 */
export function getUploadBaseDir(): string {
  if (process.env.VERCEL) {
    return '/tmp/uploads';
  }
  return path.join(process.cwd(), 'uploads');
}

/**
 * Save a file to disk and return the relative URL path.
 * Handles directory creation automatically.
 * On Vercel, disk writes are best-effort (files are ephemeral in /tmp).
 * The returned buffer should be stored in DB for persistence.
 *
 * @param file - The File object from FormData
 * @param subDir - Subdirectory under uploads/ (e.g. 'documents', 'fieldwork/123/evidence')
 * @returns Object with diskPath (absolute) and urlPath (relative URL)
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

  // Attempt disk write (best-effort on Vercel; buffer is always returned for DB storage)
  try {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(diskPath, buffer);
  } catch (err) {
    console.warn(`[file-upload] Disk write failed for ${fileName} (non-fatal on serverless):`, err);
  }

  return { diskPath, urlPath, fileName, buffer };
}
