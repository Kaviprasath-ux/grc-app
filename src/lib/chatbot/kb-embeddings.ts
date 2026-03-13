/**
 * KB Embeddings — Vector search for knowledge base articles using pgvector
 *
 * Embeds help articles using OpenAI text-embedding-3-small and stores in PostgreSQL.
 * Provides cosine similarity search with RBAC pre-filtering.
 */

import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { helpArticles, type HelpArticle } from "@/data/help-knowledge-base";
import type { ProductFlags } from "@/lib/help-search";

// ==================== CONFIGURATION ====================

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const TOP_K = 5; // Number of results to return

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ==================== EMBEDDING GENERATION ====================

/**
 * Generate embedding for a text string using OpenAI.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAI();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.substring(0, 8000), // Limit input to avoid token overflow
  });
  return response.data[0].embedding;
}

/**
 * Build searchable content from a HelpArticle.
 * Concatenates question + alternate questions + answer + steps + notes.
 */
function buildArticleContent(article: HelpArticle): string {
  const parts: string[] = [
    article.question,
    ...article.alternateQuestions,
    article.answer,
    ...(article.steps || []),
    ...(article.notes || []),
    ...article.keywords,
  ];
  return parts.join("\n");
}

// ==================== SEED / SYNC ====================

/**
 * Seed all KB articles into the database with embeddings.
 * Skips articles that already exist (by articleKey).
 * Call this on first deploy or when KB articles change.
 */
export async function seedKBEmbeddings(): Promise<{ seeded: number; skipped: number }> {
  let seeded = 0;
  let skipped = 0;

  // Get existing article keys
  const existing = await prisma.chatbotKBArticle.findMany({
    select: { articleKey: true },
  });
  const existingKeys = new Set(existing.map((a) => a.articleKey));

  // Process articles in batches of 10
  const BATCH_SIZE = 10;
  const articlesToSeed = helpArticles.filter((a) => !existingKeys.has(a.id));

  console.log(`[KB Seed] ${articlesToSeed.length} new articles to embed, ${existingKeys.size} already exist`);

  for (let i = 0; i < articlesToSeed.length; i += BATCH_SIZE) {
    const batch = articlesToSeed.slice(i, i + BATCH_SIZE);

    // Generate embeddings for batch
    const contents = batch.map((a) => buildArticleContent(a));
    const client = getOpenAI();
    const embeddingResponse = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: contents.map((c) => c.substring(0, 8000)),
    });

    // Store in database
    for (let j = 0; j < batch.length; j++) {
      const article = batch[j];
      const embedding = embeddingResponse.data[j].embedding;

      await prisma.chatbotKBArticle.create({
        data: {
          articleKey: article.id,
          module: article.module,
          category: article.category,
          productScope: article.productScope,
          roles: article.roles || [],
          question: article.question,
          content: contents[j],
          embedding,
        },
      });
      seeded++;
    }

    console.log(`[KB Seed] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${seeded} articles embedded`);
  }

  skipped = existingKeys.size;
  console.log(`[KB Seed] Complete: ${seeded} seeded, ${skipped} skipped`);
  return { seeded, skipped };
}

/**
 * Re-embed all articles (force update). Deletes existing and re-creates.
 */
export async function reseedKBEmbeddings(): Promise<{ seeded: number }> {
  await prisma.chatbotKBArticle.deleteMany({});
  const result = await seedKBEmbeddings();
  return { seeded: result.seeded };
}

// ==================== VECTOR SEARCH ====================

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * RBAC visibility check — same logic as help-search.ts isArticleVisibleForProduct
 */
function isArticleVisible(
  productScope: string,
  roles: string[],
  userRoles: string[],
  productFlags: ProductFlags
): boolean {
  // Product scope filtering
  if (productScope === "both") {
    // visible to all
  } else if (productScope === "grc") {
    if (!productFlags.isGrcAdded || productFlags.isAuditOnly) return false;
  } else if (productScope === "audit") {
    if (!productFlags.isGrcAdded || !productFlags.isAuditUser) return false;
  } else if (productScope === "tprm") {
    if (!productFlags.isTprmAdded) return false;
  }

  // Role-level restriction
  if (roles.length > 0) {
    if (!roles.some((r) => userRoles.includes(r))) return false;
  }

  return true;
}

export interface KBSearchResult {
  articleKey: string;
  module: string;
  category: string;
  question: string;
  content: string;
  similarity: number;
}

/**
 * Search KB articles using vector similarity with RBAC filtering.
 *
 * Flow:
 * 1. Embed user query
 * 2. Fetch all KB articles from DB (they're cached by Prisma connection pool)
 * 3. Filter by RBAC (productScope + roles)
 * 4. Cosine similarity on filtered set
 * 5. Return top-K results
 */
export async function searchKB(
  query: string,
  userRoles: string[],
  productFlags: ProductFlags,
  topK: number = TOP_K
): Promise<KBSearchResult[]> {
  // 1. Embed the query
  const queryEmbedding = await generateEmbedding(query);

  // 2. Fetch all KB articles
  const articles = await prisma.chatbotKBArticle.findMany({
    select: {
      articleKey: true,
      module: true,
      category: true,
      productScope: true,
      roles: true,
      question: true,
      content: true,
      embedding: true,
    },
  });

  // 3. Filter by RBAC + compute similarity
  const scored = articles
    .filter((a) => isArticleVisible(a.productScope, a.roles, userRoles, productFlags))
    .map((a) => ({
      articleKey: a.articleKey,
      module: a.module,
      category: a.category,
      question: a.question,
      content: a.content,
      similarity: cosineSimilarity(queryEmbedding, a.embedding),
    }))
    .filter((a) => a.similarity > 0.3) // Minimum similarity threshold
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored;
}

/**
 * Check if KB articles have been seeded.
 */
export async function isKBSeeded(): Promise<boolean> {
  const count = await prisma.chatbotKBArticle.count();
  return count > 0;
}
