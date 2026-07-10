/**
 * Seed the IIA *Global Internal Audit Standards 2024* into the chatbot knowledge
 * base so the Internal Audit chatbot can answer questions from the regulation.
 *
 * Chunks are produced by scripts/extract-gias-standards.py and read from
 * scripts/data/gias-2024-standards.json. Each chunk becomes a ChatbotKBArticle
 * with:
 *   - module       = "internal-audit"
 *   - productScope = "audit"   ← restricts retrieval to internal-audit users only
 *   - source       = "document" ← distinguishes it from help-article seeds + authored articles
 *   - articleKey   = "gias-2024-..." (stable, so re-running is idempotent)
 *
 * The existing RAG pipeline (searchKB) filters by productScope BEFORE similarity,
 * so GRC-only / TPRM users never retrieve this content.
 *
 * Run:  npm run db:seed-gias        (or: npx tsx scripts/seed-gias-standards.ts)
 * Requires env: OPENAI_API_KEY, DATABASE_URL.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { prisma } from "../src/lib/prisma";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 16;
const KEY_PREFIX = "gias-2024-";
const DATA_FILE = path.join(__dirname, "data", "gias-2024-standards.json");

interface Chunk {
  type: string;
  id: string;
  domain: string | null;
  principle: string | null;
  title: string;
  heading: string;
  page: number;
  content: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/—/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/** Build the text that gets embedded — heading + structural context + body. */
function buildContent(c: Chunk): string {
  return [c.domain, c.principle, c.heading, "", c.content]
    .filter((x) => x != null && x !== "")
    .join("\n");
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(
      `Missing ${DATA_FILE}. Run: python scripts/extract-gias-standards.py <pdf> ${path.relative(process.cwd(), DATA_FILE)}`,
    );
  }

  const payload = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as { chunks: Chunk[] };
  const chunks = payload.chunks;
  console.log(`[GIAS Seed] Loaded ${chunks.length} chunks from ${path.basename(DATA_FILE)}`);

  // Stable, unique article keys (idempotent re-seed).
  const used = new Set<string>();
  const keyed = chunks.map((c) => {
    let key = KEY_PREFIX + slugify(c.heading);
    let n = 2;
    while (used.has(key)) key = `${KEY_PREFIX}${slugify(c.heading)}-${n++}`;
    used.add(key);
    return { chunk: c, articleKey: key };
  });

  // Idempotent: clear any previously seeded GIAS articles, then re-insert.
  const del = await prisma.chatbotKBArticle.deleteMany({
    where: { articleKey: { startsWith: KEY_PREFIX } },
  });
  console.log(`[GIAS Seed] Removed ${del.count} existing GIAS articles`);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let seeded = 0;

  for (let i = 0; i < keyed.length; i += BATCH_SIZE) {
    const batch = keyed.slice(i, i + BATCH_SIZE);
    const contents = batch.map((b) => buildContent(b.chunk));
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: contents.map((c) => c.substring(0, 8000)),
    });

    for (let j = 0; j < batch.length; j++) {
      const { chunk, articleKey } = batch[j];
      await prisma.chatbotKBArticle.create({
        data: {
          articleKey,
          module: "internal-audit",
          category: "Global Internal Audit Standards 2024",
          productScope: "audit",
          roles: [], // all internal-audit users
          question: chunk.heading,
          answer: chunk.content,
          content: contents[j],
          embedding: res.data[j].embedding,
          isPublished: true,
          source: "document",
        },
      });
      seeded++;
    }
    console.log(`[GIAS Seed] ${seeded}/${keyed.length} embedded`);
  }

  console.log(`[GIAS Seed] Complete: ${seeded} articles seeded (productScope=audit).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[GIAS Seed] Error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
