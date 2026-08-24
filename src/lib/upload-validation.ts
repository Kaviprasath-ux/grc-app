/**
 * Upload validation — single source of truth for allowed file types.
 *
 * SECURITY: the SERVER-SIDE check (validateUploadedFile) is the
 * authoritative gate. The client-side helpers (`accept` attribute,
 * <FileInput> validation) exist for UX only; a malicious or
 * misbehaving client can always bypass them.
 *
 * Policy: allow non-executable business documents and raster images.
 * Excluded on purpose even though technically "non-executable":
 *   - .svg  — can carry JavaScript
 *   - .html/.htm/.xml — script + XXE carriers
 *   - .zip/.rar/.7z/.tar/.gz — bundle executables
 *   - anything OS-executable (.exe .dll .bat .cmd .sh .ps1 .msi
 *     .apk .ipa .jar .app .scr .com .vbs .wsf .lnk .cpl .msc)
 *   - source scripts (.js .ts .py .rb .pl .php)
 */

// Extensions are stored lowercase, with the leading dot.
export const ALLOWED_EXTENSIONS: readonly string[] = [
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.rtf', '.odt', '.ods', '.odp',
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
  // Visio
  '.vsd', '.vsdx',
] as const;

// MIME types we trust from the client — used as a secondary signal
// only; the extension check is authoritative because browsers
// disagree on Office MIME types.
export const ALLOWED_MIME_TYPES: readonly string[] = [
  // PDF
  'application/pdf',
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Plain text / CSV / RTF
  'text/plain',
  'text/csv',
  'application/csv',
  'application/rtf',
  'text/rtf',
  // OpenDocument
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  // Visio
  'application/vnd.visio',
  'application/vnd.ms-visio.drawing',
  'application/vnd.ms-visio.drawing.main+xml',
] as const;

/**
 * String used as the `accept` attribute on `<input type="file">`.
 * Includes both extensions and MIME types so browsers using either
 * hint filter correctly in the native file picker.
 */
export const ACCEPT_ATTRIBUTE: string = [
  ...ALLOWED_EXTENSIONS,
  ...ALLOWED_MIME_TYPES,
].join(',');

/** Human-readable list for error messages. */
export const ALLOWED_EXTENSIONS_LABEL: string = ALLOWED_EXTENSIONS
  .map(e => e.slice(1).toUpperCase())
  .join(', ');

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export interface UploadValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validate one client-supplied file. Rejects when the extension is
 * not on the allowlist. MIME check runs only as a secondary signal;
 * if the browser sent a MIME type we do NOT recognize we still fall
 * back on the extension (some browsers report `application/octet-
 * stream` for .docx and .vsdx). If the client sends an obviously
 * hostile MIME we reject even when the extension is renamed.
 *
 * Works with both browser `File` objects and any `{ name, type? }`
 * shape (useful for server-side Formidable / Multer parsed files).
 */
export function validateUploadedFile(
  file: { name: string; type?: string | null } | null | undefined,
): UploadValidationResult {
  if (!file || !file.name) {
    return { ok: false, reason: 'No file provided' };
  }

  const ext = extensionOf(file.name);
  if (!ext) {
    return { ok: false, reason: `Files without an extension are not allowed. Allowed types: ${ALLOWED_EXTENSIONS_LABEL}.` };
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { ok: false, reason: `"${ext}" files are not allowed. Allowed types: ${ALLOWED_EXTENSIONS_LABEL}.` };
  }

  // Secondary MIME check — only reject when the client openly claims
  // an executable/script MIME. Missing or generic MIMEs are OK.
  const mime = (file.type || '').toLowerCase();
  if (mime && HOSTILE_MIME_PATTERNS.some(rx => rx.test(mime))) {
    return { ok: false, reason: 'The file appears to be executable and is blocked.' };
  }

  return { ok: true };
}

const HOSTILE_MIME_PATTERNS: readonly RegExp[] = [
  /^application\/x-(msdownload|dosexec|executable|sh|shellscript|bat|elf|mach-binary)$/,
  /^application\/(x-)?(msi|apk|java-archive|x-java-applet)$/,
  /^application\/x-python(-code)?$/,
  /^application\/javascript$/,
  /^text\/(html|xml|x-shellscript|x-python|x-perl|x-ruby|javascript)$/,
  /^application\/vnd\.microsoft\.portable-executable$/,
];

/**
 * Validate a batch. Returns the first offender's reason so upload
 * handlers can respond with a single clean 400.
 */
export function validateUploadedFiles(
  files: ReadonlyArray<{ name: string; type?: string | null } | null | undefined>,
): UploadValidationResult {
  for (const f of files) {
    const r = validateUploadedFile(f);
    if (!r.ok) return r;
  }
  return { ok: true };
}
