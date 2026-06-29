# File Uploads

## Table of Contents

1. [File Uploads in Web Applications](#file-uploads-in-web-applications)
2. [How Files Are Stored in This Project](#how-files-are-stored-in-this-project)
3. [Multipart Form Data](#multipart-form-data)
4. [How the API Receives Files](#how-the-api-receives-files)
5. [File Size Limits and Type Restrictions](#file-size-limits-and-type-restrictions)
6. [Encrypted File Storage](#encrypted-file-storage)
7. [How Encryption Applies to File Data](#how-encryption-applies-to-file-data)
8. [Models with fileData Columns](#models-with-filedata-columns)
9. [Retrieving and Serving Files](#retrieving-and-serving-files)
10. [File Management — Delete and Update](#file-management--delete-and-update)
11. [Best Practices](#best-practices)
12. [Common File Upload Errors](#common-file-upload-errors)

---

## File Uploads in Web Applications

A **file upload** is the process of sending a file from a user's computer (or mobile device) to a server so it can be stored and later retrieved. Examples of file uploads in GRC applications:

- An auditor uploading a PDF evidence document to support a compliance control.
- An auditee uploading a spreadsheet in response to an evidence request.
- A compliance officer uploading a signed policy document for the governance vault.
- An asset manager uploading a certificate of purchase for an asset record.

### The Technical Challenge

Files are different from regular form data (text, numbers). They are binary data — sequences of bytes that represent images, PDFs, spreadsheets, or other formats. Transmitting binary data in an HTTP request requires a special encoding called **multipart form data** (described below).

Once received by the server, the file data must be:
1. Validated (correct type? within size limit?).
2. Stored somewhere (file system, database, or cloud storage).
3. Protected (encrypted if sensitive; access-controlled).
4. Made retrievable (a download endpoint must exist).

---

## How Files Are Stored in This Project

The GRC application uses a **hybrid storage approach**:

### Approach 1: File System (`uploads/` directory)

For non-encrypted files and legacy storage, files are written to the `uploads/` directory at the project root:

```
grc-app/
  uploads/
    evidence/
      clx9z2abc-access-review.pdf
    governance/
      clx7y1xyz-security-policy-v3.docx
    audit/
      clx_eng_001/
        workpaper-001.xlsx
```

**When used:** For non-sensitive attachments or when encryption is not required.

**Retrieval:** Files are served via a dedicated file-serving API route or Next.js static serving.

### Approach 2: Database Bytes Column (`fileData Bytes`)

For sensitive files, the entire binary content is stored **inside the database** in a `Bytes` column. This is the primary approach for all documents that require encryption at rest.

**Benefits:**
- No separate file system to manage or back up.
- Files are automatically encrypted by the Prisma client extension.
- Access control is enforced at the database level.
- Files move with the database backup.

**Trade-offs:**
- Large files increase database size significantly.
- Not suitable for files > ~50MB in typical usage.

---

## Multipart Form Data

When a browser uploads a file via an HTML form, it uses a special HTTP encoding called **multipart/form-data**.

### How a Normal Form Works

A regular form submission sends data like this:
```
Content-Type: application/x-www-form-urlencoded
name=John+Smith&email=john%40example.com&age=30
```

All fields are concatenated into a URL-encoded string. This works for text, but not for binary files.

### How a File Upload Form Works

Multipart form data splits the request into multiple "parts" (hence the name), each separated by a boundary string:

```
Content-Type: multipart/form-data; boundary=----FormBoundaryXYZ123

------FormBoundaryXYZ123
Content-Disposition: form-data; name="title"

Q3 Access Review Evidence
------FormBoundaryXYZ123
Content-Disposition: form-data; name="files"; filename="access-review.pdf"
Content-Type: application/pdf

%PDF-1.4 ... (raw binary bytes of the PDF)
------FormBoundaryXYZ123--
```

The browser handles this encoding automatically when you set a form's `enctype="multipart/form-data"` attribute or when using the `FormData` JavaScript API.

### On the Frontend (React)

```typescript
// Creating a FormData object with files
const formData = new FormData();
formData.append('title', 'Q3 Access Review Evidence');
formData.append('evidenceId', evidenceId);
// Append each selected file
selectedFiles.forEach((file) => {
  formData.append('files', file);
});

// Send to the API
const response = await fetch('/api/compliance/evidence/upload', {
  method: 'POST',
  body: formData,
  // Do NOT set Content-Type header — the browser sets it automatically
  // with the correct boundary string
});
```

---

## How the API Receives Files

On the server side, Next.js API routes can parse multipart form data using the built-in `request.formData()` method:

```typescript
export async function POST(req: Request) {
  // Parse the multipart form data
  const formData = await req.formData();

  // Get single text fields
  const evidenceId = formData.get('evidenceId') as string;
  const title = formData.get('title') as string;

  // Get all uploaded files (supports multiple file upload)
  const files = formData.getAll('files') as File[];

  for (const file of files) {
    // File properties
    const fileName = file.name;        // Original filename
    const fileType = file.type;        // MIME type, e.g., "application/pdf"
    const fileSize = file.size;        // Size in bytes

    // Convert to buffer for database storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store in database (encryption happens automatically via Prisma extension)
    await prisma.fieldworkEvidenceAttachment.create({
      data: {
        evidenceRequestId: evidenceId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: buffer,  // Automatically encrypted by Prisma extension
      },
    });
  }

  return NextResponse.json({ success: true });
}
```

### `formData.getAll('files')` vs `formData.get('file')`

- `formData.get('files')` returns only the **first** file with that key.
- `formData.getAll('files')` returns **all** files uploaded under that key.

The application always uses `getAll()` to support multiple file uploads in a single request.

---

## File Size Limits and Type Restrictions

### Size Limits

The application enforces file size limits at two levels:

**1. Next.js configuration** (`next.config.ts`):
```typescript
const nextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',  // Maximum request body size
    },
  },
};
```

**2. Application-level validation** (in the API route):
```typescript
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file

for (const file of files) {
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File "${file.name}" exceeds the 20MB limit.` },
      { status: 400 }
    );
  }
}
```

### Allowed File Types

The application validates MIME types against an allowlist:

```typescript
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/zip',
];

if (!ALLOWED_TYPES.includes(file.type)) {
  return NextResponse.json(
    { error: `File type "${file.type}" is not permitted.` },
    { status: 400 }
  );
}
```

**Important note on MIME type validation:** Browser-reported MIME types can be spoofed. For higher security, server-side magic-byte validation (checking the actual file header bytes) is recommended for production environments handling sensitive documents.

---

## Encrypted File Storage

All `fileData` columns in the database are automatically encrypted at rest using **AES-256-GCM** (Advanced Encryption Standard, 256-bit key, Galois/Counter Mode).

### What AES-256-GCM Means

- **AES** — The industry standard symmetric encryption algorithm.
- **256-bit key** — The strongest key size, providing 2^256 possible keys (effectively unbreakable with current technology).
- **GCM mode** — Provides both encryption (confidentiality) and authentication (integrity). GCM detects if the ciphertext has been tampered with.

### What "At Rest" Means

"Encryption at rest" means the data is encrypted while stored in the database. If someone gained physical or direct database access (e.g., copied the database file), they would see only encrypted bytes — not the original document content.

This is distinct from "encryption in transit" (TLS/HTTPS), which protects data while it travels over the network.

---

## How Encryption Applies to File Data

The encryption is implemented as a **Prisma client extension** in `src/lib/prisma.ts`. This extension intercepts all database operations and transparently handles encryption/decryption.

### Write Path (Encryption)

```
API Route calls prisma.fieldworkEvidenceAttachment.create({ data: { fileData: buffer } })
          ↓
Prisma Extension checks: is "fileData" in the encrypted fields list?
          ↓
YES → encrypts buffer with AES-256-GCM using FIELD_ENCRYPTION_KEY
          ↓
Stores the ciphertext bytes in the database
```

### Read Path (Decryption)

```
API Route calls prisma.fieldworkEvidenceAttachment.findUnique(...)
          ↓
Database returns record with encrypted fileData bytes
          ↓
Prisma Extension checks: is "fileData" in the encrypted fields list?
          ↓
YES → decrypts ciphertext using FIELD_ENCRYPTION_KEY
          ↓
Returns the original plaintext bytes to the API route
```

### The Encryption Key

The encryption key is stored in the `FIELD_ENCRYPTION_KEY` environment variable. This key **must never be committed to source control**. It is set via:
- Vercel environment variables in production.
- `.env` file in local development (which is in `.gitignore`).

**If the key is lost, all encrypted files are permanently unrecoverable.** Maintain an offline backup in a password manager or hardware security module (HSM).

### Encrypted Fields Registry

The list of all encrypted fields is maintained in `src/lib/encrypted-fields.ts`:

```typescript
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  FieldworkEvidenceAttachment: ['fileData'],
  InternalAuditDocument: ['fileData'],
  GovernanceVaultDocument: ['fileData'],
  // ... other models
};
```

---

## Models with fileData Columns

The following database models store file binary data in a `fileData Bytes` column, all of which are encrypted at rest:

| Model | Description | Use Case |
|-------|-------------|---------|
| `FieldworkEvidenceAttachment` | Attachments on audit evidence requests | Auditees uploading evidence documents |
| `InternalAuditDocument` | Internal Audit Document Library files | Audit methodology docs, prior reports |
| `GovernanceVaultDocument` | Governance Vault policy/procedure files | Signed policies, procedures, guidelines |
| `AuditReport` | Final audit report file | Generated PDF audit reports |
| `Evidence` (via attachments) | Compliance evidence files | Control evidence uploads |

### Schema Example

```prisma
model FieldworkEvidenceAttachment {
  id                  String                  @id @default(cuid())
  customerAccountId   String
  evidenceRequestId   String
  evidenceRequest     FieldworkEvidenceRequest @relation(...)

  fileName            String                  // Original filename (e.g., "Q3-access-review.pdf")
  fileType            String                  // MIME type (e.g., "application/pdf")
  fileSize            Int                     // Size in bytes (unencrypted size)
  fileData            Bytes                   // Binary content — AUTO-ENCRYPTED

  uploadedById        String
  uploadedBy          User                    @relation(...)

  createdAt           DateTime                @default(now())
}
```

---

## Retrieving and Serving Files

Files stored as database bytes are served via a dedicated download API route:

```typescript
// GET /api/internal-audit/fieldwork/attachments/[id]/download
export const GET = withAuth(async (req, context, session) => {
  const { id } = await context.params;

  const attachment = await prisma.fieldworkEvidenceAttachment.findUnique({
    where: { id, customerAccountId: session.customerAccountId },
  });

  if (!attachment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // fileData is already decrypted by the Prisma extension
  return new NextResponse(attachment.fileData, {
    headers: {
      'Content-Type': attachment.fileType,
      'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
      'Content-Length': attachment.fileSize.toString(),
    },
  });
}, { resource: 'internal-audit.fieldwork', action: 'view' });
```

The `Content-Disposition: attachment` header tells the browser to download the file rather than display it inline. Remove `attachment;` to display PDFs and images inline in the browser tab.

---

## File Management — Delete and Update

### Deleting a File

```typescript
// DELETE /api/internal-audit/fieldwork/attachments/[id]
await prisma.fieldworkEvidenceAttachment.delete({
  where: { id, customerAccountId: session.customerAccountId },
});
```

Note: There is no `uploads/` file to clean up since the file content is stored entirely in the database. Deleting the database record is sufficient.

### Replacing a File (Update)

Files are replaced rather than updated in-place:
1. DELETE the existing attachment record.
2. POST the new file to create a new attachment record.

The application does not support partial updates to `fileData` — the entire file must be re-uploaded if changes are needed.

---

## Best Practices

### Validate Both Client-Side and Server-Side

Always validate file type and size on both the frontend (for user experience) and the backend (for security). Client-side validation can be bypassed; server-side validation cannot.

### Use Meaningful File Names

Store the original filename (`file.name`) in a `fileName` column separate from the binary content. Never use the original filename as the file system path — it may contain path traversal characters (e.g., `../../etc/passwd`).

### Avoid Serving Files from the Public Directory

Encrypted, access-controlled files should only be served through authenticated API routes. Do not place sensitive files in Next.js's `public/` directory, as those are served without authentication.

### Limit File Upload Access by Role

Not all users should be able to upload files everywhere. Use `withAuth` with appropriate resource/action permissions on all upload endpoints.

### Monitor Upload Volume

Large numbers of file uploads can fill database storage quickly. The Prisma Studio `FieldworkEvidenceAttachment` table can be monitored for total storage consumption.

---

## Common File Upload Errors

### Error: "413 Request Entity Too Large"

**Cause:** The file exceeds the Next.js or Nginx body size limit.

**Fix:**
- Increase `bodyParser.sizeLimit` in `next.config.ts`.
- If behind a reverse proxy (Nginx), increase `client_max_body_size`.
- Compress the file before uploading if it is a large document.

### Error: "File type not permitted"

**Cause:** The uploaded file's MIME type is not in the `ALLOWED_TYPES` list.

**Fix:**
- Check the file type. If it should be allowed, add it to `ALLOWED_TYPES` in the relevant API route.
- Ask the user to save in a compatible format (e.g., save as PDF instead of .pages).

### Error: "Failed to parse form data"

**Cause:** The request Content-Type header is missing the boundary parameter, or the frontend did not use `FormData`.

**Fix:** Ensure the frontend does **not** manually set `Content-Type: multipart/form-data`. The browser must set this header automatically (it includes the boundary) when using `FormData`. If you manually set the header, you break the boundary, and the server cannot parse the parts.

### Error: "Decryption failed"

**Cause:** The `FIELD_ENCRYPTION_KEY` environment variable changed after files were stored. Old files were encrypted with the previous key; the new key cannot decrypt them.

**Fix:** Run the key rotation migration script (`npm run encrypt:rotate-key`) which re-encrypts all files from the old key to the new key before retiring the old one. Never change the key without running this migration first.

### Error: "File stored successfully but download returns empty"

**Cause:** The `fileData` column was written as `null` or empty bytes.

**Debug:**
1. Check that the frontend is correctly appending the file to `FormData` before sending.
2. Check that the API route calls `file.arrayBuffer()` and converts to `Buffer` before writing.
3. Check that the Prisma extension is not intercepting and zeroing out the data.
4. Verify in Prisma Studio that the record's `fileData` column is not null and has non-zero size.
