import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { getUploadBaseDir } from '@/lib/file-upload';
import { isSpacesEnabled, presignGet, urlPathToKey } from '@/lib/storage-driver';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

// Content type mapping for the local-disk fallback. Spaces sets the
// Content-Type at upload time so the presigned-redirect branch doesn't
// need this table.
const contentTypes: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

// GET /api/uploads/[...path] — Serve uploaded files.
//
// Two backends, chosen per-request from env:
//   1. Spaces driver (SPACES_* env vars set): generate a short-lived
//      presigned GET URL for the same object key and 302 the browser to
//      it. Bytes come straight from DO Spaces / its CDN.
//   2. Local disk fallback (no Spaces env): read from getUploadBaseDir()
//      and stream the bytes. Historical behaviour, used in dev.
//
// DB rows store relative paths like `/uploads/artifacts/foo.png`
// regardless of backend, so toggling Spaces on / off requires no data
// migration.
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { path: pathSegments } = await context.params;

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    const relativePath = pathSegments.join('/');

    // ── Backend A: Spaces presigned redirect ────────────────────────────────
    if (isSpacesEnabled()) {
      const key = urlPathToKey(`/uploads/${relativePath}`);
      const signedUrl = await presignGet(key);
      if (signedUrl) {
        // 302 so the browser follows but doesn't cache the signed URL.
        // The underlying object's Cache-Control handles byte-level caching.
        return NextResponse.redirect(signedUrl, 302);
      }
      // Spaces was enabled but presign returned null — extremely unusual
      // (would mean env vars went away mid-request). Fall through to disk
      // rather than 500 so a misconfiguration isn't a hard outage.
      console.warn('[uploads] Spaces enabled but presign returned null — falling back to disk');
    }

    // ── Backend B: Local disk ───────────────────────────────────────────────
    const uploadsDir = getUploadBaseDir();
    const filePath = path.join(uploadsDir, relativePath);

    // Security check: ensure the path doesn't escape the uploads directory
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(uploadsDir))) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 403 });
    }

    try {
      await stat(filePath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);

    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes[ext] || 'application/octet-stream';
    const fileName = path.basename(filePath);

    const inlineTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.txt'];
    const disposition = inlineTypes.includes(ext) ? 'inline' : 'attachment';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
