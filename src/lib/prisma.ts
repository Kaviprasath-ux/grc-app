import { PrismaClient } from "@prisma/client";
import { ENCRYPTED_FIELDS } from "./encrypted-fields";
import {
  isEncryptionEnabled,
  maybeEncryptBytes,
  maybeDecryptBytes,
  encryptString,
  decryptString,
  isEncrypted,
} from "./encryption";

// ─────────────────────────────────────────────────────────────────────────────
// Prisma singleton + transparent field encryption.
//
// When ENCRYPTION_ENABLED=true, the client extension below intercepts reads
// and writes against fields registered in `encrypted-fields.ts` and applies
// AES-256-GCM. Callers see plaintext exactly as before — there is no API
// change.
//
// The extension is ALWAYS applied so the exported `prisma` has a stable
// extended-client type (callers don't see a union of two client shapes).
// Each query handler checks `isEncryptionEnabled()` at the top: when the
// kill switch is off, it short-circuits straight to `query(args)` and the
// behaviour is byte-identical to the unwrapped client.
// ─────────────────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function encryptWriteData(modelName: string, data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const specs = ENCRYPTED_FIELDS[modelName];
  if (!specs?.length) return data;

  if (Array.isArray(data)) {
    return data.map((row) => encryptWriteData(modelName, row));
  }

  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const { field, type } of specs) {
    const value = out[field];
    if (value === null || value === undefined) continue;
    if (type === "bytes") {
      const buf = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
      if (!isEncrypted(buf)) out[field] = maybeEncryptBytes(buf);
    } else if (type === "string" && typeof value === "string") {
      try {
        const decoded = Buffer.from(value, "base64");
        if (isEncrypted(decoded)) continue;
      } catch {
        /* fall through to encrypt */
      }
      out[field] = encryptString(value);
    }
  }
  return out;
}

function decryptReadResult(modelName: string, result: unknown): unknown {
  if (!result) return result;
  const specs = ENCRYPTED_FIELDS[modelName];
  if (!specs?.length) return result;

  if (Array.isArray(result)) {
    return result.map((row) => decryptReadResult(modelName, row));
  }

  if (typeof result !== "object") return result;

  const out: Record<string, unknown> = { ...(result as Record<string, unknown>) };
  for (const { field, type } of specs) {
    const value = out[field];
    if (value === null || value === undefined) continue;
    try {
      if (type === "bytes") {
        const buf = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
        out[field] = maybeDecryptBytes(buf);
      } else if (type === "string" && typeof value === "string") {
        const decoded = Buffer.from(value, "base64");
        if (isEncrypted(decoded)) {
          out[field] = decryptString(value);
        }
      }
    } catch (err) {
      console.error(
        `[encryption] Failed to decrypt ${modelName}.${field}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return out;
}

function modelKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function createPrismaClient() {
  const base = new PrismaClient();
  return base.$extends({
    name: "field-encryption",
    query: {
      $allModels: {
        async create({ model, args, query }) {
          if (!isEncryptionEnabled()) return query(args);
          const lower = modelKey(model);
          if (args.data) args.data = encryptWriteData(lower, args.data) as typeof args.data;
          const result = await query(args);
          return decryptReadResult(lower, result);
        },
        async createMany({ model, args, query }) {
          if (!isEncryptionEnabled()) return query(args);
          const lower = modelKey(model);
          if (args.data) args.data = encryptWriteData(lower, args.data) as typeof args.data;
          return query(args);
        },
        async update({ model, args, query }) {
          if (!isEncryptionEnabled()) return query(args);
          const lower = modelKey(model);
          if (args.data) args.data = encryptWriteData(lower, args.data) as typeof args.data;
          const result = await query(args);
          return decryptReadResult(lower, result);
        },
        async updateMany({ model, args, query }) {
          if (!isEncryptionEnabled()) return query(args);
          const lower = modelKey(model);
          if (args.data) args.data = encryptWriteData(lower, args.data) as typeof args.data;
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (!isEncryptionEnabled()) return query(args);
          const lower = modelKey(model);
          if (args.create) args.create = encryptWriteData(lower, args.create) as typeof args.create;
          if (args.update) args.update = encryptWriteData(lower, args.update) as typeof args.update;
          const result = await query(args);
          return decryptReadResult(lower, result);
        },
        async findUnique({ model, args, query }) {
          if (!isEncryptionEnabled()) return query(args);
          const lower = modelKey(model);
          const result = await query(args);
          return decryptReadResult(lower, result);
        },
        async findUniqueOrThrow({ model, args, query }) {
          if (!isEncryptionEnabled()) return query(args);
          const lower = modelKey(model);
          const result = await query(args);
          return decryptReadResult(lower, result);
        },
        async findFirst({ model, args, query }) {
          if (!isEncryptionEnabled()) return query(args);
          const lower = modelKey(model);
          const result = await query(args);
          return decryptReadResult(lower, result);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (!isEncryptionEnabled()) return query(args);
          const lower = modelKey(model);
          const result = await query(args);
          return decryptReadResult(lower, result);
        },
        async findMany({ model, args, query }) {
          if (!isEncryptionEnabled()) return query(args);
          const lower = modelKey(model);
          const result = await query(args);
          return decryptReadResult(lower, result);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
