/**
 * Field-level encryption helpers for sensitive DB columns.
 *
 * Algorithm: AES-256-GCM (authenticated encryption — detects tampering).
 * Key:       32 bytes, base64-encoded in FIELD_ENCRYPTION_KEY env var.
 * Format:    [1 byte version][12 byte IV][16 byte authTag][N byte ciphertext]
 *
 * The 1-byte version prefix lets us detect ciphertext vs plaintext during the
 * one-time migration of existing rows AND lets us add new key/algorithm
 * versions later without breaking decryption of older rows.
 *
 * Kill switch: when ENCRYPTION_ENABLED !== "true", isEncryptionEnabled()
 * returns false and the Prisma extension passes data through untouched.
 * That's how we ship the same code to UAT and Prod and stage the rollout
 * via per-app env vars.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const KEY_LENGTH = 32; // bytes (256 bit)
const IV_LENGTH = 12; // bytes — GCM standard
const AUTH_TAG_LENGTH = 16; // bytes
const VERSION_BYTE = 0x01;

/**
 * Read the kill switch. Cached on first call — env vars don't change at runtime.
 */
let _enabledCache: boolean | null = null;
export function isEncryptionEnabled(): boolean {
  if (_enabledCache === null) {
    _enabledCache = process.env.ENCRYPTION_ENABLED === "true";
  }
  return _enabledCache;
}

/**
 * For tests only — resets the cache so a test can flip the env var mid-suite.
 */
export function _resetEncryptionEnabledCache(): void {
  _enabledCache = null;
}

/**
 * Load the master key from env. Throws if missing or wrong length, but ONLY
 * when actually called — so the app can boot with the var unset as long as
 * encryption is disabled.
 */
function getMasterKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is not set. Generate with: " +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}). ` +
        "It should be base64-encoded 32 random bytes.",
    );
  }
  return key;
}

/**
 * Detect whether a value is already encrypted by this module.
 * Used by the migration script (skip already-encrypted rows) and by the
 * Prisma extension (don't double-encrypt on update).
 */
export function isEncrypted(value: Buffer | string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value, "base64");
  // Need at least version + IV + authTag + 1 byte of ciphertext
  if (buf.length < 1 + IV_LENGTH + AUTH_TAG_LENGTH + 1) return false;
  return buf[0] === VERSION_BYTE;
}

/**
 * Encrypt a Buffer (file contents). Returns a Buffer suitable for a Prisma
 * Bytes column.
 */
export function encryptBytes(plaintext: Buffer): Buffer {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION_BYTE]), iv, authTag, ciphertext]);
}

/**
 * Decrypt a Buffer produced by encryptBytes. Throws if the ciphertext is
 * corrupted or was encrypted with a different key.
 */
export function decryptBytes(ciphertext: Buffer): Buffer {
  if (ciphertext.length < 1 + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Ciphertext too short to be valid encrypted data");
  }
  const version = ciphertext[0];
  if (version !== VERSION_BYTE) {
    throw new Error(`Unsupported encryption version: 0x${version.toString(16)}`);
  }
  const key = getMasterKey();
  const iv = ciphertext.subarray(1, 1 + IV_LENGTH);
  const authTag = ciphertext.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + AUTH_TAG_LENGTH);
  const ct = ciphertext.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Encrypt a string. Returns base64-encoded ciphertext for use in a String
 * column. Reserved for Phase 2.5 (PII fields) — not used by the initial
 * fileData rollout, but kept here so the helper module is feature-complete.
 */
export function encryptString(plaintext: string): string {
  return encryptBytes(Buffer.from(plaintext, "utf8")).toString("base64");
}

/**
 * Decrypt a base64 string produced by encryptString.
 */
export function decryptString(ciphertext: string): string {
  return decryptBytes(Buffer.from(ciphertext, "base64")).toString("utf8");
}

/**
 * Convenience: encrypt-or-passthrough based on the kill switch.
 * Returns the original value if encryption is disabled. Overloads preserve
 * non-null narrowing so call sites don't need `!` assertions.
 */
export function maybeEncryptBytes(value: Buffer): Buffer;
export function maybeEncryptBytes(value: null): null;
export function maybeEncryptBytes(value: undefined): undefined;
export function maybeEncryptBytes(value: Buffer | null | undefined): Buffer | null | undefined;
export function maybeEncryptBytes(value: Buffer | null | undefined): Buffer | null | undefined {
  if (value === null || value === undefined) return value;
  if (!isEncryptionEnabled()) return value;
  if (isEncrypted(value)) return value; // already encrypted — don't double-encrypt
  return encryptBytes(value);
}

/**
 * Convenience: decrypt-or-passthrough. Returns original if not encrypted
 * (handles legacy plaintext rows during migration window).
 */
export function maybeDecryptBytes(value: Buffer): Buffer;
export function maybeDecryptBytes(value: null): null;
export function maybeDecryptBytes(value: undefined): undefined;
export function maybeDecryptBytes(value: Buffer | null | undefined): Buffer | null | undefined;
export function maybeDecryptBytes(value: Buffer | null | undefined): Buffer | null | undefined {
  if (value === null || value === undefined) return value;
  if (!isEncrypted(value)) return value; // legacy plaintext, pass through
  return decryptBytes(value);
}
