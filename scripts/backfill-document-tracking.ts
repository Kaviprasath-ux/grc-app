/**
 * Backfill script to populate new document tracking fields from existing rawResponse JSON
 *
 * Run with: npx tsx prisma/migrations/backfill-document-tracking.ts
 *
 * This script:
 * 1. Finds all EvidenceAIReview records with rawResponse
 * 2. Extracts artifactId, evidenceId from rawResponse
 * 3. Populates new tracking fields (artifactId, evidenceDocumentId, artifactDocumentId, ingestJobId, sources)
 * 4. Migrates sources from suggestions field to dedicated sources field
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RawResponseData {
  artifactId?: string;
  artifactFileName?: string;
  evidenceId?: string;
  evidenceCode?: string;
  response?: {
    sources?: string[];
    answer?: string;
    confidence?: number;
  };
  documentTracking?: {
    sentArtifactDocId?: string;
    sentEvidenceDocId?: string;
    returnedDocId?: string;
    ingestJobId?: string;
  };
}

async function backfillDocumentTracking() {
  console.log('Starting backfill of document tracking fields...\n');

  // Find all reviews that might need backfilling
  const reviews = await prisma.evidenceAIReview.findMany({
    where: {
      OR: [
        { rawResponse: { not: null } },
        { suggestions: { not: null } }, // May contain sources in legacy format
      ],
    },
    select: {
      id: true,
      evidenceId: true,
      artifactId: true,
      ingestJobId: true,
      evidenceDocumentId: true,
      artifactDocumentId: true,
      runpodDocumentRef: true,
      sources: true,
      suggestions: true,
      documentId: true,
      rawResponse: true,
    },
  });

  console.log(`Found ${reviews.length} reviews to process\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const review of reviews) {
    try {
      let rawResponse: RawResponseData = {};

      // Parse rawResponse JSON
      if (review.rawResponse) {
        try {
          rawResponse = JSON.parse(review.rawResponse);
        } catch {
          console.warn(`  [WARN] Could not parse rawResponse for review ${review.id}`);
        }
      }

      // Determine what needs updating
      const updates: {
        artifactId?: string;
        evidenceDocumentId?: string;
        artifactDocumentId?: string;
        ingestJobId?: string;
        runpodDocumentRef?: string;
        sources?: string;
      } = {};

      // Extract artifactId if not already set
      if (!review.artifactId && rawResponse.artifactId) {
        // Verify the artifact exists before setting FK
        const artifactExists = await prisma.artifact.findUnique({
          where: { id: rawResponse.artifactId },
          select: { id: true },
        });
        if (artifactExists) {
          updates.artifactId = rawResponse.artifactId;
        }
      }

      // Extract document tracking from rawResponse
      if (!review.evidenceDocumentId) {
        updates.evidenceDocumentId =
          rawResponse.documentTracking?.sentEvidenceDocId ||
          rawResponse.evidenceId ||
          review.evidenceId;
      }

      if (!review.artifactDocumentId) {
        updates.artifactDocumentId =
          rawResponse.documentTracking?.sentArtifactDocId ||
          rawResponse.artifactId ||
          null;
      }

      if (!review.ingestJobId) {
        updates.ingestJobId =
          rawResponse.documentTracking?.ingestJobId ||
          review.documentId ||
          null;
      }

      if (!review.runpodDocumentRef) {
        updates.runpodDocumentRef =
          rawResponse.documentTracking?.returnedDocId ||
          null;
      }

      // Migrate sources from suggestions to dedicated sources field
      if (!review.sources && review.suggestions) {
        // Check if suggestions contains sources (array format)
        try {
          const suggestionsData = JSON.parse(review.suggestions);
          if (Array.isArray(suggestionsData)) {
            updates.sources = review.suggestions;
          }
        } catch {
          // Not valid JSON or not an array, skip
        }
      }

      // Extract sources from rawResponse if still not set
      if (!review.sources && !updates.sources && rawResponse.response?.sources) {
        updates.sources = JSON.stringify(rawResponse.response.sources);
      }

      // Apply updates if there are any
      if (Object.keys(updates).length > 0) {
        await prisma.evidenceAIReview.update({
          where: { id: review.id },
          data: updates,
        });
        console.log(`  [OK] Updated review ${review.id}:`, Object.keys(updates).join(', '));
        updatedCount++;
      } else {
        skippedCount++;
      }
    } catch (err) {
      const error = err as Error;
      console.error(`  [ERROR] Failed to update review ${review.id}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n--- Backfill Summary ---');
  console.log(`Total reviews processed: ${reviews.length}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped (already populated): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the backfill
backfillDocumentTracking()
  .then(() => {
    console.log('\nBackfill completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nBackfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
