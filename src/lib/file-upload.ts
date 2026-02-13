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
 *
 * @param file - The File object from FormData
 * @param subDir - Subdirectory under uploads/ (e.g. 'documents', 'fieldwork/123/evidence')
 * @returns Object with diskPath (absolute) and urlPath (relative URL)
 */
export async function saveUploadedFile(
  file: File,
  subDir: string
): Promise<{ diskPath: string; urlPath: string; fileName: string; buffer: Buffer }> {
  const baseDir = getUploadBaseDir();
  const uploadDir = path.join(baseDir, subDir);
  await mkdir(uploadDir, { recursive: true });

  const timestamp = Date.now();
  const originalName = file.name;
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const fileName = `${baseName}_${timestamp}${ext}`;
  const diskPath = path.join(uploadDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buffer);

  const urlPath = `/uploads/${subDir}/${fileName}`;

  return { diskPath, urlPath, fileName, buffer };
}
