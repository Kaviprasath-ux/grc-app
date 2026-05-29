/**
 * One-off migration: copy every file under `process.cwd()/uploads/` (or
 * /tmp/uploads on a serverless host) into the configured Spaces bucket.
 *
 * Symptom this fixes: the cover image (and every other uploaded file)
 * works locally but is a broken image on the cloud. Reason — files
 * landed on the container's ephemeral disk and disappeared on the next
 * redeploy. The DB row still points at `/uploads/...`, but the bytes
 * are gone. Run this once locally against the production DB so any
 * remaining local copies are pushed to Spaces.
 *
 * Idempotent — skips any key that already exists in the bucket
 * (HEAD check). Safe to re-run.
 *
 * Usage (PowerShell):
 *   $env:SPACES_ENDPOINT = "https://blr1.digitaloceanspaces.com"
 *   $env:SPACES_REGION   = "blr1"
 *   $env:SPACES_BUCKET   = "verifai-uploads"
 *   $env:SPACES_KEY      = "<access-key>"
 *   $env:SPACES_SECRET   = "<secret>"
 *   npx tsx scripts/migrate-uploads-to-spaces.ts
 *
 * Pass --dry-run to list what would be uploaded without touching the bucket.
 */
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import {
  isSpacesEnabled,
  uploadToSpaces,
  existsInSpaces,
  urlPathToKey,
  guessContentType,
} from "../src/lib/storage-driver";
import { getUploadBaseDir } from "../src/lib/file-upload";

interface Args { dryRun: boolean; baseDir: string }

function parseArgs(): Args {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    baseDir: args.find((a) => a.startsWith("--base="))?.replace("--base=", "") || getUploadBaseDir(),
  };
}

async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  console.log(`Local source dir : ${args.baseDir}`);
  console.log(`Dry run          : ${args.dryRun ? "yes" : "no"}`);

  if (!args.dryRun && !isSpacesEnabled()) {
    console.error(
      "ERROR: Spaces is not configured (need SPACES_ENDPOINT, SPACES_REGION, " +
      "SPACES_BUCKET, SPACES_KEY, SPACES_SECRET). Use --dry-run to preview without uploading.",
    );
    process.exit(2);
  }

  const dirInfo = await stat(args.baseDir).catch(() => null);
  if (!dirInfo || !dirInfo.isDirectory()) {
    console.log(`Source directory does not exist or is not a directory — nothing to migrate.`);
    process.exit(0);
  }

  const files = await walk(args.baseDir);
  console.log(`Found ${files.length} file(s) under the source dir.\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const absPath of files) {
    const rel = path.relative(args.baseDir, absPath).replace(/\\/g, "/");
    const key = urlPathToKey(`/uploads/${rel}`);
    process.stdout.write(`  ${key} ... `);

    if (args.dryRun) {
      console.log("WOULD UPLOAD");
      uploaded++;
      continue;
    }

    try {
      if (await existsInSpaces(key)) {
        console.log("skip (already in bucket)");
        skipped++;
        continue;
      }
      const buf = await readFile(absPath);
      await uploadToSpaces(key, buf, guessContentType(absPath));
      console.log("uploaded");
      uploaded++;
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. Uploaded: ${uploaded}. Skipped (already present): ${skipped}. Failed: ${failed}.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
